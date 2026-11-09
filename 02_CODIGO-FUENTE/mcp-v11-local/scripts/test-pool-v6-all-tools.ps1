# =============================================================================
# Pool v6 — TEST ALL MCP TOOLS (not just search-based)
# -----------------------------------------------------------------------------
# Probes every active MCP tool (28 - 4 deprecated = 24 active probes) via
# JSON-RPC 2.0 against http://localhost:4003/api/mcp. Multiple runs expose
# flakiness/transient failures. Outputs JSON log + Markdown summary.
#
# Categories:
#   - search    : search, batch_search, smart_search (deprecated-skip)
#   - discovery : list_sources, health_check, coverage_report, help
#   - repos     : search_paperswithcode, search_conferences, search_dblp (dep),
#                 trending_papers
#   - metadata  : enrich_metadata, fetch_metadata (dep), recover_metadata (dep)
#   - pdf       : download_pdf, resolve_pdf, read_pdf, read_pdf_markdown,
#                 pdf_metadata, pdf_sections (dep), pdf_citations,
#                 pdf_smart_summary
#   - analysis  : analyze_academic, extract_section, extract_tables,
#                 extract_formulas, convert_document, batch_convert
#
# Result classification:
#   PASS    : 200 OK with non-empty, well-shaped result (count > 0 for lists)
#   WARN    : 200 OK but empty / partial / signal field present
#   FAIL    : HTTP non-200 or JSON-RPC error response
#   TIMEOUT : > 180s
#   EMPTY   : 200 OK with explicit empty list / zero rows
#   SKIPPED : deprecated tool intentionally skipped
# =============================================================================
[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://localhost:4003',
    [int]$TimeoutSec = 180,
    [int]$Runs = 3,
    [string]$OutDir = $PSScriptRoot,
    [switch]$SkipDeprecated
)

$env:PYTHONIOENCODING = 'utf-8'
$ErrorActionPreference = 'Continue'

# --- Fixtures (small, stable, open-access where possible) ---
$QUERY_A        = 'renewable energy'
$QUERY_B        = 'cancer research'
$QUERY_AI       = 'transformer attention'

# arxiv 1706.03762 (Attention is all you need) ~7.7MB / 15pp
$PDF_URL        = 'https://arxiv.org/pdf/1706.03762'
# arxiv 1810.04805 (BERT) ~4.5MB
$PDF_URL_ALT    = 'https://arxiv.org/pdf/1810.04805'

# DOI stable (Nature open abstract)
$DOI_NATURE     = '10.1038/nature12373'

# --- Tool probe definitions ---
# Each probe: { name, args, classify (optional custom) }
# `args` is the JSON-RPC `params.arguments` payload.
# NOTE: Each entry uses `argsJson` (string) — ConvertFrom-Json gives us a clean
# [hashtable]/[PSCustomObject] per probe. PSAvoids PS 5.1 nested-hashtable flattening.
$PROBES_JSON = @(
    @{ name='search'; argsJson='{"query":"renewable energy","maxResults":5}'; expect='results' }
    @{ name='batch_search'; argsJson='{"queries":["renewable energy","cancer research"],"maxResults":3}'; expect='per_query' }
    # smart_search = DEPRECATED

    # === discovery ===
    @{ name='list_sources'; argsJson='{}'; expect='sources' }
    @{ name='health_check'; argsJson='{}'; expect='status' }
    @{ name='coverage_report'; argsJson='{}'; expect='countries' }
    @{ name='help'; argsJson='{"topic":"all"}'; expect='tools' }

    # === repo discovery ===
    @{ name='search_paperswithcode'; argsJson='{"query":"transformer attention","maxResults":5}'; expect='papers' }
    @{ name='search_conferences'; argsJson='{"query":"attention","maxResults":5}'; expect='conferences' }
    @{ name='trending_papers'; argsJson='{"maxResults":5}'; expect='papers' }
    # search_dblp = DEPRECATED

    # === metadata ===
    # Use an Unpaywall-friendly open DOI (arxiv mirror) to avoid long chains
    @{ name='enrich_metadata'; argsJson='{"papers":[{"doi":"10.48550/arxiv.1706.03762"}]}'; expect='enriched' }
    # fetch_metadata = DEPRECATED
    # recover_metadata = DEPRECATED

    # === pdf resolve / read ===
    @{ name='download_pdf'; argsJson='{"doi":"10.1038/nature12373"}'; expect='url' }
    @{ name='resolve_pdf'; argsJson='{"identifier":"10.1038/nature12373"}'; expect='resolved_url' }

    @{ name='pdf_metadata'; argsJson='{"source":"https://arxiv.org/pdf/1706.03762"}'; expect='metadata' }
    @{ name='pdf_citations'; argsJson='{"source":"https://arxiv.org/pdf/1706.03762"}'; expect='citations' }
    @{ name='pdf_smart_summary'; argsJson='{"source":"https://arxiv.org/pdf/1706.03762","maxTotalChars":2000}'; expect='summary' }
    # pdf_sections = DEPRECATED

    # === pdf text / extract ===
    @{ name='read_pdf'; argsJson='{"source":"https://arxiv.org/pdf/1706.03762","maxChars":2000}'; expect='text' }
    @{ name='read_pdf_markdown'; argsJson='{"source":"https://arxiv.org/pdf/1706.03762","maxChars":2000}'; expect='markdown' }
    @{ name='extract_section'; argsJson='{"source":"https://arxiv.org/pdf/1706.03762","section":"abstract"}'; expect='section' }
    @{ name='extract_tables'; argsJson='{"source":"https://arxiv.org/pdf/1706.03762"}'; expect='tables' }
    @{ name='extract_formulas'; argsJson='{"source":"https://arxiv.org/pdf/1706.03762"}'; expect='formulas' }

    # === document conversion ===
    @{ name='convert_document'; argsJson='{"source":"https://arxiv.org/pdf/1706.03762","maxChars":2000}'; expect='markdown' }
    @{ name='batch_convert'; argsJson='{"sources":["https://arxiv.org/pdf/1706.03762"],"maxCharsPerDoc":2000}'; expect='batch_results' }

    # === academic analysis ===
    @{ name='analyze_academic'; argsJson='{"source":"https://arxiv.org/pdf/1706.03762"}'; expect='analysis' }
) | ForEach-Object { [PSCustomObject]$_ }
$PROBES = $PROBES_JSON

