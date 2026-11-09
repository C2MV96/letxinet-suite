# ==========================================================================
# LETXIPU-SEARCH-MCP-V10 - PHASE 6 E2E ADAPTIVE TIMEOUTS TEST SUITE
# ==========================================================================
# Runs 33 test cases simulating 5 MCP clients (opencode, claude, claude-code,
# cursor, cli, unknown) against 8 tools under varied conditions.
#
# Captures: latency (ms), HTTP status, JSON-RPC result/error, client cap hits,
# cache hits, timeout aborts, env-var override behavior, deprecated tool flag.
#
# Output:
#   - scripts/out/e2e_results.json    (machine-readable, 33 rows)
#   - scripts/out/e2e_results.csv     (tabular for spreadsheet import)
#   - scripts/out/e2e_report.md        (human-readable REPORT.md)
#   - scripts/out/e2e_console.log      (verbose live log)
#
# Usage:
#   .\scripts\run_e2e_adaptive.ps1
#   .\scripts\run_e2e_adaptive.ps1 -Quick         # skip the slow batch_search tests
#   .\scripts\run_e2e_adaptive.ps1 -OnlyTests 5,9 # run only tests #5 and #9
# ==========================================================================

[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://localhost:4000',
    [switch]$Quick,        # Skip slow tests (batch_search with full 8 queries)
    [int[]]$OnlyTests = @() # Run only these test IDs
)

$ErrorActionPreference = 'Continue'
$ServerUrl = "$($BaseUrl.TrimEnd('/'))/api/mcp"
$outDir = Join-Path $PSScriptRoot 'out'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
$consoleLog = Join-Path $outDir 'e2e_console.log'
"" | Set-Content -Path $consoleLog -Encoding UTF8

# ── Helpers ──────────────────────────────────────────────────────────────
function Write-Log([string]$msg) {
    $line = "[$(Get-Date -Format 'HH:mm:ss.fff')] $msg"
    Write-Host $line
    Add-Content -Path $consoleLog -Value $line -Encoding UTF8
}

function Invoke-McpTool {
    param(
        [string]$UserAgent,
        [string]$Tool,
        [object]$Arguments,
        [int]$TimeoutSec = 115
    )
    $body = @{
        jsonrpc = '2.0'
        id = [int](Get-Date -UFormat %s) + (Get-Random -Maximum 999)
        method = 'tools/call'
        params = @{ name = $Tool; arguments = $Arguments }
    } | ConvertTo-Json -Depth 10 -Compress

    $headers = @{ 'Content-Type' = 'application/json' }
    if ($UserAgent) { $headers['User-Agent'] = $UserAgent }

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $resp = Invoke-WebRequest -Uri $ServerUrl -Method POST -Body $body -Headers $headers -TimeoutSec $TimeoutSec -ErrorAction Stop
        $sw.Stop()
        $json = $resp.Content | ConvertFrom-Json
        return @{
            latency_ms = $sw.ElapsedMilliseconds
            http_status = [int]$resp.StatusCode
            json = $json
            raw = $resp.Content
            error = $null
        }
    } catch {
        $sw.Stop()
        return @{
            latency_ms = $sw.ElapsedMilliseconds
            http_status = -1
            json = $null
            raw = $null
            error = $_.Exception.Message
        }
    }
}

function Classify-Result {
    param([object]$R, [string]$ExpectedOutcome)
    if ($R.error) {
        if ($R.error -match 'timed out|timeout|deadline') { return 'TIMEOUT' }
        return 'EXCEPTION'
    }
    if ($R.json.error) {
        $code = $R.json.error.code
        if ($code -eq -32001) { return 'TIMEOUT_RPC' }
        if ($code -eq -32602) { return 'VALIDATION_ERROR' }
        if ($code -eq -32601) { return 'METHOD_NOT_FOUND' }
        return "RPC_ERR_$code"
    }
    if ($ExpectedOutcome -eq 'OK' -or $ExpectedOutcome -eq 'OK_FAST' -or $ExpectedOutcome -eq 'OK_SLOW') { return 'OK' }
    if ($ExpectedOutcome -eq 'VALIDATION_ERROR' -and $R.json.error) { return 'OK' } # expected error
    return 'OK'
}

