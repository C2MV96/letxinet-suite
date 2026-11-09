<#
.SYNOPSIS
  BL-10 — Re-evaluación mensual de sources backlog V11.1
  Probes crudos directos a endpoints externos para detectar si fuentes EMPTY se recuperaron.

.DESCRIPTION
  Ejecuta HTTP GET/POST directos al API externa de cada backlog source (sin pasar por V11.1),
  captura: body length, HTTP status, heurística si "no es EMPTY" (>400 bytes JSON válido o
  respuesta con claves 'results'/'hits'/'objects').
  Compara con baseline de 2026-07-25 (matriz v4) que documentó 11 EMPTY Anubis + 4 EMPTY SPA HTML + 1 API retirada.

  Salidas:
    - stdout: tabla con status por source y veredicto (RECOVERED / STILL_EMPTY / UNCLEAR)
    - Log en disco: `retest-backlog-results-<timestamp>.json` en scripts folder
    - Si 3+ sources RECOVERED: imprime banner recomendando ejecutar pool v5 sistemático

.PARAMETER TimeoutSec
  Timeout por probe (default: 25). Anubis puede tardar 10-15s en PoW challenge render.

.PARAMETER Verbose
  Mostrar body sample (primeros 200 chars) por cada source.

.EXAMPLE
  .\retest-backlog.ps1
  .\retest-backlog.ps1 -TimeoutSec 40 -Verbose

.NOTES
  Autor: opencode session BL-10 (2026-07-25)
  Frecuencia recomendada: 1er lunes de cada mes o tras reporte de usuario de fuente caída.
  Pre-requisitos: V11.1 corriendo en puerto 4003 (no estrictamente necesario, este script no
  usa V11.1, hace probes directos).
#>

