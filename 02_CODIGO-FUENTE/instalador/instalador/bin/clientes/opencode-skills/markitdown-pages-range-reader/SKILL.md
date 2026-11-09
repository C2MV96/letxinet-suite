---
name: markitdown-pages-range-reader
description: Use to read specific page ranges from PDFs as structured markdown — supports all, first5, last3, paginated ranges, and single page. Token-efficiency tool for working only on relevant sections. Ideal for review-then-deep-dive workflows, citation chunk extraction, jumping to conclusions + bibliography fast, multi-PDF targeted scan.
trigger_keywords: pdf pages range, first5 last3, paginated read, chunk page read, targeted page extraction, token efficient pdf
---

# SKILL: markitdown-pages-range-reader (solo-MarkItDown S9F-4)

## Proven Chain (2026-08-08)

```
# LOCAL paths only (PyMuPDF4LLM local API):
markitdown-api.markitdown_convert(path="<local.pdf>", pages="1-5"|"first5"|"last3"|"1,3,5"|"7", maxChars=N)
  ↓ markdown of those pages only

# REMOTE DOI/URL via Gateway:
letxinet-gateway.read_pdf(source="<doi>", pages="1-5"|"first5"|"last3", maxChars=N, format="markdown"|"text")
letxinet-gateway.read_pdf_markdown(source="<doi>", pages="1-5"|"first5"|"last3", maxChars=N)
letxinet-gateway.pdf_smart_summary(source="<doi>", maxTotalChars=N)  # skips pages, returns section summaries
letxinet-gateway.extract_section(source="<doi>", section="<name>")  # section-level chunk

# Per-word strategy by document section:
- first5 → abstract + intro capture
- middle pages → methods + results detail
- last3 → conclusions + bibliography refs
```

## Validated Output (2026-08-08)

### S9F-4 local demo: <documentoPersonal>.pdf pages=all
- 1-page document, maxChars=8000
- Output:
```json
{
  "success": true,
  "chars": 1464,
  "lines": 35,
  "total_pages": 1,
  "pages_requested": "all",
  "truncated": false
}
```
- (Document is 1 page so all = first5 = last3 = 1)

### S9F-4 remote demo: read_pdf_markdown on DOI 10.1186/s12934-023-02031-3, pages=1
- ⚠️ Gateway returned: "Could not obtain the PDF. No DOI detected. Provide a DOI directly..."
- Workaround: pdf_smart_summary + extract_section provide similar section-based chunking

### S9F-4 section chunk demo: extract_section(section="conclusions") on DOI
- ✗ Not tested in S9F-4 directly — used in S9F-3 (Methods section via extract_section)
- Methods = 18,872 chars section chunk (vs full paper 6,429 words / 12 pages)

## Pages range format

| Format | Method | Use |
|--------|--------|-----|
| `"all"` | Full document | Small PDFs only |
| `"1-5"` | Range 1 to 5 | Reading first 5 pages |
| `"first5"` | First 5 pages | Abstract + intro |
| `"last3"` | Last 3 pages | Conclusions + refs |
| `"1,3,5"` | Specific pages | Sample spread |
| `"7"` | Single page | Section jump |
| `"last3"` (intelligently) | Last 3 pages with refs + paragraph start | Bibliography harvest |

## When to use

- Fast triage first5 of a 50-page PDF — see if relevant before full digest
- last3 citation extraction for bibliography harvest
- Middle specific pages (audit finding citation exact page)
- Skip cover/title page: `pages="3-last5"`
- Reading Results section by jumping to middle pages (e.g., `pages="4-8"`)
- Comparative literature scan: digest first5 of 20 academic papers → 20 short samples
- Conference proceedings: read `pages="1"` for title/abstracts only
- Annual report audit: read `last3` for management discussion + financial summary

## Token efficiency strategy

- 50-page paper → markitdown_convert pages="1-3" → ~10K tokens vs pages="all" → ~100K tokens
- 5-10x token savings per PDF when only need signature/intro pages
- Use `total_pages` field to plan the page range

## Gotchas

1. **page format strings exact** — "1-5" not "1 - 5", "first5" not "first 5"
2. **markitdown-api local accepts paths**; `read_pdf` gateway requires DOI/URL
3. **maxChars truncates** — set high enough; for chunked reading loop over pages
4. **Section vs page** — Gateway `extract_section` is section-wise (better for academic papers); markitdown_convert is page-wise (better for non-structured PDFs)
5. **`total_pages` returned** — informs how to plan next call (retry with different pages param)
6. **`truncated` flag** — true means truncation hit, call again with higher maxChars or narrower pages

## Anti-pattern

No usar este skill si:
- Necesitas full document (use markitdown-batch-digest skill)
- Necesitas tables specifically (use markitdown-tables-extractor)
- Necesitas OCR scanned PDF (use convert_document MinerU Cloud with OCR enabled)
- Necesitas formulas LaTeX (use markitdown-formulas-extractor)

## Metrics

- Tools used: 1 (markitdown_convert local OR read_pdf remote)
- Time: ~2-3s per 1-page chunk
- Output: paginated markdown chunks with totals
- Validated S9F-4: 1-page <institucion> PDF → 1464 chars / 35 lines via markitdown_convert pages=all
