---
name: word-template-generator
description: Use for generating complete docx templates from scratch — create_document, add_heading at multiple levels, add_paragraph, add_table with header_row formatting, and convert_to_pdf optional. Ideal for reports, proposals, RFPs, document assembly scaffolds when you have the content text ready.
trigger_keywords: docx template, report generator, document assembly, heading paragraph table, rfp template, proposal scaffold
---

# SKILL: word-template-generator (solo-Word S9E-1)

## Proven Chain (2026-08-08)

```
word.create_document(filename="<output.docx>", title="<title>", author="LetXinet")
  ↓ empty docx v0
word.add_heading(level=1, text="<H1 title>")
word.add_paragraph(text="<introduction paragraph>")
word.add_heading(level=2, text="<H2 section>")
word.add_paragraph(text="<body content>")
word.add_table(rows=N, cols=M, data=<matrix>)
  ↓ table inserted
word.format_table(table_index=0, border_style="single", has_header_row=true)
  ↓ table formatted with borders
[word.convert_to_pdf(output_filename="<output.pdf>")]  # optional
  ↓ PDF generated via Word COM
```

## Validated Output (2026-08-08)

**S9E-1 template-generator demo:**
- `create_document` → empty docx
- `add_heading` level=1 "COSAS POR HACER"
- `add_paragraph` intro text
- `add_heading` level=2 "Objetivos"
- `add_paragraph` "1. Demostrar pipeline completo omni-word-mcp..."
- `add_table` 4x3 data matrix
- `format_table` border_style=single, has_header_row=true
- `convert_to_pdf` optional

**Output size:** docx 37,120 bytes (37 KB) + pdf 111,548 bytes (111 KB)
**Metadata:** title="Template Generator Demo Document", author="LetXinet Harness S9E-1"
**Audit:** 4 paragraphs, 1 table, 1 page, 26 words

## When to use

- Generate report outline scaffolds for knowledge workers
- Populate markdown-formatted content into a formal Word template
- Auto-generate data tables from arrays (no manual Word needed)
- Generate PDF versions of structured reports
- Create multi-section proposal templates
- Grant application boilerplate scaffolds

## Heading level guidance

| Level | Use |
|-------|-----|
| 1 | Document title / Part heading |
| 2 | Major section |
| 3 | Subsection |
| 4 | Sub-subsection |
| 5-9 | Deep nesting rarely needed |

## Gotchas

1. **`add_table` requires `rows` AND `cols` params always** — pydantic ValueError if missing
2. **`data` must be 2D string array** — numbers must be quoted ("28" not 28)
3. **`format_table` has_header_row=true** only first row bolded; use shading param for cell colors
4. **`convert_to_pdf` requires Microsoft Word installed** (COM automation)
5. **Filename absolute path** — relative paths break under working dir
6. **Heading levels must be sequential** — jump 1→4 looks weird in TOC
7. **author/title in metadata** optional but useful for XLS-style audit

## Anti-pattern

No usar este skill si:
- Necesitas single paragraph only (use add_paragraph direct)
- Necesitas markdown-only output (use string concat)
- Necesitasandi writer spreadsheet (use python-docx with custom script)

## Metrics

- Tools used: 7-8 (create_document, add_heading x2, add_paragraph x2, add_table, format_table, optional convert_to_pdf)
- Time: ~15s end-to-end
- Output: docx 37 KB + pdf 111 KB validated S9E-1