[CmdletBinding()]
param(
    [int]$TimeoutSec = 25
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$results = @()
$recovered = 0
$stillEmpty = 0
$unclear = 0

function Test-Source {
    param(
        [string]$SourceId,
        [string]$Url,
        [string]$Method = 'GET',
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [string[]]$JsonKeysExpected = @('results', 'hits', 'objects', 'docs', 'searchResult', 'records', 'items', 'notes', '_embedded'),
        [int]$MinBodyLength = 400,
        [string]$Notes = '',
        [string[]]$AnubisMarkers = @('making sure you', 'anubis', 'cloudflare', 'just a moment', 'challenge', 'are you a robot'),
        [string[]]$SpaHtmlMarkers = @('doctype html', '<title>redirect', 'angular', 'react', 'vue')
    )

    $start = Get-Date
    $result = [PSCustomObject]@{
        source     = $SourceId
        url          = $Url
        method       = $Method
        status       = 0
        ok           = $false
        length       = 0
        duration_ms  = 0
        verdict      = 'UNCLEAR'
        body_sample  = ''
        json_key_found = ''
        notes        = $Notes
        error        = ''
    }

    try {
        $params = @{
            Uri             = $Url
            Method          = $Method
            TimeoutSec      = $TimeoutSec
            UseBasicParsing = $true
        }
        if ($Headers.Count -gt 0) { $params.Headers = $Headers }
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = 'application/json'
        }
        $r = Invoke-WebRequest @params
        $result.status = [int]$r.StatusCode
        $result.ok = $r.StatusCode -lt 400
        $result.length = $r.RawContentLength
        # $r.Content may be string (utf-8 default) OR byte[] (compressed/binary)
        $contentStr = if ($r.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($r.Content) } else { $r.Content }
        $result.body_sample = $contentStr.Substring(0, [Math]::Min(200, $contentStr.Length))

        # Heuristic: JSON valid AND contains one of expected keys AND length > min
        $isJson = $false
        $keyFound = ''
        try {
            $j = $contentStr | ConvertFrom-Json -ErrorAction Stop
            $isJson = $true
            # ConvertFrom-Json sometimes lazily-flat-parses complex responses;
            # if result is array of chars (because JSON parsed charwise), retry with deeper
            if ($j -is [Array] -and $j.Count -gt 1000) {
                # Likely parsing issue; just inspect first-level text via regex
                foreach ($key in $JsonKeysExpected) {
                    $pattern = "`"($key)`"\s*:"
                    if ($contentStr -match $pattern) { $keyFound = $matches[1]; break }
                }
            } else {
                foreach ($key in $JsonKeysExpected) {
                    if ($j.PSObject.Properties.Name -contains $key) {
                        $keyFound = $key
                        break
                    }
                }
            }
        } catch { $isJson = $false }

        $result.json_key_found = $keyFound

        # Heuristic for Anubis / anti-bot challenge wall (HTML response with markers)
        $bodyLower = $contentStr.ToLower()
        $isAnubisWall = $false
        foreach ($marker in $AnubisMarkers) {
            if ($bodyLower.Contains($marker)) { $isAnubisWall = $true; break }
        }
        $isSpaHtml = $false
        if ($bodyLower.StartsWith('<') -or $bodyLower.StartsWith('<!doctype')) {
            foreach ($marker in $SpaHtmlMarkers) {
                if ($bodyLower.Contains($marker)) { $isSpaHtml = $true; break }
            }
            if (-not $isSpaHtml -and $bodyLower.Length -lt 2000) { $isSpaHtml = $true }
        }

        if (-not $result.ok) {
            $result.verdict = 'STILL_EMPTY'
        } elseif ($isAnubisWall) {
            $result.verdict = 'STILL_EMPTY'  # Anubis/bot-wall actively blocking
        } elseif ($isSpaHtml) {
            $result.verdict = 'STILL_EMPTY'  # SPA HTML page (no API JSON)
        } elseif ($isJson -and $keyFound -and $result.length -ge $MinBodyLength) {
            $result.verdict = 'RECOVERED'
        } elseif ($isJson -and $result.length -ge 2000) {
            $result.verdict = 'RECOVERED'  # JSON valid + big body = data is there, even if schema/key unknown
        } elseif ($result.length -ge 2000 -and -not $contentStr.StartsWith('<')) {
            $result.verdict = 'UNCLEAR'
        } else {
            $result.verdict = 'UNCLEAR'
        }
    } catch [System.Net.WebException] {
        $result.status = $(if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 })
        $result.error = $_.Exception.Message
        $result.verdict = 'STILL_EMPTY'  # network failure counts as not-recovered
    } catch {
        $result.error = $_.Exception.Message
        $result.verdict = 'STILL_EMPTY'
    }

    $result.duration_ms = [int]((Get-Date) - $start).TotalMilliseconds
    return $result
}

Write-Host "`n=== BL-10: Re-evaluación mensual de backlog V11.1 ===" -ForegroundColor Cyan
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
Write-Host "Baseline: 2026-07-25 matriz v4 (15 backlog EMPTY: 11 Anubis + 4 SPA HTML)"
Write-Host "Timeout por probe: $TimeoutSec s`n"

# ─── ANUBIS PoW wall — 11 sources La Referencia proxies ──────────────────
# Probe directo a https://www.lareferencia.info/vufind/api/1/search/...rm=...
# Anubis challenge = HTML response starting with '<' or containing 'Making sure you're not a bot'
Write-Host "── 11 Anubis PoW wall (BL-01) ──" -ForegroundColor Yellow

$probeAnubis = {
    param($filter)
    $url = "https://www.lareferencia.info/vufind/api/1/search?lookfor=cancer&type=all&filter%5B%5D=network_acronym_str%3A$filter&prettyPrint=false&limit=3"
    Test-Source -SourceId "laref_$filter" -Url $url -Notes "Anubis PoW"
}

$anubisFilters = @('PE', 'MX', 'AR', 'CL', 'CO', 'BR', 'EC', 'ES', 'CR', 'UY', 'SV')
foreach ($f in $anubisFilters) {
    $id = if ($f -eq 'PE') { 'laref_peru' } elseif ($f -eq 'MX') { 'laref_mexico' } elseif ($f -eq 'AR') { 'laref_argentina' } elseif ($f -eq 'CL') { 'laref_chile' } elseif ($f -eq 'CO') { 'laref_colombia' } elseif ($f -eq 'BR') { 'laref_brasil' } elseif ($f -eq 'EC') { 'laref_ecuador' } elseif ($f -eq 'ES') { 'espana' } elseif ($f -eq 'CR') { 'costarica' } elseif ($f -eq 'UY') { 'uruguay' } elseif ($f -eq 'SV') { 'elsalvador' } else { "laref_$f" }
    $url = "https://www.lareferencia.info/vufind/api/1/search?lookfor=cancer&type=all&filter%5B%5D=network_acronym_str%3A$f&prettyPrint=false&limit=3"
    $r = Test-Source -SourceId $id -Url $url -Notes "Anubis PoW (BL-01)"
    $results += $r
    Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f $id, $r.status, $r.length, $r.verdict, $r.duration_ms)
}

# Generic La Referencia (no filter)
$r = Test-Source -SourceId 'lareferencia' -Url 'https://www.lareferencia.info/vufind/api/1/search?lookfor=cancer&type=all&prettyPrint=false&limit=3' -Notes 'Anubis no-filter (BL-01)'
$results += $r
Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f 'lareferencia', $r.status, $r.length, $r.verdict, $r.duration_ms)

# ─── Redalyc SPA HTML (BL-02) ────────────────────────────────────────────
Write-Host "`n── Redalyc (BL-02) ──" -ForegroundColor Yellow
$r = Test-Source -SourceId 'redalyc' -Url 'https://www.redalyc.org/busquedaArticuloFiltros.oa?año=2024&p=1&q=cancer' -Notes 'SPA HTML (BL-02)'
$results += $r
Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f 'redalyc', $r.status, $r.length, $r.verdict, $r.duration_ms)

# Try alternative: new Redalyc Public API
$r = Test-Source -SourceId 'redalyc_new_api' -Url 'https://www.redalyc.org/oai.redalyc/request?verb=ListRecords&metadataPrefix=oai_dc&set=revistas' -Notes 'OAI-PMH nuevo endpoint (BL-02 alt)'
$results += $r
Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f 'redalyc_new_api', $r.status, $r.length, $r.verdict, $r.duration_ms)

# ─── SNRD/BDU SPA HTML (BL-03) ───────────────────────────────────────────
Write-Host "`n── SNRD Argentina (BL-03) ──" -ForegroundColor Yellow
$r = Test-Source -SourceId 'snrd' -Url 'http://bdu.siu.edu.ar/api/v1/search?q=cancer&page=1&size=3' -Notes 'SPA HTML (BL-03)'
$results += $r
Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f 'snrd', $r.status, $r.length, $r.verdict, $r.duration_ms)

