---
name: markitdown-word-pdf-digestion
description: Use when converting local PDFs (constancias, contracts, facturas, scanned certificates) into structured Word reports. Combines MarkItDown (PyMuPDF4LLM OCR) extraction with Word document creation. Ideal for HR certificate processing, contract review, invoice digitization.
trigger_keywords: pdf local, constancia, contrato, factura, hr, ocr, extract, digito, certificado, firma digital
---

# SKILL: MarkItDown + Word — PDF Local Digestion

## Proven Chain (2026-08-08)

```
markitdown.markitdown_convert(
    path="<local_pdf_path>",
    maxChars=8000,
    pages="all"
)
    ↓ structured markdown with headers + lists + signatures
word.create_document(filename="<output.docx>", title="<title>", author="LetXinet")
word.add_heading(level=1, text="<document_title>")
word.add_paragraph(text="<extraction_metadata>")
word.add_heading(level=2, text="Datos Extraidos del PDF")
word.add_table(rows=N, cols=2, data=<field_value_matrix>)
word.format_table(table_index=0, ...)
word.add_heading(level=2, text="Firmas y Metadata")
word.add_table(rows=N, cols=3, data=<signatories_matrix>)
word.format_table(table_index=1, ...)
word.add_paragraph(text="<pipeline_summary_footer>")
```

## Validated Output (sesion 8)

### Test: <documentoPersonal>.pdf (223 KB, 1 page)
- markitdown_convert returned 1464 chars in 5s
- Extracted:
  - Beneficiary: <APELLIDOS> <NOMBRE> MARK (DNI <DNI>)
  - Position: <CARGO_LABORAL>
  - Department: <ODEI_REGIONAL> - Oficina Zonal <ciudad_usuario>
  - Period: <periodo_laboral>
  - 2 digital signatures (<nombre_tercero><nombre_tercero> Miguel, <apellidos_tercero> Luis) with FAU IDs, dates, reasons
- Word output: 37 KB, 5 sections (h1+h2+h2+2p) + 2 tables (9x2 + 3x3)

## MarkItDown features verified

- **PyMuPDF4LLM engine** (local, port 7860): preserves H1/H2/H3 structure
- **OCR works on scanned PDFs**: tested with digitally-signed constancia
- **Markdown tables preserved**: pipe-tables appear when PDF has real tables
- **Digital signature metadata** captured via `<mark>` tags HTML-encoded
- **Page selection**: `pages="first5"` or `pages="1,3,7"`

## When NOT to use this skill

- For **online academic PDFs", use `gateway.read_pdf` (in-built MinerU scraper)
- For **convert-doc-to-PDF direction": use `word.convert_to_pdf`
- For **raw image PDFs with no text": use higher maxChars (-1 = no limit) and post-process with regex

## Common errors

- `Archivo no existe: <url>` → MarkItDown DOES NOT accept remote URLs, only local paths
- `success=false, null message` → MinerU backend unavailable, check `markitdown_health`

## Use cases

- HR: constancias laborales batch processing
- Legal: contract review with field extraction
- Accounting: factura digitization
- Academic: scanned theses parsing

## Metrics

- Tools used: 8 (markitdown_convert, create_document, add_heading x2, add_paragraph x2, add_table x2, format_table x2)
- Time: ~15s for 1-page PDF
- Output: docx ~38 KB
