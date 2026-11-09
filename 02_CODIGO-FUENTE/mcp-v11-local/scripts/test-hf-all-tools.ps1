param(
    [string]$BaseUrl = 'https://C2MV-letxipu-search-mcp-v9.hf.space',
    [int]$TimeoutSec = 180,
    [string]$OutFile = (Join-Path $PSScriptRoot 'hf-all-tools-results.json')
)

$ErrorActionPreference = 'Continue'
$pdf = 'https://arxiv.org/pdf/1706.03762'
$doi = '10.48550/arxiv.1706.03762'
$probes = @(
    @{ n='search'; a=@{query='machine learning education';sources=@('openalex');maxResults=1;fastMode=$true} }
    @{ n='batch_search'; a=@{queries=@('machine learning education');sources=@('openalex');maxResults=1;fastMode=$true} }
    @{ n='smart_search'; a=@{query='machine learning education';sources=@('openalex');maxResults=1;fastMode=$true} }
    @{ n='list_sources'; a=@{} }
    @{ n='health_check'; a=@{} }
    @{ n='coverage_report'; a=@{} }
    @{ n='help'; a=@{topic='all'} }
    @{ n='search_paperswithcode'; a=@{query='transformer';maxResults=1} }
    @{ n='search_conferences'; a=@{query='attention';maxResults=1} }
    @{ n='search_dblp'; a=@{query='attention';maxResults=1} }
    @{ n='trending_papers'; a=@{maxResults=1} }
    @{ n='enrich_metadata'; a=@{papers=@(@{doi=$doi})} }
    @{ n='fetch_metadata'; a=@{doi=$doi} }
    @{ n='recover_metadata'; a=@{doi=$doi} }
    @{ n='download_pdf'; a=@{doi=$doi} }
    @{ n='resolve_pdf'; a=@{identifier=$doi} }
    @{ n='pdf_metadata'; a=@{source=$pdf} }
    @{ n='pdf_citations'; a=@{source=$pdf} }
    @{ n='pdf_smart_summary'; a=@{source=$pdf;maxTotalChars=1000} }
    @{ n='pdf_sections'; a=@{source=$pdf} }
    @{ n='read_pdf'; a=@{source=$pdf;maxChars=1000} }
    @{ n='read_pdf_markdown'; a=@{source=$pdf;maxChars=1000} }
    @{ n='extract_section'; a=@{source=$pdf;section='abstract'} }
    @{ n='extract_tables'; a=@{source=$pdf} }
    @{ n='extract_formulas'; a=@{source=$pdf} }
    @{ n='convert_document'; a=@{source=$pdf;maxChars=1000} }
    @{ n='batch_convert'; a=@{sources=@($pdf);maxCharsPerDoc=1000} }
    @{ n='analyze_academic'; a=@{source=$pdf} }
)

$results = foreach($probe in $probes) {
    $body = @{jsonrpc='2.0';id=[int](Get-Random -Minimum 1000 -Maximum 999999);method='tools/call';params=@{name=$probe.n;arguments=$probe.a}} | ConvertTo-Json -Depth 12 -Compress
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/api/mcp" -Method POST -ContentType 'application/json' -Headers @{'User-Agent'='opencode/1.0'} -Body $body -TimeoutSec $TimeoutSec
        $sw.Stop()
        $json = $response.Content | ConvertFrom-Json
        $text = if($json.result.content){$json.result.content[0].text}else{''}
        $status = if($json.error){'RPC_ERROR'}elseif([string]::IsNullOrWhiteSpace($text)){'EMPTY'}else{'OK'}
        [pscustomobject]@{tool=$probe.n;status=$status;ms=[int]$sw.ElapsedMilliseconds;chars=$text.Length;error=if($json.error){$json.error.message}else{$null}}
    } catch {
        $sw.Stop()
        $kind = if($_.Exception.Message -match 'timed? ?out|timeout'){'TIMEOUT'}else{'EXCEPTION'}
        [pscustomobject]@{tool=$probe.n;status=$kind;ms=[int]$sw.ElapsedMilliseconds;chars=0;error=$_.Exception.Message}
    }
}

$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutFile -Encoding utf8
$results | Format-Table -AutoSize | Out-String -Width 220
"RESULT_FILE=$OutFile"
"SUMMARY=" + (($results | Group-Object status | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join '; ')
if(($results | Where-Object status -ne 'OK').Count -gt 0){ exit 2 }
