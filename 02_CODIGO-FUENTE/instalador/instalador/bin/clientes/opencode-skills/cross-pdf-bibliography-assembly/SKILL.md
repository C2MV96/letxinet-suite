---
name: cross-pdf-bibliography-assembly
description: Use when building a literature review integrating evidence extracted from local PDFs (constancias, contracts, permits, evidence) with academic bibliography fetched via Gateway batch_search. Combines MarkItDown local PDF extraction + Gateway multi-query search + Word formatted bibliography with cross-references. Ideal for grant proposals with required evidence attachments, theses chapters with mixed evidence+bibliography, technical reports with administrative + scientific backing.
trigger_keywords: PDF bibliography, constancia, contracts + papers, evidence academic, evidencial academic, grant proposal bibliography, technical report mixed evidence, refs review, bibliografia integrada, anexo PDF + bibliografía
---

# SKILL: cross-pdf-bibliography-assembly

## Proven Chain (2026-08-08, sesion 9B test 4)

```
markitdown.markitdown_convert(path="<local_pdf>", pages="all", maxChars=5000)
    ↓ Extrae texto estructurado del PDF evidencial (constancia, contract, permit)
letxinet-gateway.batch_search(queries=["<academic_q1>","<academic_q2>","<academic_q3>"], sources=["pubmed","openalex"], maxResults=25, fastMode=true)
    ↓ 25-60 academic papers con DOIs y citas en ~80s
[Optional: letxinet-gateway.enrich_metadata(papers=[...]) for missing DOIs/abstracts]
word.create_document(filename="<output>.docx", title="PDF-Bibliography Assembly: <topic>")
word.add_heading(level=1, "PDF-Bibliography Assembly: <topic>")
word.add_paragraph(text="<pipeline_intro>")
word.add_heading(level=2, "1. PDF Local Evidencial")
word.add_paragraph(text="<pdf_metadata_summary>")
word.add_heading(level=2, "2. Bibliografia Academica")
word.add_table(rows=N+1, cols=5, data=[["#","Author Year","Title (abbreviated)","Citations","DOI"], ...])
word.format_table(table_index=0, has_header_row=true, border_style="single")
word.add_heading(level=2, "3. Cross-references")
word.add_paragraph(text="<topic_clustering_summary>")
word.add_paragraph(text="<pipeline_footer>")
```

## Validated Output (2026-08-08)

### PDF local
- Filename: <documentoPersonal>.pdf (223 KB)
- MarkItDown output: 1464 chars structured
- Datos clave: <NOMBRE_COMPLETO> (DNI <DNI>), <CARGO_LABORAL> <ODEI_REGIONAL> <ciudad_usuario>, periodo <periodo_laboral>

### Academic batch_search
- Queries: 3 (BC Komagataeibacter DOI systematic review, BC K. hansenii agroindustrial Brazil, nanocellulose biomedical applications K. xylinus)
- Sources: pubmed + openalex
- Results: 25 unique papers en 80s
- Top 10 papers con citation 38-488 cubren spectrum BC research 2017-2024

### Word output
- Filename: S9B4-PDFs-to-bibliography.docx
- Size: 38879 bytes (38 KB)
- Estructura: H1 + 3 H2 + 2 parrafos + 1 table 11x5

## When to use this skill

- Grant proposals con evidence PDF (legal/institutional) + academic bibliography
- Tesis chapters integrating personal/work evidence + research literature
- Technical compliance reports requiring both regulatory evidence + scientific backing
- Conference posters with institutional support + cited literature
- Project proposals with administrative + academic context
- Government reports mixing legal + academic references

## Recommended PDF local types (evidence)

- Constancias labor (<institucion_emisora>, <registro_civil>, <autoridad_local>)
- Convenios institucionales
- Permiso concesión administrative
- Contracts comercial
- Licencias técnicas
- Diplomas título profesional
- Actas de constitución empresa
- Permisos sanitarios

## Recommended source pool for academic part

| Scenario | Sources pool |
|----------|--------------|
| General academy | pubmed + crossref + openalex |
| Biotech / bioprocess | pubmed + scielo + openalex + bdtd |
| Engineering | crossref + scopus + openalex |
| LatAm thảo | scielo + bdtd + renati + lareferencia |
| AI/CS | arxiv + dblp + paperswithcode + openreview |

## Gotchas

1. **MarkItDown maxChars=5000** limit recommendation: PDFs >50 pages to extend
2. **batch_search max 6 queries** per call — multiple batches needed >6 research questions
3. **batch_search sources pooling** parallel-search deduct dedups results
4. **Anti-alucinación verification**: antes de include PDF extraction in Word docx, verify claims via letxinet-gateway.verify_antihallucination_data tool
5. **PDF local path absolute** required (C:\...), no relative paths accepted by markitdown_convert

## Comparison vs S9B-1 EBM PRISMA

| Aspecto | EBM PRISMA | S9B-4 PDF Biblio |
|---------|------------|------------------|
| Source | Solo academia (pubmed+scielo+crossref) | Academia + PDF local |
| Cadena | 3 sources paralelas fast (10s) | 3 queries batch (80s) |
| Coverage | PRISMA flow + RoB + GRADE | PDF local + biblio + cross-ref |
| Use case | Clinical systematic review | Mixed evidence report |

## Metrics

- Tools used: 16 (1 markitdown + 1 batch_search + 14 word)
- Time: ~120s
- Output: 1 docx ~38 KB
- Sources pool: 2 academic (pubmed, openalex) + 1 PDF local
