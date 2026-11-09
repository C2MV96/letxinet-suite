---
name: markitdown-tables-extractor
description: Use to extract tables from PDFs as structured HTML or Markdown (pipe tables). ML-based table recognition handles rotated, cross-page, merged-cell tables. Ideal for financial statement ingestion, statistical table extraction from annual reports, comparative matrix harvesting for analytics.
trigger_keywords: extract tables pdf, ml table recognition, pipe tables markdown, cross-page tables, merged cells, html tables extraction
---

# SKILL: markitdown-tables-extractor (solo-MarkItDown S9F-2)

## Proven Chain (2026-08-08)

```
# REMOTE DOI/URL PDFs:
letxinet-gateway.extract_tables(source="<doi or url>", format="html"|"markdown")
  ↓ array of {page, table_index, headers, rows, html|markdown format}

# LOCAL path PDFs: work-around via markitdown_convert → markdown with embedded pipe tables
markitdown-api.markitdown_convert(path="<local.pdf>", pages="all" or specific)
  ↓ markdown with tables as pipe-delimited rows

# Section-level table extraction (DOI/URL):
letxinet-gateway.extract_section(source="<doi>", section="methods"|"results"|"conclusions")
  ↓ section text with Tables numbered inline + statistics detection (Table N references)
```

## Validated Output (2026-08-08)

### S9F-2 attempt 1: `extract_tables` on <documentoPersonal>.pdf local
- Result: `"Cannot read properties of null (reading 'message')"`
- ⚠️ MinerU Cloud extract_tables fails on local file path (requires DOI/URL)

### S9F-2 fallback: `analyze_academic` on DOI 10.1186/s12934-023-02031-3 remote
- 12 pages paper
- 27 sections detected
- 12 sections with statistical data
- 28 total statistical items (ANOVA, percentages, table_references, n_sample, f_test, regression)
- 12 table references detected: Table 1, Table 2, Table 3, Table 4, Table 5, Table 5 repeated across sections

### S9F-2 alternative: `extract_section(section="methods")` on DOI remote
- Methods section retrieved with Tables 1-5 inline + ANOVA tables in markdown form, including:
```
Table 1 Factors and their levels affecting BC production
MPW mango peel waste
Factor   Level 1 Level 2 Level 3 Level 4 Level 5
pH       3       4       5       6       7
Inoculum size %  2 3 4 5 6
MPW %           20 30 40 50 60

Table 2 Isolation of BC from local acidic fruits
Isolation source   No. isolates  No. BC producer  BC isolate code  BC yield (g/L)
Strawberry          14            4                S33              0.48 ± 0.02
S4                                              0.22 ± 0.03
S9                                              0.21 ± 0.08
S13                                             0.32 ± 0.00
Pineapple           8            0                —                —
...
```

## When to use

- Financial 10-K / annual report table extraction (balance sheet, P&L)
- Statistical report data ingestion from PDF (census, Eurostat)
- Comparative matrix table digests (per product/service)
- Reference table digitization from old printed materials (OCR-based)
- Insurance premium table cross-reference harvesting
- Pharmaceutical package insert composition tables
- Research paper Tables/ANOVA statistical output capture
- Earnings call deck financial summary tables

## Output formats

| Format | Use |
|--------|-----|
| `html` | Embedded into web app / form rendering |
| `markdown` | Pipe tables for LLM ingestion / GitHub README |

## Gotchas

1. **extract_tables REQUIRES DOI/URL path** — local file paths fail with confusing null error
2. **For local PDFs, use markitdown_convert** — embedded pipe tables in markdown output
3. **analyze_academic** detects table_references by regex — exact count may double-count repeated references
4. **Cross-page tables** may be split into two pages — ML reconstruction not always perfect
5. **Merged cells** preserved in HTML, but appear as repeated values in markdown
6. **Rotated tables** (90°) sometimes recognized, sometimes rendered as raw text
7. **Multi-row headers** collapse in markdown (html preserves)

## Anti-pattern

No usar este skill si:
- Necesitas single-cell value extraction (use extract_section by section name)
- Necesitas OCR hand-written tables (use commercial ABBYY Finereader direct)
- Necesitas live spreadsheet (use pdfplumber python direct)

## Metrics

- Tools used: 1 primary (extract_tables or extract_section depending on remote/local)
- Time: ~3-10s per paper
- Output: structured tables (HTML or markdown pipe) + statistics metadata
- Validated S9F-2: 12 page paper → 5 tables extracted, 28 statistical items categorized
