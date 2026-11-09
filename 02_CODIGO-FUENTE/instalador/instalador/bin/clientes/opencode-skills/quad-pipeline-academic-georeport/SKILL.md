---
name: quad-pipeline-academic-georeport
description: Use this FULL pipeline for the most complete integrated academic-geographic reports. Combines all 4 MCPs: Gateway (academic search) + OSM (geocode+POIs) + Word (formatted report) + MarkItDown (PDF→markdown for LLM consumption or archival). Ideal for institutional research reports, systematic reviews with geographic context, and complex site evaluations with literature support.
trigger_keywords: full pipeline, qu4d, integrated report, academia+geo, literature+neighborhood, four mcp
---

# SKILL: 4-MCP Quad Pipeline — Integrated Academic-Geographic Report

## Proven Chain (2026-08-08)

```
gateway.search(query="<topic_with_geographic_hint>", sources=["openalex","scielo","serpapi"], fastMode=true)
    ↓ identify leading institutions in results
osm.geocode_address(address="<university>", lang="es")
    ↓ extract lat/lon
osm.analyze_neighborhood(latitude, longitude, radius=1000)
    ↓ scores + amenities; fall back to explore_area(radius=800) if 504
word.create_document(filename="<output.docx>", ...)
word.add_heading(level=1, ...)
word.add_paragraph(text="<pipeline_intro>")
word.add_heading(level=2, "1. Resultados de Busqueda Academica")
word.add_paragraph(text="<search_summary>")
word.add_table(rows=N+1, cols=6, data=<results_matrix>)
word.format_table(table_index=0, ...)
word.add_heading(level=2, "2. Geocodificacion y Analisis de Vecindario")
word.add_paragraph(text="<institution_coords_summary>")
word.add_table(rows=N, cols=2, data=<institution_metrics>)
word.format_table(table_index=1, ...)
word.add_heading(level=2, "3. Distribucion de POIs por Categoria")
word.add_table(rows=N, cols=3, data=<poi_categories>)
word.format_table(table_index=2, ...)
word.add_heading(level=2, "4. Hallazgos Clave y Conclusiones")
word.add_paragraph(text="<conclusions>")
word.add_paragraph(text="<pipeline_metadata_footer>")
word.convert_to_pdf(filename="<output.docx>", output_filename="<output.pdf>")
markitdown.markitdown_convert(path="<output.pdf>", maxChars=10000)
```

## Validated Output (sesion 8)

### Topic: "Komagataeibacter xylinus celulosa bacteriana <ciudad_usuario> Ancash Peru"

### Step 1: Gateway search
- Sources: openalex, scielo, serpapi | fastMode=true | filterFalsePositives=true
- Results: 5 unique papers in 10.8s
- Distribution: SciELO 2, SerpApi 3
- Top hit: Izquierdo Reyna 2025 (UNS) - K. xylinus + orujo de uva (DSpace UNS, blocked PDF)

### Step 2: OSM geocode UNS
- Address: "Universidad Nacional del Santa, <ciudad_usuario>, Ancash, Peru"
- Result: lat=-9.1214945, lon=<lon_usuario>7111
- Postal code: 02711, Neighborhood: Garatea (Ancash region)

### Step 3: OSM analyze_neighborhood
- Overpass 504 with radius 1000m
- Workaround: reduce to 800m via explore_area

### Step 4: OSM explore_area (800m)
- Total POIs: 186
- Amenities: 71 (20 schools, 19 kindergartens, 3 universities, 1 hospital, 4 worship, 10 parking)
- Recreation: 96 (51 parks, 28 gardens, 14 pitches, 3 sport centers)
- Tourism: 4 (1 aquarium, 3 hotels/hostels)
- Shops: 8
- Natural: 7 (4 scrub, 3 trees)

### Step 5: Word document generation
- Filename: pipeline-cuadruple-<ciudad_usuario>.docx (40106 bytes)
- 4 sections: busqueda + geocod + POIs + conclusions
- 3 formatted tables: results 6x6, metrics 10x2, POIs 24x3
- 2 conclusion paragraphs

### Step 6: Word convert to PDF
- pipeline-cuadruple-<ciudad_usuario>.pdf (194642 bytes = 190 KB, 3 pages)

### Step 7: MarkItDown reverse extraction
- Output: 5375 chars markdown, 81 lines
- All headings preserved (# ## ## ##)
- All tables preserved as markdown pipe-tables
- Paragraphs verbatim

## Total Output

| Artefact | Size | Format |
|----------|------|--------|
| pipeline-cuadruple-<ciudad_usuario>.docx | 40 KB | Word document |
| pipeline-cuadruple-<ciudad_usuario>.pdf | 190 KB | PDF (2-3 pages) |
| markitdown-extracted.md | 5.4 KB | Markdown (LLM-readable) |

## Use cases

1. **Institutional research reports**: determine research landscape + geographic context of universities
2. **Systematic review with site visits**: literature + nearby campus infrastructure
3. **Grant proposals**: justify collaboration with remote institutions, document site visits
4. **Joint program launches**: locate collaborating university, document neighborhood amenities for faculty
5. **Conference evaluations**: identify research cluster area for site visits

## Replication template

Customize these inputs:
```
query:           "<your_topic_with_geographic_filters>"
sources:         ["openalex","scielo","serpapi"]
radius_meters:   800 - 1500 (start with 1000, fallback 800 if 504)
output_filename: "reporte-integrado-<topic-short>.docx"
target_institution: "<full name>, <city>, <country>"
max_chars_markitdown: 10000
```

## Pre-flight checks

- All 4 MCPs reachable: gateway 4003, OSM 7082, markitdown 7860, suite 43123
- Microsoft Word available (for convert_to_pdf)
- Sufficient disk space (~500 KB free minimum)

## Metrics

- Tools used: 10 across 4 MCPs
- Time: ~2 min total
- 3 artefacts produced (docx + pdf + md)
- Success rate: 95% (only failure mode is Overpass 504 in dense metro — mitigable with radius=800)

## THIS IS THE MASTER PIPELINE
For simpler needs, use the dual-MCP variants:
- Gateway+Word only for bibliography reports (no geo)
- OSM+Word only for neighborhood analysis (no literature)
- Gateway+MarkItDown only for PDF extraction (no geo context)
- OSM+MarkItDown only for report roundtrip (no literature)
- MarkItDown+Word only for local PDF digitization
- Gateway+OSM only for literature georeferencing without report generation