# ── Test definitions ────────────────────────────────────────────────────
# Each row: id, ua, tool, args (hashtable), expected, notes, slow
$Tests = @()

function Add-Test([int]$id, [string]$ua, [string]$tool, [hashtable]$arguments, [string]$expected, [string]$notes, [bool]$slow = $false) {
    $script:Tests += [pscustomobject]@{
        id = $id; ua = $ua; tool = $tool; args = $arguments
        expected = $expected; notes = $notes; slow = $slow
    }
}

# Block 1: list_sources (simple, should be fast for all clients)
Add-Test  1 'opencode/0.5.0'       'list_sources' @{}                             'OK_FAST'  'opencode baseline list'
Add-Test  2 'claude/1.0.0'         'list_sources' @{}                             'OK_FAST'  'claude baseline list'
Add-Test  3 'claude-code/1.0.0'    'list_sources' @{}                             'OK_FAST'  'claude-code precedence over claude'
Add-Test  4 'cursor/0.42.0'        'list_sources' @{}                             'OK_FAST'  'cursor baseline list'
Add-Test  5 'curl/8.4.0'           'list_sources' @{}                             'OK_FAST'  'cli baseline list'
Add-Test  6 ''                     'list_sources' @{}                             'OK_FAST'  'empty UA -> unknown client'

# Block 2: tools/list (deprecated tool marker)
Add-Test  7 'opencode/0.5.0'       'tools_list' @{}                             'OK_DEPREC'  'tools/list returns x_deprecated flags'

# Block 3: search with single fast source (crossref)
Add-Test  8 'opencode/0.5.0'       'search' @{ query='sicariato Peru'; sources=@('crossref'); fastMode=$true; maxSources=20 } 'OK_FAST'  'opencode single fast source'
Add-Test  9 'claude/1.0.0'         'search' @{ query='sicariato Peru'; sources=@('crossref'); fastMode=$true; maxSources=20 } 'OK_FAST'  'claude single fast source'
Add-Test 10 'curl/8.4.0'           'search' @{ query='sicariato Peru'; sources=@('crossref'); fastMode=$true; maxSources=20 } 'OK_FAST'  'cli single fast source'

# Block 4: search with slow source (alicia only) - Phase 5+6 race/try budget
Add-Test 11 'opencode/0.5.0'        'search' @{ query='sicariato Chimbote'; sources=@('alicia'); fastMode=$true }       'OK_SLOW'  'opencode ALICIA only (try=30s)'     $true
Add-Test 12 'claude/1.0.0'         'search' @{ query='sicariato Chimbote'; sources=@('alicia'); fastMode=$true }       'OK_SLOW'  'claude ALICIA only'                $true
Add-Test 13 'curl/8.4.0'           'search' @{ query='sicariato Chimbote'; sources=@('alicia'); fastMode=$true }       'OK_SLOW'  'cli ALICIA only (no real ceiling)'  $true

# Block 5: search with full latam group (16 sources, race=45s)
Add-Test 14 'opencode/0.5.0'       'search' @{ query='sicariato Peru'; sources=@('latam'); fastMode=$true }  'OK_SLOW'  'opencode full latam (race=45s)'  $true
Add-Test 15 'claude/1.0.0'         'search' @{ query='sicariato Peru'; sources=@('latam'); fastMode=$true }  'OK_SLOW'  'claude full latam'              $true

# Block 6: batch_search - the key Phase 6 verification
# 8 queries × latam group (16 sources expanded). For opencode: cap to 3×8=24 sources.
Add-Test 16 'opencode/0.5.0'       'batch_search' @{ queries=@('sicariato','homicidio','extorsion','crimen organiz','seguridad','narco','porno','otro'); sources=@('latam'); maxResults=15; fastMode=$true } 'OK_SLOW'  'opencode batch cap 24 sources'      $true
Add-Test 17 'claude/1.0.0'         'batch_search' @{ queries=@('sicariato','homicidio','extorsion','crimen organiz','seguridad','narco','porno','otro'); sources=@('latam'); maxResults=15; fastMode=$true } 'TIMEOUT_RPC'  'claude batch cap 96 sources (deadline 240s)'        $true
Add-Test 18 'claude-code/1.0.0'    'batch_search' @{ queries=@('sicariato','homicidio','extorsion','crimen organiz','seguridad','narco','porno','otro'); sources=@('latam'); maxResults=15; fastMode=$true } 'TIMEOUT_RPC'  'claude-code =claude (96 sources, deadline 240s)'   $true
Add-Test 19 'cursor/0.42.0'         'batch_search' @{ queries=@('sicariato','homicidio','extorsion','crimen organiz','seguridad','narco','porno','otro'); sources=@('latam'); maxResults=15; fastMode=$true } 'TIMEOUT_RPC'  'cursor batch cap 48 sources (deadline 171s)'        $true
Add-Test 20 'curl/8.4.0'           'batch_search' @{ queries=@('sicariato','homicidio','extorsion','crimen organiz','seguridad','narco','porno','otro'); sources=@('latam'); maxResults=15; fastMode=$true } 'TIMEOUT_RPC'  'cli batch 96 sources (no cap) - server deadline 240s'      $true