# --- Deprecated tools (intentionally skipped but listed) ---
$DEPRECATED = @('smart_search','pdf_sections','search_dblp','fetch_metadata','recover_metadata')

# --- Helpers ---
function Invoke-Mcp([string]$toolName, [string]$argsJson) {
    # Robust id: use a simple monotonic counter kept in module scope
    if (-not $script:McpIdCounter) { $script:McpIdCounter = 1000 }
    $script:McpIdCounter += 1
    $bodyObj = @{
        jsonrpc = '2.0'
        id = $script:McpIdCounter
        method = 'tools/call'
        params = @{ name=$toolName; arguments=(ConvertFrom-Json $argsJson) }
    }
    $body = $bodyObj | ConvertTo-Json -Depth 10 -Compress

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $r = Invoke-WebRequest -Uri "$BaseUrl/api/mcp" -Method POST `
            -Body $body -ContentType 'application/json; charset=utf-8' `
            -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
        $sw.Stop()
        $ms = [int]$sw.ElapsedMilliseconds

        $contentStr = if ($r.Content -is [byte[]]) {
            [System.Text.Encoding]::UTF8.GetString($r.Content)
        } else { $r.Content }

        return [PSCustomObject]@{
            http = $r.StatusCode
            ms = $ms
            body = $contentStr
            error = $null
        }
    } catch {
        $sw.Stop()
        $ms = [int]$sw.ElapsedMilliseconds
        $err = $_.Exception.Message
        # Detect timeout specifically
        $isTimeout = $err -match 'timed? ?out|operation has timed'
        return [PSCustomObject]@{
            http = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
            ms = $ms
            body = $null
            error = $err
            timeout = $isTimeout
        }
    }
}

