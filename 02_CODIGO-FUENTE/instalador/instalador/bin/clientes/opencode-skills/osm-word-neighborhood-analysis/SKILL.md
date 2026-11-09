---
name: osm-word-neighborhood-analysis
description: Use when generating real estate or relocation decision reports from OpenStreetMap data. Combines geocode_address → analyze_neighborhood → Word formatted docx with scores and amenities table. Ideal for site evaluation, university location analysis, neighborhood livability.
trigger_keywords: neighborhood, livability, geocode, real estate, relocation, university, scores, walkability, amenities
---

# SKILL: OSM + Word — Neighborhood Analysis Report

## Proven Chain (2026-08-08)

```
osm.geocode_address(address="<institution_or_address>", lang="es")
    ↓ extract lat/lon
osm.analyze_neighborhood(
    latitude=<lat>, longitude=<lon>,
    radius=1000, include_price_data=true,
    neighborhood_name="<name>"
)
    ↓ returns scores + amenities array
word.create_document(filename="<output.docx>", title="<title>", author="LetXinet")
word.add_heading(level=1, text="<institution> - Analisis de Vecindario")
word.add_paragraph(text="<coords_summary>")
word.add_heading(level=2, text="Scores de Habitabilidad")
word.add_table(rows=12, cols=3, data=<scores_matrix>)  # Walk/Bike/Transit/Education/...
word.format_table(table_index=0, border_style="single", has_header_row=true)
word.add_heading(level=2, text="Amenidades Clave")
word.add_table(rows=N+1, cols=3, data=<top_amenities>)
word.format_table(table_index=1, ...)
```

## Validated Output (sesion 8)

### Test 1: UNI Lima, San Martin de Porres
- geocode_address: lat=-12.02, lon=-77.048
- analyze_neighborhood: 81/100 overall (walk=100, education=100, healthcare=100)
- 50+ amenities: 30+ schools, 10 restaurants, 15 parks, 3 hospitals
- Top: UP Cayetano Heredia, Hospital Cayetano Heredia, Instituto Honorio Delgado
- Docx: 38 KB, 5 sections, 2 tables (12x3 + 16x3)

## Scores reference table

| Categoria | Range | Meaning |
|-----------|-------|---------|
| Walk | 0-100 | walkability (100 = walker's paradise) |
| Bike | 0-100 | bikeability |
| Transit | 0-100 | public transport quality |
| Education | 0-100 | schools/universities density |
| Shopping | 0-100 | retail access |
| Dining | 0-100 | restaurants/cafes |
| Recreation | 0-100 | parks/sports |
| Safety | 0-100 | reported incidents |
| Healthcare | 0-100 | hospitals/clinics |
| Overall | 0-100 | avg livability |

## Known gotchas

1. **Geocoding fails with importance < 0.05**: common with ambiguous university names. Workaround: pass coordinates manually if you know them
2. **Overpass 504 timeout on dense areas** (Bogota centro, Lima centro): reduce radius from 1000 to 800m or retry
3. **analyze_neighborhood** is EMPTY in rural areas — give it an urban context
4. **always set include_price_data=true** unless you explicitly want cost-agnostic report

## Suggested queries

- "Universidad Nacional de <pais>, <ciudad>" — academic relocation
- "<hospital name>, <city>" — medical zone evaluation
- "<hotel name>, <tourist destination>" — hospitality site check

## Metrics

- Tools used: 8 (geocode, analyze_neighborhood, create_document, add_heading x2, add_paragraph x2, add_table x2, format_table x2)
- Time: ~25s end-to-end
- Output: docx ~38 KB per site
