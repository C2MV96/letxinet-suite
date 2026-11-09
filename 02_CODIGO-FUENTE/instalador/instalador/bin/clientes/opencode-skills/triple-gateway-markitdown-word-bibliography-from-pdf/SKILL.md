---
name: triple-gateway-markitdown-word-bibliography-from-pdf
description: Use when you have a local PDF (constancia, contract, certificate, administrative doc) and need to integrate it with academic literature about the issuing institution. Combines Gateway multi-source search + MarkItDown local PDF extraction + Word docx. NO OSM used here.
trigger_keywords: pdf context, constancia, certificate, validated, contextualize, local pdf, biblio
---

# SKILL: Triple T3 — Gateway + MarkItDown + Word Bibliography-From-PDF

## Proven Chain (2026-08-08, sesion 9A)

```
markitdown.markitdown_convert(path="<local_pdf>", pages="all", maxChars=5000)
    ↓ extract structured markdown (datos, firmas, periodo, cargo)
gateway.search(
    query="<institution_topic_keywords>",  # ej "<institucion> Peru censo nacional estadistica"
    sources=["scielo","laref_peru","renati","serpapi"],
    fastMode=true, filterFalsePositives=true
)
    ↓ get academic context about issuing institution
word.create_document(filename="<output.docx>", ...)
word.add_heading(level=1, ...)
word.add_paragraph(text="<pipeline_intro>")
word.add_heading(level=2, "1. Datos Extraidos del PDF Local")
word.add_paragraph(text="<pdf_extraction_summary>")
word.add_table(rows=N+1, cols=2, data=<key_value_pairs>)
word.format_table(table_index=0, ...)
word.add_heading(level=2, "2. Bibliografia Academica")
word.add_paragraph(text="<search_summary>")
word.add_table(rows=N+1, cols=5, data=<papers>)
word.format_table(table_index=1, ...)
word.add_heading(level=2, "3. Integracion")
word.add_paragraph(text="<synthesis>")
word.add_paragraph(text="<pipeline_footer>")
```

## Validated Output (S9A 2026-08-08)

### Local PDF ingestion
- Input: <documentoPersonal>.pdf (223 KB, 1 page)
- MarkItDown extraction: 1464 chars
- Datos clave: <APELLIDOS> <NOMBRE> MARK (DNI <DNI>), <cargo_laboral>ón Censal, <ODEI_REGIONAL> <ciudad_usuario>, <periodo_laboral>
- 2 firmas digitales con FAU IDs, fechas Nov 2025

### Gateway search multi-source
- Query: "<institucion> Peru censo nacional estadistica Lima recopilacion"
- Sources: scielo, laref_peru, renati, serpapi
- Tiempo: 51.3s
- Resultado: 10 papers (laref_peru 1, renati 1, serpapi 8)
- Top: Sempé 2021 (Lancet Americas 51 cites - exceso mortalidad COVID Peru)
- 2023 U.Lima (Miyoshi-Uchida): caso estudio <institucion>
- 2014 UPCH (Arauco): canes SMP Lima, 124 cites (usando <institucion> 2007)
- 2018 RPMESP (Ruiz-Maza): produccion cientifica encuestas nacionales
- 2016 UIGV (Gordillo): tablets en recopilacion <institucion>

### Word output
- Filename: T3-biblio-from-PDF-<institucion>.docx (39269 bytes = 39 KB)
- Estructura:
  - H1: Pipeline T3
  - P intro
  - H2: 1. Datos Extraidos del PDF Local
  - P summary
  - Tabla 10x2 (key/value 9 datos + header)
  - H2: 2. Bibliografia Academica
  - P search summary
  - Tabla 8x5 (7 papers + header #/Autor/Año/Titulo/Fuente)
  - H2: 3. Integracion: Documento Inicio + Contexto Bibliografico
  - P synthesis (constancia en marco literatura <institucion>)
  - P pipeline footer

## When to use this skill

- Validar / contextualizar empleados (<documento_laboral> + papers sobre el rol)
- Procesar certificados / contratos / diplomas + literatura de la institucion emisora
- Auditar vinculaciones personales a instituciones con antecedentes academicos
- Genealogia administrativa (PDFs familiares + papers de las instituciones regionales)

## Diferencial vs DUAL MarkItDown+Word (D6)

D6 solo digiere PDF local → docx. T3 AÑADE Gateway search para enriquecer con literatura sobre la institución emisora del PDF.
T3 = D6 + D3 (Gateway+Word biblio) combinados con el PDF local como pivote.

## Recommended sources for institutional research

| Institución emisor | Sources recomendadas | Query sugerida |
|---|---|---|
| <institucion> Perú | scielo + laref_peru + renati + serpapi | "<institucion> Peru censo nacional estadistica" |
| MINSA Perú | scielo + renati + serpapi + pubmed | "MINSA Peru salud publica" |
| SUNEDU | renati + laref_peru + serpapi | "SUNEDU Peru tesis calidad" |
| CONCYTEC | scielo + laref_peru + renati + serpapi | "CONCYTEC Peru ciencia tecnologia" |
| Universidad X | scielo + renati + serpapi | "Universidad X Lima investigación" |

## Gotchas

1. **filterFalsePositives=false**: consume más, pero atrapa jerga institucional sinonimos (ej "estadisticas" vs "estadistica"). Activar en este pipeline.
2. **PDFs > 50 pages**: MarkItDown puede tardar 30s+; usar pages="first5" o pages="1-3" para preview.
3. **renati timeout 2-3 papers por query**: si debes cambiar query, llamar 2x con variantes sinonimas
4. **laref_peru**: muy buena cobertura institucional Lima/Peru (mensual 30 res), usar siempre en queries institucionales peruanas

## Anti-pattern

No usar este skill para PDFs genericos de literatura academica (sin institucion emisora perseptible) — para eso es DUAL Gateway+MarkItDown. T3 shines cuando el PDF tiene una institucion emisora contextualizable.

## Metrics

- Tools used: 12 (markitdown_convert, search, create_document, add_heading x3, add_paragraph x4, add_table x2, format_table x2)
- Time: 5s MD + 51s search + 10s Word = ~70s total
- Output: 1 docx ~39 KB
- Skills previos combinados: D3 (Gateway+Word) + D6 (MarkItDown+Word). T3 los une.