function Classify([string]$toolName, [string]$expect, $resp) {
    # Default classification buckets
    if ($resp.error -and $resp.timeout) { return 'TIMEOUT' }
    if ($resp.error) { return 'FAIL' }
    if ($resp.http -ne 200) { return "HTTP_$($resp.http)" }

    $json = $null
    try {
        $json = $resp.body | ConvertFrom-Json -ErrorAction Stop
    } catch {
        return 'FAIL_PARSE'
    }

    # JSON-RPC error?
    if ($json.error) {
        $code = $json.error.code
        if ($code -eq -32601) { return 'NOT_IMPLEMENTED' }
        return "RPC_ERROR($code)"
    }

    # Extract result content from tools/call envelope:
    # { result: { content: [ { type:'text', text:'...' } ] } }
    $text = $null
    if ($json.result -and $json.result.content -and $json.result.content.Count -gt 0) {
        $text = $json.result.content[0].text
    } elseif ($json.result -is [string]) {
        $text = $json.result
    } elseif ($json.result) {
        $text = $json.result | ConvertTo-Json -Depth 5 -Compress
    }
    if (-not $text) { $text = $resp.body }

    if ($text -eq '' -or $text -eq '[]' -or $text -eq '{}') { return 'EMPTY' }

    # Heuristics per expected shape
    switch ($expect) {
        'results'        { if ($text -match '"paperId"|"doi"|"title"|"abstract"') { return 'PASS' } else { return 'WARN_NO_FIELDS' } }
        'per_query'      { if ($text -match 'results' -and $text -match 'queries') { return 'PASS' } else { return 'WARN' } }
        'sources'        { if ($text -match 'source[A-Z]?[Ii]d|"id"|"name"|"category"') { return 'PASS' } else { return 'WARN' } }
        'status'         { if ($text -match '"status":"?ok"?' -or $text -match 'ok') { return 'PASS' } else { return 'WARN' } }
        'countries'      { if ($text -match 'country|countries|source') { return 'PASS' } else { return 'WARN' } }
        'tools'          { if ($text -match 'tool|search|pdf') { return 'PASS' } else { return 'WARN' } }
        'papers'         { if ($text -match '"paper"|"repository"|"title"' -or $text -match 'papers') { return 'PASS' } else { return 'WARN_NO_FIELDS' } }
        'conferences'    { if ($text -match 'conference|forum|poster|paper') { return 'PASS' } else { return 'WARN_NO_FIELDS' } }
        'enriched'       { if ($text -match '"doi"|"title"|"abstract"' -and $text.Length -gt 200) { return 'PASS' } elseif ($text -match 'doi') { return 'WARN_PARTIAL' } else { return 'EMPTY' } }
        'url'            { if ($text -match 'https?://') { return 'PASS' } else { return 'WARN_NO_URL' } }
        'resolved_url'   { if ($text -match '"resolvedUrl"|"pdfUrl"|"url"') { return 'PASS' } elseif ($text -match 'https?://') { return 'WARN_PARTIAL' } else { return 'WARN_NO_URL' } }
        'metadata'       { if ($text -match '"title"|"pageCount"|"author"|"created"|"size"') { return 'PASS' } else { return 'WARN_NO_FIELDS' } }
        'citations'      { if ($text -match '"references"|"citations"|"[0-9]+"' -and $text -match '\[') { return 'PASS' } else { return 'EMPTY' } }
        'summary'        { if ($text.Length -gt 500) { return 'PASS' } elseif ($text.Length -gt 100) { return 'WARN_SHORT' } else { return 'EMPTY' } }
        'text'           { if ($text.Length -gt 500) { return 'PASS' } elseif ($text.Length -gt 100) { return 'WARN_SHORT' } else { return 'EMPTY' } }
        'markdown'       {
            # MinerU / markitdown returns markdown. Accept: '#', '**', '|...|', '- ', '* [', '##'].
            # Even pure paragraphs are valid markdown (after MinerU layout pass).
            if ($text -match '#|\*\*|\|.*\||^- |^\* |^---|^##|^1\.') { return 'PASS' }
            elseif ($text.Length -gt 500) { return 'PASS_TEXT_ONLY' }
            elseif ($text.Length -gt 200) { return 'WARN_SHORT' }
            else { return 'EMPTY' }
        }
        'section'        { if ($text -match 'abstract|introduc|method') { return 'PASS' } elseif ($text.Length -gt 500) { return 'WARN_GENERIC' } else { return 'EMPTY' } }
        'tables'         { if ($text -match '<table|\|.*\||<tr') { return 'PASS' } else { return 'EMPTY' } }
        'formulas'       { if ($text -match '\\\\|\$.*\$|equation|\$\$') { return 'PASS' } else { return 'EMPTY' } }
        'batch_results'  {
            # batch_convert shape: { success:true, data:{ results:[{...}] } }.
            if ($text -match '"results"\s*:\s*\[' -or $text -match '"per_query"') { return 'PASS' }
            elseif ($text -match '"success"\s*:\s*true' -and $text.Length -gt 100) { return 'PASS' }
            elseif ($text -match 'markdown|success|json' -and $text.Length -gt 200) { return 'WARN_GENERIC' }
            elseif ($text.Length -gt 100) { return 'WARN' }
            else { return 'EMPTY' }
        }
        'analysis'       { if ($text -match '"documentType"|"language"|"sections"|"stats"') { return 'PASS' } else { return 'WARN_NO_FIELDS' } }
        default          { if ($text.Length -gt 100) { return 'PASS' } else { return 'WARN' } }
    }
}

