---
name: gateway-word-bibliography-reports
description: Use when generating structured Word reports of academic search results. Combines search/batch_search with Word creation tools to produce formatted docx with summary + results table. Ideal for systematic reviews and literature monitoring deliverables.
trigger_keywords: biblio, report, docx, search, literature, review, table, systematic
---

# SKILL: Gateway + Word — Bibliography Report Generator

## Proven Chain (2026-08-08)

```
gateway.search(query="<topic>", sources=["scielo","openalex","serpapi"], fastMode=true, filterFalsePositives=true)
    ↓ iterate results
word.create_document(filename="<output.docx>", title="<topic>", author="<author>")
word.add_heading(level=1, text="Resultados de Busqueda Academica")
word.add_paragraph(text="<query_metadata_summary>")
word.add_table(rows=N+1, cols=M, data=<results_matrix>)
word.format_table(table_index=0, border_style="single", has_header_row=true)
```

## Validated Output (sesion 8)

- Query: "celulosa bacteriana Komagataeibacter residues agroindustriales Peru"
- Results: 5 papers in 8.7s (serpapi dominated: UNAL Colombia + UNS Peru + U.Lima + ITP)
- Docx: 38 KB, 1 page, 2 sections + 1 table 6x7 (#/Titulo/Autor/Año/Fuente/URL/Citas)
- Outline: heading + paragraph + table + formatted borders

## When to use this skill

- Generate weekly/monthly literature monitoring reports
- Compile systematic bibliography for a thesis chapter
- Produce institutional research reports for non-technical stakeholders
- Feed Searchable Word documents to colleagues without API access

## Recommended tools order

1. `gateway.search` (single query, max 3 sources, fastMode=true) for speed
2. `gateway.batch_search` (3-6 query variations, max 6 sources) for breadth
3. `gateway.smart_search` (auto-generated synonym variants) for discovery

## Word formatting tips

- Use `border_style="single"` + `has_header_row=true` for clean integer tables
- Headers go to row 0 — make sure to include headers in `data` matrix
- For long titles: they wrap automatically; consider truncating to 80 chars in data
- Add a final paragraph with "Pipeline ejecutado: gateway.search → word..." for traceability

## Metrics

- Tools used: 6 (search, create_document, add_heading, add_paragraph, add_table, format_table)
- Time: 8.7s search + 2s doc creation = ~12s total
- Output: 1 .docx (38 KB) per query
