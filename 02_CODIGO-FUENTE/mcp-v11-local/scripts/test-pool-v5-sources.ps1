<#
.SYNOPSIS
  Pool v5: Test standalone de cada una de las 38/39 sources de V11.1
.DESCRIPTION
  Hace 1 query a cada source directamente via /api/search con sources=["<id>"]
  Captura: status HTTP, count returned, latency ms, error si lo hay
  Anuncia regression/PERMANENT_EMPTY vs NEWLY_BROKEN
.PARAMETER Query
  Query académica a probar cada source (defaulto "cancer research" multi-token)
.PARAMETER TimeoutSec
  Timeout por probe (default 120 para CORE latencia variable)
.PARAMETER OutFile
  Ruta de salida JSON log (default auto-timestamped)
.EXAMPLE
  .\test-pool-v5-sources.ps1 -Query "renewable energy" -TimeoutSec 120
#>

[CmdletBinding()]
param(
    [string]$Query = 'renewable energy',
    [int]$TimeoutSec = 120,
    [string]$BaseUrl = 'http://localhost:4003',
    [string]$OutFile = ''
)

$env:PYTHONIOENCODING = 'utf-8'
$ErrorActionPreference = 'Continue'  # Let try/catch handle per-source errors

if (-not $OutFile) {
    $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
    $slug = ($Query -replace '\s+', '-' -replace '[^a-z0-9-]', '').ToLower()
    $OutFile = "D:\OTROS\LETXIPU-SEARCH-MCP-V11\scripts\pool-v5-${slug}-${ts}.json"
}

Write-Host "=== Pool v5: Test standalone de sources ===" -ForegroundColor Cyan
Write-Host "Query: '$Query'"
Write-Host "Timeout/probe: ${TimeoutSec}s"
Write-Host "Base URL: $BaseUrl"
Write-Host "Out file: $OutFile"
Write-Host ""

# Confirmar V11.1 arriba
try {
    $h = Invoke-WebRequest -Uri "$BaseUrl/health" -TimeoutSec 10 -UseBasicParsing
    $hContent = if ($h.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($h.Content) } else { $h.Content }
    $hj = $hContent | ConvertFrom-Json
    Write-Host "V11.1 salud: $($hj.status) v$($hj.version) tools=$($hj.tools)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: V11.1 no responde en $BaseUrl -- arranca con start_v11.bat" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)"
    exit 1
}

Write-Host ""

# Cargar catálogo de sources
$src = Invoke-WebRequest -Uri "$BaseUrl/api/sources" -TimeoutSec 10 -UseBasicParsing
$srcS = if ($src.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($src.Content) } else { $src.Content }
$sources = ($srcS | ConvertFrom-Json).data.sources
Write-Host "Sources configuradas: $($sources.Count)" -ForegroundColor Cyan
Write-Host ""

# Cargar baseline pool v4 (si existe)
$baselineFile = "D:\OTROS\LETXIPU-SEARCH-MCP-V11\scripts\pool-v5-baseline-v4.json"
$baseline = @{}
if (Test-Path $baselineFile) {
    $baseline = (Get-Content $baselineFile -Raw | ConvertFrom-Json).results
    Write-Host "Baseline pool v4 cargado: $($baseline.Count) sources"
} else {
    Write-Host "Baseline pool v4 no existe -- creando baseline nuevo"
}
Write-Host ""

$results = @()
$pass = 0
$emptyCount = 0
$brokenCount = 0
$startTime = Get-Date

foreach ($s in $sources) {
    $id = $s.id
    $name = $s.name
    $country = $s.country

    $r = [ordered]@{
        source = $id
        name = $name
        country = $country
        query = $Query
        httpStatus = 0
        returnedCount = 0
        latencyMs = 0
        error = ''
    }

    $body = @{
        query = $Query
        sources = @($id)
        maxSources = 1
        maxResults = 5
        fastMode = $true
    } | ConvertTo-Json -Compress

    $t0 = Get-Date
    try {
        $resp = Invoke-WebRequest -Uri "$BaseUrl/api/search" -Method POST `
            -Body $body -ContentType 'application/json' `
            -TimeoutSec $TimeoutSec -UseBasicParsing
        $r.httpStatus = [int]$resp.StatusCode

        $cStr = if ($resp.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($resp.Content) } else { $resp.Content }
        $j = $cStr | ConvertFrom-Json
        # /api/search response shape: {success, data: {sources[], stats, total, totalBeforeDedup}}
        $count = 0
        if ($j.data -and $j.data.sources) { $count = @($j.data.sources).Count }
        elseif ($j.data -and $j.data.results) { $count = @($j.data.results).Count }
        elseif ($j.data -and $j.data.papers) { $count = @($j.data.papers).Count }
        elseif ($j.sources) { $count = @($j.sources).Count }
        elseif ($j.results) { $count = @($j.results).Count }
        $r.returnedCount = $count

        $t1 = Get-Date
        $r.latencyMs = [int]($t1 - $t0).TotalMilliseconds

        if ($r.httpStatus -eq 200 -and $count -gt 0) {
            $r.verdict = 'PASS'
            $pass++
            $color = 'Green'
        } elseif ($r.httpStatus -eq 200 -and $count -eq 0) {
            # Sample-only / source off-line
            $r.verdict = 'EMPTY'
            $emptyCount++
            $color = 'Yellow'
        } else {
            $r.verdict = 'BROKEN'
            $brokenCount++
            $color = 'Red'
        }
    } catch {
        $t1 = Get-Date
        $r.latencyMs = [int]($t1 - $t0).TotalMilliseconds
        $r.error = $_.Exception.Message
        $r.verdict = 'BROKEN'
        $brokenCount++
        $color = 'Red'
    }

    $results += [PSCustomObject]$r
    Write-Host ("  {0,-20} http={1,3} count={2,4} {3,5}ms  {4}" -f $id, $r.httpStatus, $r.returnedCount, $r.latencyMs, $r.verdict) -ForegroundColor $color
}