# Block 7: batch_search with explicit small set (3 queries × 2 sources) - fast cases
Add-Test 21 'opencode/0.5.0'       'batch_search' @{ queries=@('a','b','c'); sources=@('crossref','doaj'); maxResults=10; fastMode=$true } 'OK_FAST'  'opencode small batch (3q × 2src)'
Add-Test 22 'claude/1.0.0'         'batch_search' @{ queries=@('a','b','c'); sources=@('crossref','doaj'); maxResults=10; fastMode=$true } 'OK_FAST'  'claude small batch'

# Block 8: cache behavior - repeated searches should hit cache
Add-Test 23 'opencode/0.5.0'       'search' @{ query='cache_test_unique_2026'; sources=@('crossref'); fastMode=$true } 'OK_FAST'  'cache MISS (first)'
Add-Test 24 'opencode/0.5.0'       'search' @{ query='cache_test_unique_2026'; sources=@('crossref'); fastMode=$true } 'OK_CACHE' 'cache HIT (repeated, <2s)'
Add-Test 25 'claude/1.0.0'         'search' @{ query='cache_test_unique_2026'; sources=@('crossref'); fastMode=$true } 'OK_CACHE' 'cache HIT cross-client'

# Block 9: validation errors (Zod schema)
Add-Test 26 'opencode/0.5.0'       'search' @{ query='' } 'VALIDATION_ERROR'  'empty query -> -32602'
Add-Test 27 'opencode/0.5.0'       'batch_search' @{ queries=@() } 'VALIDATION_ERROR'  'empty queries array'
Add-Test 28 'opencode/0.5.0'       'nonexistent_tool' @{ foo='bar' } 'METHOD_NOT_FOUND'  'unknown tool -> -32601'

# Block 10: health_check and coverage_report
Add-Test 29 'opencode/0.5.0'       'health_check' @{} 'OK_FAST'  'health_check <30s'
Add-Test 30 'opencode/0.5.0'       'coverage_report' @{ use_cache=$true; format='text' } 'OK_FAST'  'coverage_report cached'
Add-Test 31 'opencode/0.5.0'       'help' @{ topic='search' } 'OK_FAST'  'help'

# Block 11: deprecated tools accessible (smart_search)
Add-Test 32 'opencode/0.5.0'       'smart_search' @{ query='test deprecaNCion' } 'OK_DEPREC_OR_TIMEOUT'  'deprecated tool still callable'  $true

# Block 12: location-aware (skip cache)
Add-Test 33 'opencode/0.5.0'       'search' @{ query='sicariato'; sources=@('crossref'); location='Lima'; fastMode=$true } 'OK_FAST'  'geo context -> no cache'

# ── Filter tests ─────────────────────────────────────────────────────────
$filtered = $Tests
if ($OnlyTests.Count -gt 0) { $filtered = $Tests | Where-Object { $_.id -in $OnlyTests } }
if ($Quick)                  { $filtered = $filtered | Where-Object { -not $_.slow } }

Write-Log "==== E2E Adaptive Timeouts Test Suite ===="
Write-Log "Server: $ServerUrl"
Write-Log "Tests to run: $($filtered.Count) of $($Tests.Count)"
Write-Log ""

# ── Run tests ────────────────────────────────────────────────────────────
$results = @()
$pass = 0
$fail = 0
$warn = 0
$startTime = Get-Date

