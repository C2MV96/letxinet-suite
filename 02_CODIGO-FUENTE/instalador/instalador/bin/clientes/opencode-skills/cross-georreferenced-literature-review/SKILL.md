---
name: cross-georreferenced-literature-review
description: Use when geographically mapping academic literature output (e.g. systematic review + research institutions geocoded). Combines Gateway multi-source search with OSM geocoding of author affiliations + centroid calculation + map generation + Word docx with geographic distribution insights. Useful for R&D policy, hub identification, regional comparative analysis, science mapping.
trigger_keywords: georreferencia, geographic literature, compute hubs, academic map, R&D spatial distribution, institutions geographic, centroide research, science mapping, spatial scientometrics
---

# SKILL: cross-georreferenced-literature-review

## Proven Chain (2026-08-08, sesion 9B test 3)

```
letxinet-gateway.search(query="<topic> <country> universities", sources=["scielo","openalex","bdtd"], maxSources=10, fastMode=true)
    ↓ 50-80 academic papers with university affiliation in <text>
letxinet-gateway.geocode_address(address="<university name>, city, country", lang="es")  x N parallel
    ↓ N coords + importance scores per institution
letxinet-gateway.centroid_points(points=[{lat,lon}...])
letxinet-gateway.get_map_image(latitude=<centroid_lat>, longitude=<centroid_lon>, zoom=5)
    ↓ PNG tile regional coverage
word.create_document(filename="<output>.docx", title="Georreferenced Literature Review: <topic>")
word.add_heading(level=1, "Georreferenced Literature Review: <topic>")
word.add_paragraph(text="<pipeline_intro>")
word.add_heading(level=2, "1. Mapa — Centroid de Universidades investigadoras")
word.add_paragraph(text="<map_description_with_centroid>")
word.add_heading(level=2, "2. Georreferenciacion — Top Institutions")
word.add_table(rows=N+1, cols=6, data=[["#","University","City/State","Latitude","Longitude","Importance"], ...])
word.format_table(table_index=0, has_header_row=true, border_style="single")
word.add_heading(level=2, "3. Top Papers Identificados con Pixel-Coords Mapped")
word.add_table(rows=M+1, cols=5, data=[["#","Author Year","University","Lat","Lon"], ...])
word.format_table(table_index=1, has_header_row=true, border_style="single")
word.add_heading(level=2, "4. Geographic Distribution Insights")
word.add_paragraph(text="<insights_summary>")
word.add_paragraph(text="<pipeline_footer>")
```

## Validated Output (2026-08-08)

### Query: BC K. hansenii Brazil
- Scielo: 8 results 6.6s
- OpenAlex: 49 results 2.9s (broad coverage with university field)
- BDTD: 18 results 33s (Brazilian theses repository)
- Total: 75 papers identificados en 13s

### Geocoding results
- 4 institutions geocoded with OSM (UFC, UFPE, UFSCar, UEL)
- 4 institutions coords manually estimated (UNIVILLE, UESC, UFRPE, external)
- 1 centroid calculation (lat=-11.71, lon=-41.58 Bahia interior)
- 1 OSM map tile zoom 5 (56 KB) covers NE+SE Brasil

### Word output
- Filename: S9B3-geo-literature-review-BC-Brazil.docx
- Size: 39502 bytes (39 KB)
- Estructura: H1 + 4 H2 + 2 parrafos + 2 tables (9x6 + 11x5)

## When to use this skill

- R&D geography / ciencia espacial
- Hub innovation discovery for government policy
- Comparative research between universities across country/region
- University partnership recommendations
- Science policy funding allocation
- Hub geographic identification
- Multi-institution research consortium planning
- PhD candidate location decision

## Recommended source pool for academic affiliations

| Coverage | Sources pool |
|----------|--------------|
| LatAm-wide | scielo + openalex + bdtd + lareferencia |
| Brazil only | scielo + bdtd + openalex |
| Peru/Colombia | renati + minciencias + openalex + laref_peru |
| Mexico | unam + laref_mexico + openalex |
| International context | openalex + crossref + scopus |

## Gotchas

1. **OSM geocode importance filter <0.05** discards smaller regional universities — workaround: pass coords manually OR simplify address
2. **get_map_image zoom 5** is good for country-level coverage (~500-1000 km tiles). For zoom>10 changes detail pero tile size limit
3. **centroid_points** calcula media aritmética — sensitive to outliers, eliminar instituciones extranjeras antes
4. **University field in OpenAlex** is primary affiliation — single-author multi-affiliation not merged
5. **Scielo returns "FapUNIFESP" como university** (funding agency no institution) — manual mapping
6. **Map zoom syntax**: zoom 5 country, zoom 10 city, zoom 15 block — different tiles size

## Anti-pattern

No usar este skill si:
- Necesitas heatmap of citations por institution (this skill solo georeferences)
- Requieres travel time matrix (use route_fetch + route_sample)
- Necesitas interactive map (this generates static tile only)

## Metrics

- Tools used: 14 (3 search + 4 geocode + 1 centroid + 1 get_map_image + 5 word)
- Time: ~25s end-to-end
- Output: 1 docx ~39 KB
- Coverage: 4 universities OSM-geocoded + 4 manual + 1 centroid + 1 map tile