$endTime = Get-Date
$totalSecs = [int]($endTime - $startTime).TotalSeconds

# Resumen
Write-Host ""
Write-Host "=== RESUMEN POOL v5 ($(Get-Date -Format 'yyyy-MM-dd HH:mm')) ===" -ForegroundColor Cyan
Write-Host "Total sources: $($sources.Count)"
Write-Host "Query: '$Query' (fastMode=true)"
Write-Host "PASS: $pass (ratio=$([Math]::Round($pass*100.0/$sources.Count,1))%)"
Write-Host "EMPTY: $emptyCount (HTTP 200 + 0 results -- source offline/empty backend)"
Write-Host "BROKEN: $brokenCount (HTTP error or timeout)"
Write-Host "Total wall: ${totalSecs}s"

# Comparar con baseline si tenemos
if ($baseline.Count -gt 0) {
    Write-Host ""
    Write-Host "=== DELTAS vs baseline pool v4 ===" -ForegroundColor Cyan
    $newlyBroken = @()
    $newlyRecovered = @()
    foreach ($r in $results) {
        $b = $baseline | Where-Object { $_.source -eq $r.source } | Select-Object -First 1
        if ($b) {
            if ($b.verdict -ne $r.verdict) {
                if ($r.verdict -in @('EMPTY','BROKEN') -and $b.verdict -eq 'PASS') {
                    $newlyBroken += $r.source
                } elseif ($r.verdict -eq 'PASS' -and $b.verdict -ne 'PASS') {
                    $newlyRecovered += $r.source
                }
            }
        } else {
            Write-Host "  Source NUEVO no en baseline: $($r.source)"
        }
    }
    if ($newlyBroken.Count -gt 0) { Write-Host "  NEWLY_BROKEN: $($newlyBroken -join ', ')" -ForegroundColor Red }
    if ($newlyRecovered.Count -gt 0) { Write-Host "  NEWLY_RECOVERED: $($newlyRecovered -join ', ')" -ForegroundColor Green }
    if ($newlyBroken.Count -eq 0 -and $newlyRecovered.Count -eq 0) { Write-Host "  No deltas -- estable vs baseline" }
}

# Tabla final
Write-Host ""
Write-Host "=== Tabla final ===" -ForegroundColor Cyan
$results | Format-Table source, httpStatus, returnedCount, latencyMs, verdict -AutoSize

# Guardar JSON
$out = [ordered]@{
    test_timestamp = (Get-Date).ToString('o')
    query = $Query
    base_url = $BaseUrl
    timeout_sec = $TimeoutSec
    wall_time_sec = $totalSecs
    total_sources = $sources.Count
    pass = $pass
    empty = $emptyCount
    broken = $brokenCount
    results = $results
}
$out | ConvertTo-Json -Depth 5 | Out-File -FilePath $OutFile -Encoding UTF8

# Guardar NUEVO baseline (si no existe) para futuras comparaciones
if (-not (Test-Path $baselineFile)) {
    $bl = [ordered]@{
        results = $results
        created = (Get-Date).ToString('o')
        query = $Query
    }
    $bl | ConvertTo-Json -Depth 4 | Out-File -FilePath $baselineFile -Encoding UTF8
    Write-Host ""
    Write-Host "Baseline pool v5 guardado en: $baselineFile" -ForegroundColor Green
}

Write-Host ""
Write-Host "Log JSON guardado en: $OutFile" -ForegroundColor Green
Write-Host "=== Pool v5 completo ===" -ForegroundColor Cyan