# Try DSpace 7 Site Search
$r = Test-Source -SourceId 'snrd_alt_dspace7' -Url 'http://bdu.siu.edu.ar/server/api/discover/search/objects?query=cancer&size=3' -Notes 'DSPace7 alt (BL-03)'
$results += $r
Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f 'snrd_alt_dspace7', $r.status, $r.length, $r.verdict, $r.duration_ms)

# ─── ANID Chile SPA HTML (BL-04) ─────────────────────────────────────────
Write-Host "`n── ANID Chile (BL-04) ──" -ForegroundColor Yellow
$r = Test-Source -SourceId 'anid' -Url 'http://repositorio.anid.cl/rest/items/find-by-metadata-field' -Method POST -Body '{"key":"dc.subject","value":"cancer","language":"es"}' -Headers @{ 'Accept' = 'application/json' } -Notes 'SPA HTML retired REST (BL-04)'
$results += $r
Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f 'anid', $r.status, $r.length, $r.verdict, $r.duration_ms)

# Try publicacion ANID new endpoint
$r = Test-Source -SourceId 'anid_alt_dspace7' -Url 'http://repositorio.anid.cl/server/api/discover/search/objects?query=cancer&size=3' -Notes 'DSPace7 alt (BL-04)'
$results += $r
Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f 'anid_alt_dspace7', $r.status, $r.length, $r.verdict, $r.duration_ms)