# --- Main ---
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $OutDir "pool-v6-all-tools-$runStamp.json"
$mdFile  = Join-Path $OutDir "pool-v6-all-tools-$runStamp.md"

Write-Host '=========================================='
Write-Host " Pool v6 - test ALL active MCP tools"
Write-Host '=========================================='
Write-Host " Base URL : $BaseUrl"
Write-Host " Timeout  : ${TimeoutSec}s per probe"
Write-Host " Runs     : $Runs"
Write-Host " Active   : $($PROBES.Count) tools"
Write-Host " Skip dep : $($PSBoundParameters.ContainsKey('SkipDeprecated'))"
Write-Host " Log file : $logFile"
Write-Host ''

$allResults = @()

for ($run = 1; $run -le $Runs; $run++) {
    Write-Host ''
    Write-Host "===== RUN $run / $Runs ====="
    $runNum = 0
    foreach ($probe in $PROBES) {
        $runNum++
        $tool = $probe.name
        $argsJson = $probe.argsJson
        $expect = $probe.expect
        Write-Host ("[R$run P{0,2}/{1}] {2,-22}" -f $runNum, $PROBES.Count, $tool) -NoNewline
        $resp = Invoke-Mcp $tool $argsJson
        $verdict = Classify $tool $expect $resp
        Write-Host (" -> {0,-12} ({1} ms)  err={2}" -f $verdict, $resp.ms, ($resp.error -ne $null))

        $allResults += [PSCustomObject]@{
            run     = $run
            tool    = $tool
            verdict = $verdict
            ms      = $resp.ms
            http    = $resp.http
            expect  = $expect
            error   = $resp.error
            bodySample = if ($resp.body) { $resp.body.Substring(0, [Math]::Min(300, $resp.body.Length)) } else { $null }
        }
    }
}

# === Markdown summary ===
$summary = $allResults | Group-Object tool, verdict | Select-Object @{N='tool';E={$_.Group[0].tool}}, @{N='verdict';E={$_.Group[0].verdict}}, Count
$toolSummary = $allResults | Group-Object tool | ForEach-Object {
    $tool = $_.Name
    $verdicts = $_.Group | Group-Object verdict | Select-Object @{N='v';E={$_.Name}}, Count
    $avgMs = [int](($_.Group | Measure-Object ms -Average).Average)
    $passCount = ($_.Group | Where-Object { $_.verdict -eq 'PASS' }).Count
    [PSCustomObject]@{
        tool = $tool
        runs = $_.Count
        pass = $passCount
        avg_ms = $avgMs
        verdicts = ($verdicts | ForEach-Object { "($($_.v)=$($_.Count))" }) -join ' '
    }
}

$md = @"
# Pool v6 — all MCP tools test report

Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Base URL: $BaseUrl
Runs: $Runs
Active tools tested: $($PROBES.Count)
Deprecated (skipped if -SkipDeprecated): $($DEPRECATED -join ', ')

## Summary per tool

| Tool | Runs | PASS | Avg ms | Verdicts |
|------|------|------|--------|----------|
$(( $toolSummary | ForEach-Object { "| $($_.tool) | $($_.runs) | $($_.pass) | $($_.avg_ms) | $($_.verdicts) |" } ) -join "`n")

## Aggregated verdicts

| Verdict | Count |
|---------|-------|
$(( $allResults | Group-Object verdict | Sort-Object Count -Descending | ForEach-Object { "| $($_.Name) | $($_.Count) |" } ) -join "`n")

## Deprecated tools (intentionally skipped)

$($DEPRECATED | ForEach-Object { "- $_" } | Out-String)
"@

$md | Out-File -FilePath $mdFile -Encoding utf8 -NoNewline

# === JSON log ===
$allResults | ConvertTo-Json -Depth 6 | Out-File -FilePath $logFile -Encoding utf8 -NoNewline

Write-Host ''
Write-Host '=========================================='
Write-Host ' Pool v6 DONE'
Write-Host '=========================================='
Write-Host "Total probes : $($allResults.Count)"
$agg = $allResults | Group-Object verdict | Sort-Object Count -Descending
Write-Host 'Aggregated verdicts:'
$agg | ForEach-Object { Write-Host ("  {0,-14} {1}" -f $_.Name, $_.Count) }
Write-Host ''
Write-Host "Markdown: $mdFile"
Write-Host "JSON log: $logFile"

# Save final summary block to stdout for README ingestion
$toolSummary | Format-Table -AutoSize | Out-String | Write-Host