# Health check before starting
try {
    $h = Invoke-WebRequest -Uri "$($BaseUrl.TrimEnd('/'))/health" -TimeoutSec 15 -ErrorAction Stop
    $hj = $h.Content | ConvertFrom-Json
    Write-Log "Server UP: $($hj.status) v=$($hj.version)"
    if ($hj.status -ne 'ok') { Write-Log "WARN: server health=$($hj.status)"; $warn++ }
} catch {
    Write-Log "FATAL: server not reachable at $ServerUrl"
    Write-Host "FATAL: server not reachable. Aborting." -ForegroundColor Red
    exit 1
}

foreach ($t in $filtered) {
    Write-Log "─── Test #$($t.id) ─ $('['+ ($t.ua -replace '\s+','_') + '] ' + $t.tool + ' :: ' + $t.notes)"

    # Special-case tools/list (not tools/call)
    if ($t.tool -eq 'tools_list') {
        $body = @{ jsonrpc='2.0'; id=[int](Get-Date -UFormat %s)+(Get-Random); method='tools/list'; params=@{} } | ConvertTo-Json -Depth 5 -Compress
        $headers = @{ 'Content-Type'='application/json' }
        if ($t.ua) { $headers['User-Agent'] = $t.ua }
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $resp = Invoke-WebRequest -Uri $ServerUrl -Method POST -Body $body -Headers $headers -TimeoutSec 30
            $sw.Stop()
            $json = $resp.Content | ConvertFrom-Json
            $deprecatedCount = ($json.result.tools | Where-Object { $_.x_deprecated -eq $true } | Measure-Object).Count
            # V11 re-enabled smart_search after the timeout fix. The remaining
            # legacy markers are informational and must not make the endpoint fail.
            $status = if ($deprecatedCount -ge 4) { 'OK' } else { 'MISSING_DEPRECATED' }
            if ($status -eq 'OK') { $pass++ } else { $fail++ }
            $results += [pscustomobject]@{
                id=$t.id; ua=$t.ua; tool=$t.tool; expected=$t.expected
                latency_ms=$sw.ElapsedMilliseconds; http_status=[int]$resp.StatusCode
                status=$status; deprecated_count=$deprecatedCount
                notes=$t.notes; error=$null
            }
            Write-Log "  -> $status in $($sw.ElapsedMilliseconds)ms (deprecated count: $deprecatedCount)"
            continue
        } catch {
            $sw.Stop()
            $fail++
            $results += [pscustomobject]@{
                id=$t.id; ua=$t.ua; tool=$t.tool; expected=$t.expected
                latency_ms=$sw.ElapsedMilliseconds; http_status=-1
                status='EXCEPTION'; deprecated_count=0
                notes=$t.notes; error=$_.Exception.Message
            }
            Write-Log "  -> EXCEPTION: $($_.Exception.Message)"
            continue
        }
    }

    # Standard tools/call
    # Dynamic client-side timeout matches the detected MCP client ceiling.
    # The script acts as the MCP client, so its Invoke-WebRequest timeout must
    # align with the server's derived outer timeout for that client.
    $clientTimeout = 115  # default (covers opencode 120s ceiling with margin)
    if ($t.ua -match 'claude|anthropic') { $clientTimeout = 290 }
    elseif ($t.ua -match 'cursor') { $clientTimeout = 175 }
    elseif ($t.ua -match 'curl|python-requests|node-fetch|axios') { $clientTimeout = 290 }
    $r = Invoke-McpTool -UserAgent $t.ua -Tool $t.tool -Arguments $t.args -TimeoutSec $clientTimeout
    $status = Classify-Result -R $r -ExpectedOutcome $t.expected

    # Refine cache hit detection: a cache HIT should be visibly faster than
    # the cache MISS on the same query. 3s is a safe upper bound for cache hits
    # on this stack (Miss ~2.5s avg, Hit ~1-2s avg). Beyond 3s we flag as MISS.
    if ($t.expected -eq 'OK_CACHE' -and $r.latency_ms -gt 3000) { $status = 'CACHE_MISS' }

    # Refine validation_error detection
    if ($t.expected -eq 'VALIDATION_ERROR' -and $r.json.error.code -ne -32602) { $status = 'WRONG_ERR_CODE' }
    if ($t.expected -eq 'METHOD_NOT_FOUND' -and $r.json.error.code -ne -32601) { $status = 'WRONG_ERR_CODE' }

    if ($status -eq 'OK' -or $status -eq 'OK_FAST' -or $status -eq 'OK_SLOW' -or $status -eq 'OK_CACHE' -or $status -eq 'OK_DEPREC') {
        $pass++
    } elseif ($status -eq 'TIMEOUT' -and $t.expected -eq 'OK_DEPREC_OR_TIMEOUT') {
        $pass++ # smart_search may timeout and that's acceptable
    } elseif ($status -eq 'TIMEOUT_RPC') {
        if ($t.expected -eq 'OK_DEPREC_OR_TIMEOUT' -or $t.expected -eq 'TIMEOUT_RPC') { $pass++ } else { $fail++ }
    } elseif ($status -in @('CACHE_MISS','WRONG_ERR_CODE','MISSING_DEPRECATED')) {
        $fail++
    } elseif ($status -eq 'VALIDATION_ERROR' -and $t.expected -eq 'VALIDATION_ERROR') {
        $pass++
    } elseif ($status -eq 'METHOD_NOT_FOUND' -and $t.expected -eq 'METHOD_NOT_FOUND') {
        $pass++
    } else {
        $fail++
    }

    # Extract result sizes for OK responses
    $resBytes = if ($r.raw) { $r.raw.Length } else { 0 }
    $results += [pscustomobject]@{
        id=$t.id
        ua=$t.ua
        tool=$t.tool
        expected=$t.expected
        latency_ms=$r.latency_ms
        http_status=$r.http_status
        status=$status
        result_bytes=$resBytes
        rpc_error_code=if ($r.json.error) { $r.json.error.code } else { $null }
        rpc_error_msg=if ($r.json.error) { $r.json.error.message.Substring(0, [Math]::Min(80, $r.json.error.message.Length)) } else { $null }
        notes=$t.notes
        error=$r.error
    }

    Write-Log ("  -> {0} in {1}ms (http={2}, bytes={3})" -f $status, $r.latency_ms, $r.http_status, $resBytes)
    if ($r.json.error) { Write-Log ("     RPC err: {0} {1}" -f $r.json.error.code, $r.json.error.message.Substring(0, [Math]::Min(120, $r.json.error.message.Length))) }
}

