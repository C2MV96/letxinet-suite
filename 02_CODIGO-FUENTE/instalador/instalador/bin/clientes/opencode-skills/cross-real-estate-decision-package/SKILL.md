---
name: cross-real-estate-decision-package
description: Use when generating real-estate decision packages aggregating OSM neighborhood livability scores + amenities list + price index + PDF local evidence (constancia, contrato) as administrative support. Output a Word docx with livability table + amenities summary + recommendation + anexo legal/evidencia.
trigger_keywords: real estate, livability, neighborhood decision, residential purchase, rental decision, real estate report, property evaluation, neighborhood analysis, alquiler compra decision
---

# SKILL: cross-real-estate-decision-package

## Proven Chain (2026-08-08)

```
letxinet-gateway.analyze_neighborhood(latitude=<lat>, longitude=<lon>, radius=1500, neighborhood_name="<name>", include_price_data=true)
    ↓ Walk/bike/transit/education/shopping/dining/recreation/safety/healthcare scores (0-100) + overall + price_index + 100+ amenities list
[Optional: letxinet-gateway.get_map_image(latitude=<lat>, longitude=<lon>, zoom=15) for visualization]
markitdown.markitdown_convert(path="<local_constancia_or_contrato.pdf>", pages="all", maxChars=5000)
    ↓ Evidencia administrativa extraida del PDF
word.create_document(filename="<output>.docx", title="Real Estate Decision Package: <location>")
word.add_heading(level=1, "Real Estate Decision Package: <location>")
word.add_paragraph(text="<pipeline_intro>")
word.add_heading(level=2, "1. Livability Scores")
word.add_table(rows=13, cols=4, data=[["Dimension","Score","Out of","Notes"], ...])
word.format_table(table_index=0, has_header_row=true, border_style="single")
word.add_heading(level=2, "2. Key Amenities Identified")
word.add_paragraph(text="<amenities_summary_grouped>")
word.add_heading(level=2, "3. Decision Recommendation")
word.add_paragraph(text="<verbal_recommendation_high_moderate_low + safety_considerations + pricing>")
word.add_paragraph(text="<pipeline_footer>")
```

## Validated Output (2026-08-08)

### Location: Miraflores Lima Peru (-12.1196, -77.0425)
- Overall: 95/100
- Strong: Walk 100, Bike 100, Transit 100, Education 100, Shopping 100, Dining 100, Recreation 100, Healthcare 100
- Weak: Safety 60 (moderate caution nocturne)
- Price index 50 (median)
- 100+ amenities (15+ restaurantes top-tier, 4+ malls, 10+ supermercados, 30+ parques, 10+ schools)

### Anexo evidencial
- MarkItDown const_<institucion> <anio> 1464 chars
- Evidencia laboral Lima proximity (DNI <DNI> <cargo_laboral>ón Censal)
- Tiempo transporte Lima Centro ~25min taxi, ~40min omnibus

### Word output
- Filename: S9B5-real-estate-miraflores.docx
- Size: 38733 bytes (38 KB)
- Estructura: H1 + 3 H2 + 3 parrafos + 1 table 13x4

## When to use this skill

- Real-estate investment decision reports
- Relocation feasibility assessments
- Rental purchase comparison
- Family relocation packages
- Property valuation reports
- Neighborhood comparative analysis
- Real-estate brokerage marketing materials

## Recommended anexos locales

- Constancias laborales (verifica proximity workplace)
- Contratos comerciales anteriores
- Actas familiares (estado civil)
- Recibos de servicios (proximity utilities infrastructure)
- Photo galleries vecindario (visual evidence)
- Mapas urbanos municipal

## Gotchas

1. **Safety score below 70** → caution recommendation + mention safety strategy
2. **radius 1500m es óptimo**: radius 500m muy poco amenities, 2000m demasiado ruido
3. **include_price_data=true** necesario para price_index (otherwise no price)
4. **100+ amenities can flood Word docx**: group by category (restaurantes, parques, schools, malls)
5. **price_index 50 = median**: <40 affordable, >60 premium

## Anti-pattern

No usar este skill si:
- Necesitas análisis comercial/investment property (use realtor-specialized tools)
- Necesitas travel-time matrix commutes (use OSM route_fetch + sample)
- Necesitas property valuation exact market value (OSM no provee this)

## Metrics

- Tools used: 10+ (analyze_neighborhood + markitdown + word formatting)
- Time: ~10s end-to-end
- Output: 1 docx ~38 KB
- Coverage: 8 livability dimensions + 100+ amenities + 1 PDF anexo
