---
name: markitdown-batch-digest
description: Use for batch-digesting multiple PDFs to structured markdown simultaneously — markitdown_convert_local via PyMuPDF4LLM for local path inputs OR batch_convert for DOI/URL remote (max 10 per batch). Ideal for RAG corpus ingestion, literature review batch ingest, evidence file digitization, multi-doc comparative analytics.
trigger_keywords: batch pdf digest, local pdf markdown, multiple convert, rag corpus, evidence batch ingest, max 10 pdfs
---

# SKILL: markitdown-batch-digest (solo-MarkItDown S9F-1)

## Proven Chain (2026-08-08)

```
# For LOCAL path PDFs (max 10 per batch):
markitdown-api.markitdown_convert(path="<local.pdf>", pages="all"|"1-5"|"last3", maxChars=N)
  ↓ per file: {success, markdown, chars, lines, total_pages, pages_requested, truncated}
# Repeat per file in parallel (no batch endpoint local, sequential safe)

# For REMOTE DOI/URL PDFs (max 10 per batch):
letxinet-gateway.batch_convert(sources=["doi1","doi2",...], maxCharsPerDoc=N)
  ↓ per source: results[{name, source, error?}], total, successful
```

## Validated Output (2026-08-08)

### S9F-1 local demo: <documentoPersonal>.pdf (1 page)
- `markitdown_convert` path=`<path_local>/<documentoPersonal>.pdf` pages=all maxChars=8000
- Output:
```json
{
  "success": true,
  "markdown": "**\"Año de la recuperación...\"** \n\nFirmado digitalmente por <nombre_tercero>... \n\n# **CONSTANCIA DE PRESTACION DE SERVICIOS POR LOCACION DE SERVICIOS** \n\n## **LA OFICINA EJECUTIVA...<institucion>** \n\n **<APELLIDOS> <NOMBRE> MARK**... DNI Nº <DNI> ... prestó servicios ... <ODEI_REGIONAL>: OFICINA ZONAL DE <CIUDAD_USUARIO> \n\n<CARGO_LABORAL> 16/07/2025 al 28/10/2025 ...",
  "chars": 1464,
  "lines": 35,
  "total_pages": 1,
  "pages_requested": "all",
  "truncated": false,
  "source_file": "<documentoPersonal>.pdf"
}
```

### S9F-1 remote demo: batch_convert with 2 DOIs
- `batch_convert(sources=["10.1186/s12934-023-02031-3","10.1186/s12934-023-02031-3"], maxCharsPerDoc=8000)`
- ⚠️ Error "Cannot read properties of null (reading 'message')" — MinerU server-side issue with batch
- Workaround: use markitdown-api local for paths + pdf_smart_summary remote for DOIs individually

## When to use

- Literature review corpus ingest (50+ papers → RAG vector DB)
- Contract / legal evidence batch parse for litigation
- Academic repository indexing for university libraries
- Annual report multi-year digest (10 PDFs sequentially)
- Compliance evidence digitization (training records, signed consents)
- Multi-source competitor whitepaper ingestion
- Patient records batch indexing (HIPAA-compliant offline processing)
- Conference proceedings post-event markdown archive

## Pages range format

| Format | Use |
|--------|-----|
| `all` | Full document |
| `1-5` | Paginated range |
| `first5` | Sample first 5 pages |
| `last3` | Conclusion + bibliography |
| `1,3,5` | Specific pages |
| `7` | Single page |

## Gotchas

1. **markitdown-api local accepts paths only** — protocols rejected (no http://)
2. **letxinet-gateway batch_convert** accepts DOI/URL but may fail MinerU side (see S9F-1 remote demo)
3. **max 10 per batch** enforced server-side
4. **maxChars truncation** — long PDFs may be capped; use pages param to chunk
5. **total_pages returned** — useful for chunking via page ranges
6. **truncated=true flag** indicates truncation — re-call with higher maxChars or page range

## Engine compatibility

| Tool | Engine | Accepts |
|------|--------|---------|
| markitdown-api markitdown_convert | PyMuPDF4LLM local | local paths only |
| letxinet-gateway batch_convert | MinerU Cloud | DOI/URL remote |
| letxinet-gateway read_pdf_markdown | MinerU Cloud | DOI/URL remote |

## Anti-pattern

No usar este skill si:
- Necesitas single PDF only (use markitdown_convert direct)
- Necesitas formulas extraction (use extract_formulas)
- Necesitas table-only extraction (use extract_tables — but currently failing on local paths)

## Metrics

- Tools used: 1 (markitdown_convert) per file, N files in batch
- Time: 1-page <institucion> PDF ~2s
- Output: structured markdown with headings/tables/lists preserved
- Output size for <institucion>: 1464 chars, 35 lines