# ─── CONACYT México API retirada (BL-05) ──────────────────────────────────
Write-Host "`n── CONACYT México (BL-05) ──" -ForegroundColor Yellow
$r = Test-Source -SourceId 'conacyt' -Url 'http://repositorio.conacyt.mx/rest/items/find-by-metadata-field' -Method POST -Body '{"key":"dc.subject","value":"cancer","language":"es"}' -Headers @{ 'Accept' = 'application/json' } -Notes 'REST API removed (BL-05)'
$results += $r
Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f 'conacyt', $r.status, $r.length, $r.verdict, $r.duration_ms)

# Try DSpace 7 at conacyt
$r = Test-Source -SourceId 'conacyt_alt_dspace7' -Url 'http://repositorio.conacyt.mx/server/api/discover/search/objects?query=cancer&size=3' -Notes 'DSPace7 alt (BL-05)'
$results += $r
Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f 'conacyt_alt_dspace7', $r.status, $r.length, $r.verdict, $r.duration_ms)

# ─── Re-test FIXED sources (regression check) ────────────────────────────
Write-Host "`n── Regressiones fix fixes previos (BL-06/07/08/09) ──" -ForegroundColor Green

# BL-06 OpenReview
$r = Test-Source -SourceId 'openreview_v1' -Url 'https://api.openreview.net/notes/search?term=reinforcement+learning&content=all&source=forum&limit=3' -Notes 'Regression BL-06'
$results += $r
Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f 'openreview_v1', $r.status, $r.length, $r.verdict, $r.duration_ms)

# BL-08 MinCiencias
$r = Test-Source -SourceId 'minciencias' -Url 'https://repositorio.minciencias.gov.co/server/api/discover/search/objects?query=cancer&size=3' -Notes 'Regression BL-08'
$results += $r
Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f 'minciencias', $r.status, $r.length, $r.verdict, $r.duration_ms)

# BL-07 OpenAlex free endpoint (rate limit check)
$r = Test-Source -SourceId 'openalex_api' -Url 'https://api.openalex.org/works?search=cancer&per-page=1&mailto=letxipu@dev.invalid' -Notes 'Regression BL-07'
$results += $r
Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f 'openalex_api', $r.status, $r.length, $r.verdict, $r.duration_ms)

# BL-09 CORE
$coreKey = $env:CORE_API_KEY
if (-not $coreKey) {
    # Try to load .env
    $envFile = Join-Path $PSScriptRoot '..\.env'
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^\s*([^#=]+)\s*=\s*(.*)$') {
                [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
            }
        }
        $coreKey = $env:CORE_API_KEY
    }
}
if ($coreKey) {
    $r = Test-Source -SourceId 'core_v3' -Url 'https://api.core.ac.uk/v3/search/works/?q=cancer+research&limit=3' -Headers @{ 'Authorization' = "Bearer $coreKey"; 'Accept' = 'application/json' } -Notes 'Regression BL-09'
    $results += $r
    Write-Host ("  {0,-18} status={1,-3} len={2,-6} verdict={3,-12} time={4}ms" -f 'core_v3', $r.status, $r.length, $r.verdict, $r.duration_ms)
} else {
    Write-Host "  core_v3                SKIPPED (CORE_API_KEY no encontrada)"
}

