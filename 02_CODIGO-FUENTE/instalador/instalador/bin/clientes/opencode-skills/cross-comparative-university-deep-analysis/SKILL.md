---
name: cross-comparative-university-deep-analysis
description: Use when comparing research institutions across multiple dimensions (strain diversity, substrate innovation, geographic clustering, research output citations). Combines OSM geocoding + bibliometric academic search + multi-dimension comparative analysis. Output recommendations for joint ventures, hub locations, budget allocations.
trigger_keywords: university comparison, research institutions analysis, hub identification, joint venture partnership, R&D allocation, science policy, comparative universities, hub research geography
---

# SKILL: cross-comparative-university-deep-analysis

## Proven Chain (2026-08-08)

```
letxinet-gateway.geocode_address(address="<university_name>, city, country", lang="es")  x N parallel
    ↓ N coords + importance scores per university
letxinet-gateway.search(query="<topic> <country> universities", sources=["scielo","openalex","bdtd"], maxSources=10, fastMode=true)
    ↓ 50+ academic papers with university affiliations + citations
word.create_document(filename="<output>.docx", title="Comparative University Analysis: <topic>")
word.add_heading(level=1, "Comparative University Analysis: <topic>")
word.add_paragraph(text="<pipeline_intro>")
word.add_heading(level=2, "1. Institutions Compared — Geographic Profile")
word.add_table(rows=N+1, cols=7, data=[["University","Lat","Lon","Region","Focus","Strains","Citations"], ...])
word.format_table(table_index=0, has_header_row=true, border_style="single")
word.add_heading(level=2, "2. Comparative Dimensions Analysis")
word.add_paragraph(text="<multi_dimension_paragraph>")
word.add_heading(level=2, "3. Recommendation for Collaboration/Investment")
word.add_paragraph(text="<tiered_budget_recommendation>")
word.add_paragraph(text="<pipeline_footer>")
```

## Validated Output (2026-08-08)

### Comparison type: Brazilian universities BC research
- 8 universities compared (7 Brazilian + 1 Colombian external)
- Geographic distribution: NE Brasil (3 universidades), SE Brasil (3 universidades)
- Bibliometric counts: 75 papers spanning 2017-2025
- Top citation records per university summed to compare research output

### Word output
- Filename: S9B8-comparative-university-Brazil.docx
- Size: 38924 bytes (38 KB)
- Estructura: H1 + 3 H2 + 2 parrafos + 1 table 9x7

## When to use this skill

- Joint venture partnership decisions (university-industry collaborative)
- Government R&D allocation funding policy decisions
- Geography-based science policy (regional innovation clusters)
- Research consortium formation (multi-university collaboration)
- Hub geographic identification (where to place new institute)
- PhD candidate evaluation comparing research institutions
- Industry R&D recruiter targeting universities for hiring

## Comparative dimensions

| Dimension | Measurement metric | Source |
|-----------|-------------------|--------|
| Geographic distribution | Lat/lon + region | OSM geocode |
| Research output citations | Sum of citationCount | OpenAlex/Crossref |
| Strain diversity | unique species mentioned | search abstracts |
| Substrate innovation | novel substrate names | search abstracts |
| Industry focus | application area + commercialization | search abstracts |
| Hub cluster geo proximity | distance between universities | simple Haversine |
| International collaboration | collaboration countries | search abstracts |

## Recommended source pool for academic side

| Coverage | Sources pool |
|----------|--------------|
| LatAm-wide | scielo + openalex + bdtd + lareferencia |
| Brazil focus | scielo + bdtd + openalex |
| Peru/Colombia | renati + minciencias + openalex |
| International comparison | openalex + crossref + scopus |

## Gotchas

1. **Coord importances not comparable across universities** — set importance as informational only
2. **Lat/Lon often low_confidence for small universities** — use city-level coords fallback
3. **Citation count by affiliation requires manual aggregation** per author affiliation in OpenAlex
4. **Strain diversity taxonomy** requires manual reading of abstracts rapid filtering
5. **Substrates mentioned** include both synthetic and agro — filter out HS/Schramm to count agro
6. **Cluster geographic analysis benefits from centroid_points** aggregating all universities
7. **Recommendations need budget split** — provide rationale 60/40 or 50/50 covering tiers

## Anti-pattern

No usar este skill si:
- Necesitas per-student comparison (PhD cohort counts) — needs university registrar data
- Necesitas current funding per professor (NSF/CAPES Coordenação data)
- Necesitas student-faculty ratio — academic admin data only
- Necesitas patent count comparison (use WIPO/EPO direct instead)

## Metrics

- Tools used: 14 (4 OSM geocode + 1 Gateway search + 9 Word formatting)
- Time: ~75s end-to-end
- Output: 1 docx ~38 KB with 8 universities compared
- Coverage: 7 dimensions covered geographic + bibliographic + recommendation