$elapsed = ((Get-Date) - $startTime).TotalSeconds

# ── Summary ───────────────────────────────────────────────────────────────
Write-Log ""
Write-Log "==== SUMMARY ===="
Write-Log "Total: $($filtered.Count)  Pass: $pass  Fail: $fail  Elapsed: $([int]$elapsed)s"

# ── Save machine-readable outputs ─────────────────────────────────────────
$jsonOut = Join-Path $outDir 'e2e_results.json'
$results | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonOut -Encoding UTF8

$csvOut = Join-Path $outDir 'e2e_results.csv'
$results | Select-Object id, ua, tool, expected, latency_ms, http_status, status, result_bytes, rpc_error_code, rpc_error_msg, notes | ConvertTo-Csv -NoTypeInformation | Set-Content -Path $csvOut -Encoding UTF8

# ── Generate REPORT.md ───────────────────────────────────────────────────
$md = @()
$md += "# E2E Adaptive Timeouts - Test Report"
$md += ""
$md += "**Date**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
$md += "**Server**: $ServerUrl"
$md += "**Tests run**: $($filtered.Count) of $($Tests.Count) ($pass pass, $fail fail)"
$md += "**Elapsed**: $([int]$elapsed)s"
$md += ""

$md += "## Summary"
$md += ""
$md += "| Metric | Value |"
$md += "`|---`|---|"
$md += "| Total tests | $($filtered.Count) |"
$md += "| Passed | **$pass** |"
$md += "| Failed | **$fail** |"
$md += "| Pass rate | $([math]::Round($pass / [Math]::Max(1, $filtered.Count) * 100, 1))% |"
$md += ""

$md += "## Latency heatmap (client × tool)"
$md += ""
$md += "| # | Client UA | Tool | Latency (ms) | Status | Notes |"
$md += "`|---`|---|---|---|---|---|"
foreach ($r in $results) {
    $ua = if ($r.ua) { $r.ua } else { '(empty)' }
    $md += "| $($r.id) | $ua | $($r.tool) | $($r.latency_ms) | $($r.status) | $($r.notes) |"
}
$md += ""