# ─── Aggregate ────────────────────────────────────────────────────────────
Write-Host "`n── Resumen ──" -ForegroundColor Cyan
$grouped = $results | Group-Object -Property verdict
foreach ($g in $grouped) {
    Write-Host ("  {0,-12}: {1} sources" -f $g.Name, $g.Count)
    if ($g.Name -eq 'RECOVERED') { $recovered = $g.Count }
    elseif ($g.Name -eq 'STILL_EMPTY') { $stillEmpty = $g.Count }
    else { $unclear += $g.Count }
}

# Categorize RECOVERED: regression_ok (was previously fixed) vs newly_recovered (BL-01 to BL-05 backlog)
$regressionOk = ($results | Where-Object { $_.verdict -eq 'RECOVERED' -and $_.notes -like 'Regression*' }).Count
$newlyRecovered = ($results | Where-Object { $_.verdict -eq 'RECOVERED' -and $_.notes -notlike 'Regression*' }).Count

$totalTested = $results.Count
$percentageRecovered = $(if ($totalTested -gt 0) { [Math]::Round(($recovered / $totalTested) * 100, 1) } else { 0 })
Write-Host "`nTotal tested: $totalTested"
Write-Host "RECOVERED: $recovered ($percentageRecovered%)"
Write-Host "  - Regression-OK (fixes previos intactos): $regressionOk"
Write-Host "  - Newly-recovered (backlog items now work): $newlyRecovered"
Write-Host "STILL_EMPTY: $stillEmpty"
Write-Host "UNCLEAR: $unclear"

# If 3+ sources newly recovered (NOT regression): recommend running pool v5
if ($newlyRecovered -ge 3) {
    Write-Host "`n!! ALERTA: 3+ backlog sources NUEVAMENTE recuperados. Se recomienda lanzar pool v5 sistemático." -ForegroundColor Red
    Write-Host "Sources nuevos recuperados:"
    $results | Where-Object { $_.verdict -eq 'RECOVERED' -and $_.notes -notlike 'Regression*' } | ForEach-Object {
        Write-Host (" - {0} ({1}) -> {2}" -f $_.source, $_.notes, $_.url)
    }
} elseif ($regressionOk -gt 0) {
    Write-Host "`n[OK] Regression OK: $regressionOk fixes previos siguen operativos (no regression breakdown)." -ForegroundColor Green
}

# Show UNCLEAR for manual review
if ($unclear -gt 0) {
    Write-Host "`n!! UNCLEAR sources -- revision manual recomendada (ver body_sample):" -ForegroundColor Yellow
    $results | Where-Object { $_.verdict -eq 'UNCLEAR' } | ForEach-Object {
        Write-Host (" - {0} ({1})" -f $_.source, $_.notes)
        Write-Host ("     URL: {0}" -f $_.url)
        Write-Host ("     Body: {0}" -f $_.body_sample.Substring(0, [Math]::Min(120, $_.body_sample.Length)))
    }
}

# ─── Save JSON log ────────────────────────────────────────────────────────
$timestamp = (Get-Date -Format 'yyyyMMdd-HHmmss')
$logFile = Join-Path $PSScriptRoot "retest-backlog-results-$timestamp.json"
$results | ConvertTo-Json -Depth 4 | Out-File -FilePath $logFile -Encoding UTF8
Write-Host "`nLog guardado en: $logFile" -ForegroundColor Green

# ─── Append SUMMARY to HITOS.log ──────────────────────────────────────────
$hitosLog = Join-Path $PSScriptRoot '..\HITOS.log'
if (Test-Path $hitosLog) {
    $summary = "[$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm'))] BL-10 retest mensual ejecutado: $totalTested tested, $recovered RECOVERED, $stillEmpty STILL_EMPTY, $unclear UNCLEAR. Log: $(Split-Path $logFile -Leaf)"
    Add-Content -Path $hitosLog -Value $summary -Encoding UTF8
    Write-Host "HITOS.log actualizado con resumen" -ForegroundColor Green
}

Write-Host "`n=== BL-10 retest completo ===`n" -ForegroundColor Cyan
