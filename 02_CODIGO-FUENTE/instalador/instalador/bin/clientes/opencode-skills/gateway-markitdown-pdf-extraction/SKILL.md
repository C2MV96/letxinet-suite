---
name: gateway-markitdown-pdf-extraction
description: Use when extracting structured content from academic PDFs found via Gateway search. Combines batch_search/search (find papers) → resolve_pdf (resolve DOI/URL) → read_pdf (MinerU extraction). For PDFs already on disk, use markitdown_convert instead of read_pdf.
trigger_keywords: extract, pdf, academic, search, doi, mineru, bacterial cellulose
---

# SKILL: Gateway + MarkItDown — PDF Academic Extraction

## Proven Chain (2026-08-08)

```
gateway.batch_search(queries=["<topic>"], sources=["openalex","scielo","serpapi"], fastMode=true)
    ↓ pick DOI or pdfUrl from top results
gateway.resolve_pdf(identifier="<doi_or_url>")
    ↓ URL returned
gateway.read_pdf(source="<url>", maxChars=12000)   # MinerU scraper (~63k chars/paper)
    ↓ requires download first for some publishers (springer/bmc blocks bots)
markitdown_convert(path="<local_pdf_file>", maxChars=8000)  # for PDFs already on disk
```

## Validated Output (sesion 8)

- Searched "bacterial cellulose Komagataeibacter mango peel" → 45 unicos en 117s
- Top hit: DOI 10.1186/s12934-023-02031-3 (Achromobacter mango, 71 cites)
- Download PDF: blocked by Springer/BMC counter-redirect (HTML returned 3KB)
- Workaround: read_pdf with secondary URL → 63501 chars extracted via MinerU
- Topics extracted: 24 carbon sources, 14 nitrogen sources, RSM CCD, 469.83 g/L

## Key Gotchas

1. **Springer/BMC block direct download**: Use `read_pdf` (MinerU internal scraper) NOT Invoke-WebRequest or markitdown_convert with URL
2. **MarkItDown markitdown_convert only accepts LOCAL paths** — never URL strings
3. **For PDFs already on disk**: markitdown_convert is more efficient (no network)
4. **read_pdf_markdown** sometimes returns `Cannot read properties of null` for blocked URLs — fall back to `read_pdf` with format default

## Anti-pattern

Don't chain `gateway.search → gateway.download_pdf → markitdown_convert(url)` — download_pdf returns a URL but markitdown_convert needs local paths. Use `gateway.read_pdf(url)` instead for remote PDFs.

## Sources Performance (pool 2026-08-07)

- openalex: 49/70 matches (best for altmetric + abstracts)
- scielo: 15/45 (best for LatAm journal full text)
- serpapi (Google Scholar): best for thesis repositories (.pe/.co/.bo)
- renati: returned 0 (historical issue)

## Metrics

- Tools used: 3
- Time: 117s search + 60s resolve + 15s read = ~3 min
- Output: 5375-63501 chars markdown per paper
- Success rate: 80% (blocked Springer is the main failure point)