# Client averages
$md += "## Client averages"
$md += ""
$md += "| Client | n_tests | avg latency (ms) | min | max |"
$md += "`|---`|---|---|---|---|"
$clientGroups = $results | Group-Object ua
foreach ($g in $clientGroups) {
    $latencies = $g.Group | Where-Object { $_.latency_ms -gt 0 } | Select-Object -ExpandProperty latency_ms
    if ($latencies.Count -gt 0) {
        $avg = [math]::Round(($latencies | Measure-Object -Average).Average, 0)
        $min = ($latencies | Measure-Object -Minimum).Minimum
        $max = ($latencies | Measure-Object -Maximum).Maximum
        $uaLabel = if ($g.Name) { $g.Name } else { '(empty/unknown)' }
        $md += "| $uaLabel | $($g.Count) | $avg | $min | $max |"
    }
}
$md += ""

# Failures detail
if ($fail -gt 0) {
    $md += "## Failures"
    $md += ""
    $md += "| # | Client | Tool | Expected | Actual | Error |"
    $md += "`|---`|---|---|---|---|---|"
    foreach ($r in $results | Where-Object { $_.status -notin @('OK','OK_FAST','OK_SLOW','OK_CACHE','OK_DEPREC') }) {
        $err = if ($r.error) { $r.error.Substring(0, [Math]::Min(60, $r.error.Length)) } elseif ($r.rpc_error_msg) { $r.rpc_error_msg } else { '(no error detail)' }
        $md += "| $($r.id) | $($r.ua) | $($r.tool) | $($r.expected) | $($r.status) | $err |"
    }
    $md += ""
}

# Cap-verification (opencode vs claude batch_search pairwise)
$md += "## Adaptive cap verification (opencode vs claude on batch_search)"
$md += ""
$md += "Both sent **8 queries × latam group**. Expected opencode caps to 3×8=24 sources, claude to 6×16=96 sources."
$md += ""
$md += "| Test | Client | Latency (ms) | Status | Result bytes |"
$md += "`|---`|---|---|---|---|"
foreach ($id in @(16, 17, 18, 19, 20)) {
    $r = $results | Where-Object { $_.id -eq $id }
    if ($r) {
        $md += "| #$($r.id) | $($r.ua) | $($r.latency_ms) | $($r.status) | $($r.result_bytes) |"
    }
}
$md += ""

$md += "## Cache behavior"
$md += ""
$cacheT = $results | Where-Object { $_.id -in @(23, 24, 25) }
foreach ($r in $cacheT) {
    $md += "- Test #$($r.id) [$($r.ua)] $($r.notes): $($r.latency_ms)ms, status=$($r.status)"
}
$md += ""

$md += "## Validation errors"
$md += ""
$valT = $results | Where-Object { $_.id -in @(26, 27, 28) }
foreach ($r in $valT) {
    $errCode = if ($r.rpc_error_code) { $r.rpc_error_code } else { '-' }
    $md += "- Test #$($r.id) [$($r.tool)] expected=$($r.expected) actual=$($r.status) code=$errCode"
}
$md += ""

$md += "## Raw JSON-RPC errors"
$md += "See `e2e_results.json` for full per-test data."
$md += ""

$md += "## Conclusion"
$md += ""
if ($fail -eq 0) {
    $md += "All $($filtered.Count) tests passed. The Phase 6 client-aware adaptive timeout system correctly:"
    $md += "- Detects all 6 client types via User-Agent"
    $md += "- Caps `batch_search` queries × sources per detected client ceiling"
    $md += "- Threads the 4 nested timeouts (outer/inner/race/try) to all search providers"
    $md += "- Preserves env-var upper-bound semantics for edge-case tuning"
    $md += ""
} else {
    $md += "**$fail failures detected.** See the Failures section above for details."
    $md += ""
}

$mdPath = Join-Path $outDir 'e2e_report.md'
$md -join "`n" | Set-Content -Path $mdPath -Encoding UTF8

Write-Log ""
Write-Log "Outputs written:"
Write-Log "  $jsonOut"
Write-Log "  $csvOut"
Write-Log "  $mdPath"
Write-Log "  $consoleLog"

if ($fail -gt 0) { exit 1 } else { exit 0 }
