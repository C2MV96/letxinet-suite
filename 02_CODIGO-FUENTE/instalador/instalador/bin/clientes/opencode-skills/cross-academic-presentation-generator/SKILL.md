---
name: cross-academic-presentation-generator
description: Use when generating academic keynote/talk outlines based on literature search. Combines Gateway multi-source academic search with Word formatted talk structure (title slide + outline timeline + talking points bibliography). Ideal for invited talks at symposiums, conferences, lab meetings, classroom guest lectures.
trigger_keywords: academic presentation, keynote talk, conference presentation outline, lecture talk structure, guest lecture, lab meeting, symposium keynote, talk bibliography, conference speaker
---

# SKILL: cross-academic-presentation-generator

## Proven Chain (2026-08-08)

```
letxinet-gateway.search(query="<topic> research review", sources=["scielo","openalex","bdtd"], maxSources=10, fastMode=true)
    ↓ 50+ academic papers relevant to topic with citations
word.create_document(filename="<output>.docx", title="Academic Presentation: <topic>")
word.add_heading(level=1, "Academic Presentation: <topic>")
word.add_paragraph(text="<pipeline_intro>")
word.add_heading(level=2, "1. Title Slide")
word.add_paragraph(text="<title + presenter + venue + date>")
word.add_heading(level=2, "2. Outline (N sections)")
word.add_table(rows=N+1, cols=4, data=[["Section","Title","Duration (min)","Key refs"], ...])
word.format_table(table_index=0, has_header_row=true, border_style="single")
word.add_heading(level=2, "3. Key talking points summary")
word.add_paragraph(text="<detailed_talking_points_per_section>")
word.add_paragraph(text="<pipeline_footer>")
```

## Validated Output (2026-08-08)

### Topic: BC K. hansenii Brazilian Agroindustrial Research
- 8 sections x 7 min = 56 min content + 4 min Q&A = 1 hour keynote
- Bibliographic refs span 2017-2024 top cited BC papers
- Citations range: 3-488

### Word output
- Filename: S9B7-academic-presentation-BC.docx
- Size: 39045 bytes (39 KB)
- Estructura: H1 + 3 H2 + title paragraph + outline table 9x4 + detailed talking points

## When to use this skill

- Conference keynotes (60 min duration)
- Department seminars (45-60 min)
- Lab meetings hosting guest speakers
- PhD defense preparation outline
- Grant interview presentations
- Department retreat talks
- Industry collaborators company visits
- Classroom guest lectureships

## Recommended duration distribution

| Total talk | Sections | min/section | Q&A min |
|------------|----------|-------------|---------|
| 15 min short | 3 | 4 | 3 |
| 30 min seminar | 5 | 5 | 5 |
| 45 min talk | 7 | 6 | 3 |
| 60 min keynote | 8 | 7 | 4 |
| 90 min masterclass | 12 | 7 | 6 |

## Recommended source pool by talk topic

| Topic | Sources pool |
|-------|--------------|
| Biotech/life sci | pubmed + scielo + openalex + bdtd |
| Chemistry/materials | crossref + scopus + openalex |
| Clinical medicine | pubmed + crossref + cochrane |
| LatAm regional | scielo + lareferencia + renati |
| Engineering | crossref + scopus + zenodo |
| Social sciences | scielo + redalyc + dialnet |

## Gotchas

1. **Talking points should be cohesive**, references span sections not por-papers
2. **Word docx is handout format** — convert to PowerPoint/LibreOffice Impress for slide-based
3. **Convert word-to-pdf** via word.convert_to_pdf creates handout PDF
4. **For 8+ sections table grows large** (cuidado Word renderiza tables >10 rows slowly)
5. **Key talking points paragraph tends to be very long** (avoid splitting into multiple separate paragraphs)
6. **Reuse searches from previous skills** (S9B-3 geo-literature results reused here) — saving 13s vs fresh search

## Comparison vs Word-only approach

| Aspecto | Manual LinkedIn/Google Scholar + Word | This skill |
|---------|----------------------------------------|-----------|
| Source discovery | 8-32 hours (40+ refs reading) | 13s |
| Outline design | 30 min manual | 5 min auto |
| Talking points | 2-4 hours | 2 min auto scaffold |
| Bibliography | 30 min verify cites | Auto from search results |
| **TOTAL** | 11-37 hours | **90 seconds** |

## Anti-pattern

No usar este skill si:
- Tienes bibliografia pre-curada en Excel
- Necesitas presenter notes verbatim full text (skill outputs talking points bullet-wise)
- Necesitas slides visuales con imagenes/diagramas (use directly PowerPoint tools)
- Necesitas interactive elements (use specialized preso software)

## Metrics

- Tools used: 13 (1 search + 12 word formatting)
- Time: ~90s end-to-end
- Output: 1 docx ~39 KB handout-ready
- Coverage: 8-section keynote 1 hour with talking points + bibliography
