---
name: word-footnotes-endnotes
description: Use for adding footnotes (page-bottom references) and endnotes (document-end references) to specific paragraphs in a docx. Also customize footnote numbering format (1,2,3 / i,ii,iii / a,b,c) and font. Ideal for academic citation insertion, legal cross-references, annotated bibliography style.
trigger_keywords: footnote, endnote, citation, page-bottom reference, document-end note, footnote numbering i ii iii, academic citation word
---

# SKILL: word-footnotes-endnotes (solo-Word S9E-4)

## Proven Chain (2026-08-08)

```
word.add_footnote_to_document(filename="<doc.docx>", paragraph_index=<N>,
                              footnote_text="<citation text>")
  ↓ footnote reference inserted at paragraph end + footer note text
word.add_endnote_to_document(filename="<doc.docx>", paragraph_index=<N>,
                             endnote_text="<end-of-document reference text>")
  ↓ endnote reference symbol + endnote text at document start of endnotes section
word.customize_footnote_style(filename="<doc.docx>",
                               numbering_format="i, ii, iii" | "1, 2, 3" | "a, b, c",
                               start_number=1, font_name="Calibri", font_size=9)
  ↓ reformat footnote markers + body
```

## Validated Output (2026-08-08)

**S9E-4 demo on S9E1-template-generator.docx:**

- `add_footnote_to_document` paragraph_index=1
  - footnote_text: "Footnote demo S9E-4: automatizada via omni-word-mcp add_footnote_to_document."
  - Result: "Footnote added to paragraph 1 (simplified approach)"
- `add_endnote_to_document` paragraph_index=3
  - endnote_text: "Endnote demo S9E-4: referencia bibliografica al final del documento..."
  - Result: "Endnote added to paragraph 3"

## Numbering format options

| Format | Sequence |
|--------|----------|
| 1, 2, 3 | Arabic (default) |
| i, ii, iii | Lowercase Roman |
| I, II, III | Uppercase Roman |
| a, b, c | Lowercase alpha |
| A, B, C | Uppercase alpha |

## When to use

- Academic paper citation insertion (footnote per quote)
- Legal cross-reference footnotes Indianapolis-style
- Annotated bibliography at document end (endnotes per source)
- Historic preservation note per paragraph
- Reviewer comment trail with anchored paragraph link
- Translation commentary notes per paragraph (footnote mode)
- Manuscript critical apparatus (endnote with paragraph reference)
- Compliance footnote cross-reference to regulation section

## Footnote vs Endnote choice

| Mode | When |
|------|------|
| footnote | Reader sees immediately (page-bottom) — academic essay |
| endnote | Document-end aggregated (reader flips) — extended bibliography |

## Gotchas

1. **paragraph_index 0-based** — first paragraph = 0
2. **Footnote numbering global** for document — second add_footnote → 2
3. **(simplified approach)** means reference inserted at paragraph end, not custom position
4. **Word footnote customization** applies to ALL footnotes retroactively (no per-footnote style)
5. **Roman numerals reset each section** if document has section breaks
6. **Endnote custom separator** not supported via this tool — use manual Word edit
7. **Paginated PDF** shows footnotes per page (Word renders; convert_to_pdf)

## Anti-pattern

No usar este skill si:
- Necesitas Chicago-style bibliography (use add_paragraph at end)
- Necesitas in-text citation with hyperlink (use add_paragraph with link text)
- Necesitas BibTeX/RIS import (use external pandoc convert)

## Metrics

- Tools used: 3 (add_footnote_to_document + add_endnote_to_document + customize_footnote_style)
- Time: ~5s S9E-4 end-to-end
- Output: footnote at p1 + endnote at p3 added successfully
- Limitation: simplified approach — anchor is paragraph end not arbitrary position
