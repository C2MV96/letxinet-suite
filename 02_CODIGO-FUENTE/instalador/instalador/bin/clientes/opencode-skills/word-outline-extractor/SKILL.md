---
name: word-outline-extractor
description: Use for extracting document outline (headings, paragraphs, table preprints) into structured JSON, and full text plaintext extract. Powerful skill for content migration (docx → markdown), compliance TOC checks, paragraph-level indexing for RAG retrieval pipelines, automated Glossary extraction.
trigger_keywords: docx outline json, word heading extract, table preview, paragraph text idx, rag chunk docx, content migration docx to markdown, TOC check
---

# SKILL: word-outline-extractor (solo-Word S9E-8)

## Proven Chain (2026-08-08)

```
word.get_document_outline(filename="<doc.docx>")
  ↓ JSON: paragraphs[{index, text, style}], tables[{index, rows, columns, preview}]
word.get_document_text(filename="<doc.docx>")
  ↓ plain text extract (paragraphs rendered then tables flattened)
word.get_paragraph_text_from_document(filename="<doc.docx>", paragraph_index=<N>)
  ↓ individual paragraph extract by index (composable with RAG chunk indexing)
```

## Validated Output (2026-08-08)

**S9E-8 demo on S9E2-table-rich.docx (multi-table rich doc):**

### get_document_outline JSON
```json
{
  "paragraphs": [
    {"index":0,"text":"REPORTE DE RESULTADOS CON TABLAS","style":"Heading 1"},
    {"index":1,"text":"Documento demo pipeline S9E-2 (table-picture-rich)...","style":"Normal"},
    {"index":2,"text":"Tabla 1: Resumen MCPs Suite LetXinet","style":"Heading 2"},
    {"index":3,"text":"Tabla 2: Estado Fuentes Academicas Pool","style":"Heading 2"}
  ],
  "tables": [
    {"index":0,"rows":5,"columns":4,"preview":[["MCP","Tools","Lenguaje"],["gateway","28","Node"],["osm","41","Go"],...]},
    {"index":1,"rows":5,"columns":4,"preview":[["Estado","Count","Pct"],["O<nombre_tercero>TIVA","30","77%"],["EMPTY","8","20%"],...]}
  ]
}
```

### get_document_text (plain)
```
REPORTE DE RESULTADOS CON TABLAS
Documento demo pipeline S9E-2 (table-picture-rich) sin imagen pero con multiples tablas formateadas.
Tabla 1: Resumen MCPs Suite LetXinet
Tabla 2: Estado Fuentes Academicas Pool
MCP
Tools
Lenguaje
Puerto
gateway
28
Node
4003
...
Total
39
100%
validado 2026-08-07
```

## When to use

- RAG chunk indexing — extract paragraphs → embed each as separate retrieval chunk
- Compliance TOC check — verify heading hierarchy H1 > H2 > H3 intact
- Content migration docx → markdown — outline + style info available
- Index paragraph by paragraph for LLM cite-validation (paragraph_index = source anchor)
- Generate API docs from design Word files
- Library migration audit — extract outlines side by side for diffing
- Build table of contents pages automatically
- Translation workflow — segment by paragraph for batch translation
- Brand style consistency check — count Heading 1 vs Heading 2 distribution

## Output formats

| Tool | Output | Use |
|------|--------|-----|
| get_document_outline | structured JSON | programmatic chunking |
| get_document_text | plaintext | LLM feeding |
| get_paragraph_text_from_document | single string | per-chunk fetch |

## Outline payload schema

```
{
  paragraphs: Array<{index:int, text:string, style:string}>,
  tables: Array<{index:int, rows:int, columns:int, preview:string[][]}>
}
```

## Gotchas

1. **preview truncated** usually first 3 rows only — full cells via get_paragraph_text per-paragraph
2. **Style names** snake case from internal: "Heading 1", "Normal", "Title", "Subtitle"
3. **Headings included in paragraphs array** as well as normal text — index respects doc flow
4. **Tables ordered** by document flow (first encountered = index 0)
5. **Plain text extract** intersperses table cells with paragraphs (preserves flow)
6. **Page breaks** are paragraphs with style="Page Break" — visible in outline
7. **Empty paragraphs** included (style="Normal" text="")

## Anti-pattern

No usar este skill si:
- Necesitas markdown rich formatting preservation (use markitdown_convert)
- Necesitas image extraction (use python-docx apart)
- Necesitas byte-level diff (use git on docx uncompressed)

## Metrics

- Tools used: 2-3 (get_document_outline + get_document_text + optional get_paragraph_text_from_document)
- Time: ~2s combined
- Output: outline JSON (4 paragraphs + 2 tables preview) + plaintext extract S9E-8 S9E2 docx
- Validated: S9E2-table-rich.docx → 4 paragraphs, 2 tables (5x4 each), all previewed successfully
