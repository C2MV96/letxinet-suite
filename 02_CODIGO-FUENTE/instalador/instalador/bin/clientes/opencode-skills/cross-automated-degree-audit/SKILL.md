---
name: cross-automated-degree-audit
description: Use for automated academic degree audit — ingests a transcript PDF via MarkItDown (local path), then generates an audit docx via Word with course completion table + footnotes (FERPA-style confidentiality remarks) + endnotes (auditor comments). Optionally password-protects the docx for compliance. Ideal for university compliance office, millennial-generation credentials verification, homeschool transcript digitization.
trigger_keywords: degree audit, transcript digitization, academic audit docx, ferpa, course completion audit, homeschool transcript, university compliance
---

# SKILL: cross-automated-degree-audit (S9G-4)

## Proven Chain (2026-08-08)

```
markitdown.markitdown_convert(path="<transcript.pdf>", pages="all", maxChars=8000)
  ↓ structured markdown with course entries
[word.search_and_replace optional cleanup]
word.create_document(filename="<audit.docx>", title="Audit de Grado")
word.add_heading level=1 "INFORME DE AUDITORIA ACADEMICA - <grado>"
word.add_heading level=2 "Resumen de Cumplimiento de Curso"
word.add_paragraph intro
word.add_heading level=2 "Cursos Obligatorios Completados"
word.add_table rows=N cols=4 [Cod|Nombre|Creditos|Estado]
word.format_table border_style=single has_header_row=true
word.add_heading level=2 "Observaciones del Auditor + Footnotes"
word.add_footnote_to_document(paragraph_index=2, footnote_text="...")
word.add_endnote_to_document(paragraph_index=N, endnote_text="...")
[word.protect_document(password="audit-confidential")]  # optional
word.get_document_outline  # audit verification
word.get_document_info  # audit metadata
```

## Validated Output (2026-08-08)

### S9G-4 demo on S9G4-degree-audit.docx
1. `create_document` filename="S9G4-degree-audit.docx" title="Automated Degree Audit Demo" author="LetXinet S9G-4"
2. `add_heading` level=1 "INFORME DE AUDITORIA ACADEMICA — Grado en Bioingenieria"
3. `add_heading` level=2 "Resumen de Cumplimiento de Curso"
4. `add_paragraph` "Documento generado por harness S9G-4 demo automated-degree-audit pipeline..."
5. `add_heading` level=2 "Cursos Obligatorios Completados"
6. `add_table` rows=6 cols=4 data=[["Cod Curso","Nombre","Creditos","Estado"],["BIO101","Biologia Celular","4","APROBADO"],["BIO201","Genetica Molecular","4","APROBADO"],["BIO301","Microbiologia","4","APROBADO"],["BIO401","Biorremediacion","3","PENDIENTE"],["MAT101","Calculo I","4","APROBADO"]]
7. `format_table` table_index=0 border_style=single has_header_row=true
8. `add_heading` level=2 "Observaciones del Auditor + Footnotes"
9. `add_footnote_to_document` paragraph_index=2 footnote_text="S9G-4 demo footnote: ENCRYPTION IS OPTIONAL post-audit if contains PII data (per FERPA conventions)."
10. `add_endnote_to_document` paragraph_index=7 endnote_text="S9G-4 endnote: auditoria demostrativa — transcript PDF proxy via <documentoPersonal>.pdf markitdown_convert."

### MarkItDown transcript S9F-1 cross-reference
- `markitdown_convert` "<documentoPersonal>.pdf" pages=all maxChars=8000
- 1464 chars / 35 lines / 1 page / not truncated markdown retrieved

## Audit docx structure

```
INFORME DE AUDITORIA ACADEMICA - <degree_name>
Resumen de Cumplimiento de Curso
<paragraph with summary>

Cursos Obligatorios Completados
| Cod Curso | Nombre             | Creditos | Estado    |
|-----------|---------------------|----------|-----------|
| BIO101    | Biologia Celular   | 4        | APROBADO  |
| BIO201    | Genetica Molecular | 4        | APROBADO  |
| BIO301    | Microbiologia      | 4        | APROBADO  |
| BIO401    | Biorremediacion    | 3        | PENDIENTE |
| MAT101    | Calculo I          | 4        | APROBADO  |

Observaciones del Auditor + Footnotes
[paragraph content with footnote reference 1]
[paragraph closing with endnote marker]

Footnote 1: S9G-4 demo footnote: ENCRYPTION IS OPTIONAL post-audit if contains PII data (per FERPA conventions).
Endnote 1: S9G-4 endnote: auditoria demostrativa — transcript PDF proxy via <documentoPersonal>.pdf markitdown_convert.
```

## When to use

- University compliance office semester audit cycle
- Transfer student credit validation (university A → university B)
- Defense master's degree final transcript verification
- International credential verification (e.g., university degrees for immigration)
- Home school transcript digitization for college application
- Adult learner diploma audit for vocational retraining
- Employer education verification (HR pre-employment screening)
- Custom degree planner audit (degree audit per semester)
- Online course completion audit (Coursera / edX micro-credential)

## Compliance frameworks applicable

| Framework | Country | Confidentiality handling |
|-----------|---------|--------------------------|
| FERPA | USA | protect_document advisable |
| GDPR | EU | unprotect only by authorized officer |
| LOPDGDD | Spain | data minimization + access log |
| Mexico AL | various | encrypt at rest |

## Gotchas

1. **Transcript PDF format varies wildly** — markitdown_convert may produce different structural markdown; consider search_and_replace cleanup
2. **Course codes pattern** — universities use different conventions (BIO101, B-101, BI-MA-101, etc.)
3. **Bilingual transcripts** — markitdown_convert handles well via PyMuPDF4LLM OCR if scanned
4. **Audit history retention** — protect_document for long-term storage; consider archive strategy
5. **paragraph_index 0-based** — verify via get_document_outline before adding footnote/endnote
6. **Footnote simplified approach** inserts at paragraph END (not mid-paragraph) — no custom position
7. **For scanned transcripts** may need MinerU Cloud (Gateway batch_convert) with OCR enabled (paid feature)

## Optional post-audit steps (in SKILL)

- `protect_document` with FERPA-style password if PII (DOB, SSN) present
- `convert_to_pdf` for advisory copy to student
- `get_document_outline` final audit verification before archival
- `get_document_info` metadata audit trail (author, revision, modified date)

## Anti-pattern

No usar este skill si:
- Necesitas official transcript validation service (use Credentials Evaluators Service direct)
- Necesitas blockchain credential verification (use Learning Machine / Blockcerts platform)
- Necesitas degree verification for immigration (use DHS / USCIS direct)
- Necesitas university accreditation status (use CHEA / Dept of Education database)

## Metrics

- Tools used: ~10-12 (markitdown_convert + create_document + 4 add_heading + add_paragraph + add_table + format_table + add_footnote + add_endnote + optional protect + audit)
- Time: ~30-45s end-to-end
- Output: `.docx` audit ~15-40 KB; optional `.pdf` ~100 KB
- Validated S9G-4: 6x4 audit table created + footnote p2 + endnote p7 successfully attached
