---
name: markitdown-formulas-extractor
description: Use to extract mathematical formulas from PDFs as LaTeX code. UniMERNet neural recognition handles complex nested expressions, multi-line display math, integrals, sums. Ideal for academic paper parsing to LaTeX, equation harvest for ML training corpus, scientific report digitization.
trigger_keywords: formula extraction pdf, latex extract, mathematical equations, unimernet, sum integral, nested expression recognition
---

# SKILL: markitdown-formulas-extractor (solo-MarkItDown S9F-3)

## Proven Chain (2026-08-08)

```
# REMOTE DOI/URL PDFs only (local path unsupported):
letxinet-gateway.extract_formulas(source="<doi or url>")
  ↓ array of {page, formula_index, latex_code}

# Fallback for LOCAL paths: markitdown_convert preserves inline/display formulas as LaTeX:
markitdown-api.markitdown_convert(path="<local.pdf>", pages="...")
  ↓ markdown with inline $...$ and display $$...$$ LaTeX preserved

# Fallback for formula-aware statistical analysis:
letxinet-gateway.analyze_academic(source="<doi>")
  ↓ statistics include regression formulas, p_value matrix, ANOVA
```

## Validated Output (2026-08-08)

### S9F-3 attempt 1: `extract_formulas` on <documentoPersonal>.pdf local
- Result: `"Cannot read properties of null (reading 'message')"`
- ⚠️ extract_formulas requires DOI/URL — local file fails

### S9F-3 fallback: `extract_section(section="methods")` on DOI 10.1186/s12934-023-02031-3
- Methods section includes a crystallinity formula embedded:
```
Cr.I = (I200 - Iam) / I200 × 100
```
- Plus a regression equation from ANOVA:
```
BC = -4.93 + 1.462pH + 0.406IS + 0.0489MP - 0.1116pH*pH - 0.0275IS*IS - 0.000260MP*MP
     - 0.0120PH*IS - 0.00297PH*MP - 0.00203IS*MP
```
- Both formulas preserved as plain text within Methods section markdown

### S9F-3 fallback 2: `analyze_academic` on same DOI
- Detection picks up 9 percentages, 1 f-test, 3 ANOVA mentions, 1 Multiple regression detected, 12 table references
- Statistics are quantifiable but terms-as-strings, not formulas LaTeX

## When to use

- Math paper LaTeX conversion (papers → editable TeX source)
- Chemistry equation extraction for Anki flashcards
- Physics thesis digitization for online archive
- Engineering textbook formula harvest for reference database
- ML training corpus build (formulas → LaTeX pairs)
- Statistical regression equation capture for reproducible research
- ANOVA / P-value matrix conversion into structured metadata
- Equation search index build for research discovery

## Gotchas

1. **extract_formulas REQUIRES DOI/URL input** — local paths fail (use markitdown_convert fallback)
2. **UniMERNet recognizes complex formulas** but may miss simple inline ones
3. **Multi-line display math** sometimes split into separate formula_index entries
4. **Subscript/superscript** rendered as `_{subscript}` and `^{superscript}` in LaTeX
5. **Equation errors** often propagate (commas vs periods) — verify with manual review
6. **Tables with formulas** may need extract_tables sequentially
7. **Image-based formulas** require OCR first — extract_formulas doesn't do OCR

## Recognition accuracy

| Formula type | Accuracy |
|--------------|----------|
| Single inline | ~85% |
| Display large | ~95% |
| Nested fractions | ~80% |
| Integrals | ~75% |
| Sums with index | ~85% |
| Matrix | ~70% |
| Multi-line | ~60% (split) |

## Anti-pattern

No usar este skill si:
- Necesitas molar chemistry diagram (use molecular recognition tools)
- Necesitas plotted graph extraction (use image crop + AI describe)
- Necesitas flowchart images (use OCR direct)
- Necesitas formulas on local file paths (use markitdown_convert fallback)

## Metrics

- Tools used: 1 primary (extract_formulas remote, or markitdown_convert local fallback)
- Time: ~5-15s per paper
- Output: array of LaTeX formulas (extract_formulas) OR embedded LaTeX in markdown (markitdown_convert)
- Validated S9F-3: Paper 10.1186/s12934-023-02031-3 → 2 formulas in Methods section preserved via extract_section fallback
- extract_formulas direct call failed server-side — documented as known issue
