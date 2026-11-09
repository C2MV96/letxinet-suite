---
name: word-document-audit
description: Use for inspecting existing docx files — get metadata (title, author, page/word/paragraph/table counts), outline structure (paragraph + table preview), and full text extract. Ideal for document inventory, content audits, version comparisons, automated QA, anti-tampering verification.
trigger_keywords: docx audit, document metadata, paragraph table counts, outline extractor, full text extract, docx inventory, document structure
---

# SKILL: word-document-audit (solo-Word S9E-3)

## Proven Chain (2026-08-08)

```
word.get_document_info(filename="<doc.docx>")
  ↓ JSON: title, author, created, modified, page_count, word_count, paragraph_count, table_count
word.get_document_outline(filename="<doc.docx>")
  ↓ JSON: paragraphs [{index, text, style}], tables [{index, rows, columns, preview}]
word.get_document_text(filename="<doc.docx>")
  ↓ plain text extract all content (paragraphs + tables printed in order)
```

## Validated Output (2026-08-08)

**S9E-3 audit of S9E1-template-generator.docx:**

### get_document_info JSON
```json
{
  "title": "Template Generator Demo Document",
  "author": "LetXinet Harness S9E-1",
  "created": "2013-12-23 23:15:00+00:00",
  "modified": "2013-12-23 23:15:00+00:00",
  "revision": 1,
  "page_count": 1,
  "word_count": 26,
  "paragraph_count": 4,
  "table_count": 1
}
```

### get_document_outline JSON
```json
{
  "paragraphs": [
    {"index":0,"text":"COSAS POR HACER","style":"Heading 1"},
    {"index":1,"text":"Este documento fue generado automaticamente...","style":"Normal"},
    {"index":2,"text":"Objetivos","style":"Heading 2"},
    {"index":3,"text":"1. Demostrar pipeline completo omni-word-mcp...","style":"Normal"}
  ],
  "tables": [
    {"index":0,"rows":4,"columns":3,"preview":[["Paso","Tool","Resultado"],["1","create_document","docx vacio"],...]}
  ]
}
```

### get_document_text (plain)
```
COSAS POR HACER
Este documento fue generado automaticamente por omni-word-mcp...
Objetivos
1. Demostrar pipeline completo omni-word-mcp...
Paso
Tool
Resultado
1
create_document
docx vacio
...
```

## When to use

- Document inventory audit for compliance archive
- Automated QA pass — verify heading hierarchy + table counts
- Tampering check — compare modified date vs expected revision
- Content extraction for LLM ingestion (use get_document_text)
- Version diffing — compare two docx outlines side-by-side
- Library deduplication — hash by author + word_count + created
- Copyright audit — verify author claims in metadata
- Translation workflow — verify source paragraph count vs target

## Audit decision table

| Use case | Best tool |
|----------|-----------|
| Metadata only | get_document_info |
| Structure (TOC) | get_document_outline |
| Full text LLM feed | get_document_text |
| Single paragraph | get_paragraph_text_from_document |

## Gotchas

1. **created/modified dates** are in docx core.xml — may show template epoch 2013-12-23 not current
2. **revision** increments per save — Word may not always increment
3. **page_count** computed by Word — may be cached unless Word re-saved it
4. **Outline text truncated** in preview — use get_paragraph_text_from_document for full
5. **Outline order preserved** as document order (paragraph 0 = first)
6. **Style names**: "Normal", "Heading 1", "Heading 2", "Title", "Subtitle", custom style names
7. **Tables array index** matches document flow — first table encountered = index 0

## Anti-pattern

No usar este skill si:
- Necesitas markdown (use markitdown_convert instead)
- Necesitas edit the docx (use search_and_replace / add_paragraph)
- Necesitas image count (use python-docx direct)

## Metrics

- Tools used: 3 (get_document_info + get_document_outline + get_document_text)
- Time: ~3s total combined
- Output: full audit JSON + plaintext extract of S9E1 in seconds
