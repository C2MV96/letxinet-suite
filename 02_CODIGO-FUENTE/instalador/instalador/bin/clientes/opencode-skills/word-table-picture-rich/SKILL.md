---
name: word-table-picture-rich
description: Use for generating Word documents with multiple formatted tables (header rows, border styles, shading) and optional embedded images. Ideal for visually-rich reports — comparative matrices, status summaries, image-annotated deliverables. Use add_table + format_table for each table; add_picture for image insert.
trigger_keywords: docx multiple tables, table header row, border style single thick, shading colors, image embedded docx, rich report formatting
---

# SKILL: word-table-picture-rich (solo-Word S9E-2)

## Proven Chain (2026-08-08)

```
word.create_document(filename="<output.docx>")
word.add_heading(level=1, text="<title>")
word.add_paragraph(text="<intro>")
# For each table:
word.add_heading(level=2, text="Tabla N: <subject>")
word.add_table(rows=N, cols=M, data=<matrix>)
word.format_table(table_index=<i>, border_style="single|thick|double|none", has_header_row=true,
                  shading=[["#FFFFFF","#F0F0F0",...],...])  # optional per-cell color
# Optional image:
word.add_picture(image_path="<local.png>", width=6.0)  # inches
```

## Validated Output (2026-08-08)

**S9E-2 table-rich demo:**
- `create_document` + `add_heading` H1 "REPORTE DE RESULTADOS CON TABLAS"
- `add_paragraph` intro
- Table 1: `add_heading` H2 "Tabla 1: Resumen MCPs Suite LetXinet"
  - `add_table` 5x4 data (MCP, Tools, Lenguaje, Puerto)
  - `format_table` border_style=single, has_header_row=true
- Table 2: `add_heading` H2 "Tabla 2: Estado Fuentes Academicas Pool"
  - `add_table` 5x4 data (Estado, Count, Pct, Notas)
  - `format_table` border_style=thick, has_header_row=true
- (image path not available at validation time)

**Output size:** docx 37,415 bytes (37 KB)
**Audit:** 4 paragraphs, 2 tables, both with header rows formatted

## Border style options

| Style | Visual |
|-------|--------|
| single | thin line (most common) |
| double | parallel lines |
| thick | bold boundary |
| none | invisible (CSS-style) |

## Shading format

```python
shading = [
  ["#FFFFFF","#F0F0F0","#FFFFFF"],  # row 0 alternating
  ["#FFF8E7","#FFF0E0","#FFF8E7"],  # row 1 warm hues
]
# cell color accepts hex or named ("red","blue")
```

## Picture insertion

- `add_picture(image_path=..., width=6.0)` — width in inches (proportional scaling)
- **Local path required** — remote URLs not supported
- PNG/JPEG work best
- Picture inserted after current paragraph cursor

## When to use

- Multi-table executive summary reports
- Status report with key metrics table + image chart
- Comparative matrix (rows=entities, cols=metrics)
- Annotated screenshot reports (image + surrounding table)
- Compliance deliverable with evidence tables
- Pitch deck printable handout

## Gotchas

1. **`rows` AND `cols` params mandatory** for add_table (pydantic)
2. **`data` 2D string array** — quote numbers as strings
3. **`format_table` table_index** increments per add_table call (0, 1, 2...)
4. **Picture path MUST be local** — no remote URLs in add_picture
5. **`has_header_row=true` bolds first row** but does not add shading — use `shading` param
6. **Border "thick" looks heavy** — prefer "single" for most reports
7. **Table count** tracked by document object lifecycle — call format_table promptly

## Anti-pattern

No usar este skill si:
- Single table only (use word-template-generator simpler)
- Necesitas Excel spreadsheet with formulas (use openpyxl direct)
- Necesitas formula references between cells (Word tables don't support refs)

## Metrics

- Tools used: 8 (create_document, add_heading x3, add_paragraph, add_table x2, format_table x2)
- Time: ~20s S9E-2 end-to-end
- Output: docx 37 KB with 2 tables (5x4 each), header rows, borders
