---
name: triple-osm-markitdown-word-geo-docs
description: Use when generating geographical reports with annexed LEGAL/ADMINISTRATIVE evidence from local PDFs. Combines OSM geocoding + POIs + MarkItDown PDF local extraction + Word formatted doc. NO Gateway academic search. Ideal for site evaluations requiring documentation backup, planning reports where constancias/contracts/concessions need context.
trigger_keywords: geo documentos, seite evaluation, legible site plan, anexo pdf, geo reporte, evidencia
---

# SKILL: Triple T4 — OSM + MarkItDown + Word Geo-Docs

## Proven Chain (2026-08-08, sesion 9A)

```
osm.geocode_address(address="<point_of_interest>", lang="es")
    ↓ obtain lat/lon + importance + neighborhood
osm.get_map_image(latitude=<lat>, longitude=<lon>, zoom=15)
    ↓ PNG tile image (optional for display in doc)
osm.find_nearby_places(latitude=<lat>, longitude=<lon>, radius=500, category="<cat>", limit=8)
    ↓ POIs in vicinity
osm.analyze_neighborhood OR osm.explore_area (optional, for richer context)
markitdown.markitdown_convert(path="<local_pdf_evidential>", pages="all", maxChars=5000)
    ↓ extract structured markdown from local PDF (constancia, contract, concession)
word.create_document(filename="<output.docx>", ...)
word.add_heading(level=1, ...)
word.add_paragraph(text="<pipeline_intro>")
word.add_heading(level=2, "1. Geocodificacion <location>")
word.add_paragraph(text="<coords_neighborhood_summary>")
word.add_heading(level=2, "2. POIs Cercanos")
word.add_table(rows=N+1, cols=4, data=<poi_matrix>)
word.format_table(table_index=0, ...)
word.add_heading(level=2, "3. Anexo - Datos Extraidos de PDF Local")
word.add_paragraph(text="<pdf_extraction_summary>")
word.add_table(rows=N+1, cols=2, data=<key_value_pairs>)
word.format_table(table_index=1, ...)
word.add_heading(level=2, "4. Conclusiones del Reporte Geo-Documental")
word.add_paragraph(text="<synthesis>")
word.add_paragraph(text="<pipeline_footer>")
```

## Validated Output (S9A 2026-08-08)

### Location: Plaza de Armas Arequipa, Peru
- Geocode: -16.3988333, -71.5369705, importance 0.229
- Barrio: 7 Esquinas, Arequipa
- get_map_image: PNG tile 56 KB zoom 15

### POIs nearby (radius 500m, restaurantes)
- 8 results in <5s
- Top: Waya Lookout (60m), La Serena (66m), Katari Bar (69m), Antojitos de Arequipa (96m, 103m), Puerta del Sol (102m), Artichón (104m), Il Caffè Della Nonna (107m)

### Anexo PDF evidencial
- MarkItDown extracted: 1464 chars del constancia <institucion> <anio> (PDF 223 KB local)
- Beneficiario <NOMBRE_COMPLETO> (DNI <DNI>)
- Cargo <cargo_laboral>ón Censal <ODEI_REGIONAL> <ciudad_usuario>
- Periodo <periodo_laboral>
- 2 firmas digitales

### Word output
- Filename: T4-geo-docs-arequipa.docx (38829 bytes = 38 KB)
- Estructura: 4 H1/H2 + 4 parrafos + 2 tablas (9x4 POIs + 10x2 anexo)

## When to use this skill

- Planeamiento urbano con anexos de licencias/concesiones/convenios
- Reportes ambientales con permisos anexos
- Evaluacion de sitio + documentos legales del sitio
- Estudios de impacto con PDFs anexos como evidencia
- Reportes consultoria con compraventa PDFs inmoviliarios incluidos
- Informes de auditoria con soportes documentales

## Comparison vs D5 (OSM+Word solo)

| Aspecto | D5 | T4 (este) |
|---------|----|-----------|
| MCPs | 2 | 3 (+ MarkItDown) |
| Anexo PDF | NO | SI (key/value table) |
| Caso | Livability plain | Evidence-backed |
| Tiempo | 25s | 30s |
| Output size | 38 KB | 38 KB |
| Compliance | Bajo | Alto (anexo formal) |

## Comparison vs Quad Q1

Q1 usa Gateway para biblio, T4 usa MarkItDown para PDF local. Q1 tiene reporte academico; T4 tiene anexo juridico/evidencial. Distintos casos de uso.

## Gotchas

1. **get_map_image** returns truncated response for large tiles — usar zoom 15 max
2. **find_nearby_places con radio 500** es suficiente para Plaza/centro; >500m demasiado ruido en cidades densas
3. **PDFs > 50 paginas**: MarkItDown puede tardar 30s — usar pages="first5"
4. **Anexos multiples**: si tienes >3 PDFs evidenciales, generar Own section por cada: H2 "Anexo 1", "Anexo 2"

## Recommended PDFs for T4 use case

| Caso T4 | PDF local sugerido | Resultado |
|---------|-------------------|-----------|
| Site evaluation | Convenio / contrato / permiso | Anexo formal |
| Real estate report | Constancia predial | Anexo legal |
| Urban planning | Concesión municipal | Anexo administrativo |
| Audit | Constancia laboral / RRHH | Anexo debido-diligencia |
| Site visit | PDF fotos informe | Anexo fotografico |

## Anti-pattern

No usar T4 si el PDF local no esta relacionado con la ubicacion. En ese caso, generar 2 docx separados: uno geo (D5) y otro PDF (D6 MarkItDown+Word). T4 unicamente brilla cuando ubication y PDF evidencian lo MISMO.

## Metrics

- Tools used: 11 (geocode_address, get_map_image, find_nearby_places, markitdown_convert, create_document, add_heading x4, add_paragraph x4, add_table x2, format_table x2)
- Time: ~30s end-to-end
- Output: 1 docx ~38 KB
- Sin red externa(minima) MarkItDown + OSM locales, NO Gateway needed
