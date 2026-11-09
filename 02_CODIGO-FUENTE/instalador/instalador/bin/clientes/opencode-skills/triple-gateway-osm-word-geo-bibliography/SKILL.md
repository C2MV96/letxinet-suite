---
name: triple-gateway-osm-word-geo-bibliography
description: Use when you need a structured geographic bibliography report WITHOUT PDF round-trip (faster than quad). Combines Gateway academic search + OSM geocode/explore_area + Word docx generation. Ideal for regional capacity mapping, university cluster analysis, scientific output by country/institution.
trigger_keywords: geobibliografia, geo bibliography, capacity mapping, regional analysis, university cluster, no pdf roundtrip
---

# SKILL: Triple T1 — Gateway + OSM + Word Geo-Bibliography (no PDF)

## Proven Chain (2026-08-08, sesion 9A)

```
gateway.search(query="<topic_with_geo_filter>", sources=["openalex","scielo","snrd","bdtd","serpapi"], fastMode=true, filterFalsePositives=true)
    ↓ identify author affiliations from top results
osm.geocode_address(address="<university>, <city>, <country>", lang="es")
    ↓ extract lat/lon + neighborhood + postal_code + importance
osm.explore_area(latitude=<lat>, longitude=<lon>, radius=1000)
    ↓ returns POIs categorized by amenity/leisure/natural/shop/tourism
word.create_document(filename="<output.docx>", title="<title>", author="Triple T1")
word.add_heading(level=1, ...)
word.add_paragraph(text="<pipeline_intro>")
word.add_heading(level=2, "1. Resultados Academicos")
word.add_paragraph(text="<search_summary>")  # author groups identified
word.add_table(rows=N+1, cols=6, data=<papers_matrix>)  # title/authors/year/DOI/cites
word.format_table(table_index=0, ...)
word.add_heading(level=2, "2. Geocodificacion y Caracteristicas del Campus")
word.add_paragraph(text="<institution_coords_neighborhood_summary>")
word.add_table(rows=POIs_categories+1, cols=3, data=<category/subtype/count>)
word.format_table(table_index=1, ...)
word.add_heading(level=2, "3. Conclusiones y Mapeo de Capacidad Regional")
word.add_paragraph(text="<academic_findings_conclusions>")
word.add_paragraph(text="<pipeline_metadata_footer>")
```

## Validated Output (S9A 2026-08-08)

### Topic: K. hansenii Brazil
- Query: "Komagataeibacter hansenii Argentina biocellulose tesis"
- Sources: ["snrd","bdtd","scielo","serpapi"], fastMode=true, filterFalsePositives=true
- Result: 4 papers en 7.4s (todas SciELO Brasil)
- Author group: Schneider A.L.S (UNIVILLE Joinville SC, 2 papers 2021+2024)
- Other group: Embrapa Ceará (Lima/Rosa 2017, 47 cites)
- DOI: 10.1590/0104-6632.20180353s20170327, 10.1590/s1517-707620210004.1392, etc.

### Geocoding UNIVILLE Joinville
- Address: "Universidade da Regiao de Joinville, Joinville, Santa Catarina, Brasil"
- Result: lat=-26.3676616, lon=-48.826588, importance 0.053 (aceptada)
- Barrio: Boehmerwald (alt_name Escolinha, pop 17696)
- CEP: 89235-400

### Area analysis (radius 1000m)
- Total POIs: 72
- Amenidades: 32 (8 parking, 5 iglesias, 3 farmacias, 3 comida rapida, 2 escuelas, 2 clinicas, 1 banco)
- Recreacion: 3 (2 playgrounds, 1 sports_centre)
- Naturales: 24 (12 trees, 9 wood, 2 heath, 1 tree_row)
- Tiendas: 13 (3 ropa, 2 muebles, 1 supermercado, 1 verdureria, 1 DIY, etc.)
- Documento final: T1-geo-bibliography-joinville.docx (39910 bytes = 39 KB)

## When to use this skill

- Mapping regional research clusters sin necesidad de leer PDFs
- Comparar capacidad academica entre universidades
- Reporte ejecutivo para decidores que necesitan contexto academico-geografico
- Casos donde el tiempo es critico (sin PDF round-trip, ~30s end-to-end)

## Recommended sources subsets

- **biotech_global**: pubmed + scopus + openalex + semantic + zenodo + rraae
- **peru_focus**: renati + laref_peru + serpapi + unam
- **brasil_focus**: bdtd + oasisbr + rraae + laref_brasil + scielo
- **conosur**: snrd + bdtd + espana + scielo + laref_argentina + laref_chile

## Gotchas

1. **Geocoding de universidades con importance < 0.05**: descartadas. Workaround: agregar ciudad/pais al address, o pasar coords manuales
2. **filterFalsePositives=true descarta papers que matchearon geo pero no tema**: util para reducir ruido en topics con posible ambiguedad (ej: Buenos Aires ++ formato corto)
3. **snrd y bdtd pueden retornar 0**: estos repositorios responden pobremente en biotecnologia. Tener scielo + serpapi como backup
4. **explore_area > 1000m en zonas densas puede 504**: mantener 800-1000m default

## Anti-pattern

No incluir markitdown_convert ni convert_to_pdf aqui — este pipeline es para reportes rapidos sin extraccion PDF. Para reportes con ingestion PDF, usar el quad-pipeline-academic-georeport.

## Compared to Quad Q1

| Aspect | T1 triple | Q1 quad |
|--------|----------|---------|
| MCPs | 3 | 4 (no MD) |
| Tiempo | ~30s | ~2 min |
| Output | docx only | docx + pdf + markdown |
| Caso | Rapido, decision ex | Archives, LLM-friend |

## Metrics

- Tools used: 9 (search, geocode_address, explore_area, create_document, add_heading x4, add_paragraph x3, add_table x2, format_table x2)
- Time: ~30s end-to-end
- Output: 1 docx ~40 KB
- Fuentes reward: snrd=0, bdtd=0, scielo=4, serpapi=0 (use serpapi como fallback when slot of Google Scholar is available)
