---
name: megaskill-maestra-universal-mcps
description: Use FOR ANY task combining the 4 LetXinet MCPs (Gateway academic search + OSM geo + MarkItDown PDF + Word docs). Single self-contained reference consolidating 89 tools, 39 academic sources, 62 validated workflows S8-S9G, anti-patterns, gotchas, fallbacks and sanitization rules. Ideal when the user request spans citation search, geocoding, PDF conversion or Word generation and you need the canonical chain to invoke.
trigger_keywords: megaskill, maestra, universal mcp, letxinet gateway, letxinet osm, letxinet markitdown, omni word, 4 mcps combo, 89 tools, 39 sources, harness s8, s9, geo academia, pdf docx, citation workflow, bibliography, neighborhood analysis, route planner, ev charging, mgrs tactical, prior art, degree audit, thesis finder, systematic review, conference discovery
author: harness-meta
audience: opencode
version: 6.0.0
supersedes: META-SKILL-UNIVERSAL-CLAUDE.md, META-SKILL-UNIVERSAL-OPENCODE.md
---

# MEGASKILL MAESTRA UNIVERSAL — 4 MCPs / 89 TOOLS / 62 WORKFLOWS

> Único documento de referencia canónica para combinar los 4 MCPs de la Suite LetXinet.
> Reemplaza a `META-SKILL-UNIVERSAL-CLAUDE.md` y `META-SKILL-UNIVERSAL-OPENCODE.md` (versiones previas parciales).
> Sin datos personales. Sin nombres propios. Sin rutas absolutas al equipo del usuario.
> Placeholders abstractos: `<lat>`, `<lon>`, `<doi>`, `<query>`, `<fecha>`, `<ruta_local>`, `<ciudad_usuario>`, `<institucion>`.

---

## 0. DEPENDENCIAS — ESTA MEGASKILL NO ES AUTOSUFICIENTE

> ⚠️ **Aviso crítico:** Este archivo es un documento **director/catálogo**. No reemplaza a los skills individuales ni a los MCPs activos. Para que "todo esto" funcione necesitas:

### 0.1 Los 62 SKILL.md individuales (instalados aparte)

Esta megaskill es el **mapa**, no el territorio. El propio §17 dice que se usa cuando el pedido cruza 2+ MCPs o cuando no está claro qué skill cargar. Pero si el pedido cae claramente en uno de los 62 arquetipos ya documentados (S8-1, S9C-4, etc.), lo que corresponde es cargar *ese* SKILL.md específico, no este.

**Estructura requerida en `~/.config/opencode/skills/`:**

```
~/.config/opencode/skills/
├── letxinet-megaskill-maestra/      # ESTE ARCHIVO (capa de coordinación)
│   └── SKILL.md
├── letxinet-search-best-practices/  # skill ya existente (pool 2026-08-07)
│   └── SKILL.md
└── letxinet-dual-mcps/              # 62 skills individuales
    ├── gateway-markitdown-pdf-extraction/SKILL.md
    ├── gateway-word-bibliography-reports/SKILL.md
    ├── osm-word-neighborhood-analysis/SKILL.md
    ├── markitdown-word-pdf-digestion/SKILL.md
    ├── gateway-osm-literature-georeferencing/SKILL.md
    ├── osm-markitdown-geo-pdf-bridge/SKILL.md
    ├── quad-pipeline-academic-georeport/SKILL.md
    ├── <... 55 skill directories más S9A-S9G ...>
    └── cross-multi-language-thesaurus-reconstruction/SKILL.md
```

Sin esos 62 SKILL.md individuales instalados, el dispatcher de opencode no tiene a quién delegar cuando un request coincide con un arquetipo específico.

### 0.2 Los 4 servidores MCP activos puerto a puerto

Todo lo que describe esta megaskill (89 tools) son llamadas a servicios reales. Si no están corriendo, el contenido es solo referencia — no hay nada que ejecutar.

| MCP | Puerto / Acceso | Verificación | Binario |
|-----|-----------------|--------------|---------|
| letxinet-gateway | `http://127.0.0.1:4003/health` | `curl` en pre-flight (\S 2) | `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\dist\server.js` |
| letxinet-osm | `http://127.0.0.1:7082/` | `curl` en pre-flight | `D:\OTROS\letxipu-osm-mcp\osmmcp-patched.exe` |
| letxinet-markitdown | `http://127.0.0.1:7860/` | `curl` en pre-flight | `D:\OTROS\LETXINET-SUITE\...\markitdown-payload\app.py` |
| omni-word-mcp | COM (sin HTTP) | `word.list_available_documents` | `D:\OTROS\OMNI-Office-Word-MCP-Server\dist\index.js` |

El §2 (pre-flight checks) es literalmente curls a esos puertos. Estado conocido al 2026-08-07: Gateway `OK`, OSM `degraded` (OSRM down, Overpass 429), MarkItDown `OK`, Word `OK` (Word 2016+ COM v16.0).

### 0.3 Si faltan las dependencias

| Sintoma | Causa | Solución |
|---------|-------|----------|
| `opencode` carga esta megaskill pero ningún tool MCP responde | 4 MCPs offline | Levantar los 4 binarios arriba (ver \S 0.2) |
| El dispatcher menciona "S9C-4" pero no encuentra el skill | 62 SKILL.md individuales no instalados | Instalar `letxinet-dual-mcps/` completo (ver ZIP de pack completo) |
| `markitdown_convert` con path local falla | Se está usando el runtime equivocado | Solo este tool acepta path local — los del Gateway requieren DOI/URL remoto |

### 0.4 Reemplazo de versiones previas

Esta megaskill v6.0.0 **sustituye** a `META-SKILL-UNIVERSAL-CLAUDE.md` y `META-SKILL-UNIVERSAL-OPENCODE.md` (versiones previas 1.0.0, mantenidas solo como testigo en `meta-templates/`). La carpeta `~/.config/opencode/skills/` debe convivir con:
- **62 SKILL.md individuales** (territorio, los planos detallados por arquetipo)
- **Esta megaskill** (mapa, capa de coordinación superior)
- **Skill adicional de best-practices** (`letxinet-search-best-practices/SKILL.md` — ya preexistente)

---

## 1. PROPÓSITO

Plantilla-canónica única que consolida TODO lo aprendido en las sesiones S8→S9G:

- Los **4 MCPs** con sus **89 herramientas** totales (28 Gateway + 41 OSM + 2 MarkItDown + 18 Word).
- Las **39 fuentes académicas** del pool 2026-08-07 (30 operativas, 8 empty, 1 dead).
- Los **62 workflows validados** (S8: 7 + S9A: 4 triples + S9B: 8 cross + S9C: 12 solo-gateway + S9D: 14 solo-OSM + S9E: 8 solo-Word + S9F: 4 solo-MD + S9G: 5 cross-medio).
- Las **lecciones aprendidas** de cada MCP (bugs, rate-limits, encoding, timeouts).
- Las **reglas de sanitización** anti-fuga de datos personales (128 leaks scrubbed en 27 archivos, tres rondas).
- Las **reglas formales** para construir skills nuevos (frontmatter YAML, naming, tamaños, checklist).

Es **el دستور único** para que cualquier agente (claude u opencode) decida en segundos qué tools invocar, en qué orden, con qué fallback y con qué validación anti-alucinación.

---

## 2. PRE-FLIGHT CHECKS (ejecutar antes de cualquier cadena >= 3 tools)

```bash
# Gateway V11 (28 tools, búsqueda académica, 60min timeout)
curl -s http://127.0.0.1:4003/health | head -c 200
# OSM (41 tools Go, geocoding+routing+POIs, 1min timeout)
curl -s http://127.0.0.1:7082/ | head -c 200
# MarkItDown (2 tools Python, PDF→Markdown local, 30min timeout)
curl -s http://127.0.0.1:7860/ | head -c 200
# Word (18 tools Node via COM, no HTTP — verificar con list_available_documents)
# Solo confirmar backend Suite activo si el workflow usa el puerto 43123
curl -s http://127.0.0.1:43123/api/health | head -c 200
```

**Estado OSM conocido (`degraded`):** OSRM down → routing cae a Nominatim fallback; Overpass rate-limited (HTTP 429/504) en zonas urbanas densas → reducir radio a 800m y máximo 3-4 sub-queries en `find_nearby_batch`.

---

## 3. LOS 4 MCPs — INVENTARIO COMPLETO

### 3.1 letxinet-gateway (28 herramientas)

| Grupo | Tools |
|-------|-------|
| **Búsqueda (5)** | `search`, `batch_search`, `smart_search`, `list_sources`, `health_check` |
| **Metadata (3)** | `enrich_metadata`, `fetch_metadata` (DEPRECATED), `recover_metadata` (DEPRECATED) |
| **PDF Resolución (2)** | `resolve_pdf`, `download_pdf` (9 fallbacks: Sci-Hub, Unpaywall, CORE, OA.mg, WeLib...) |
| **PDF Lectura (8)** | `read_pdf`, `read_pdf_markdown` (PREFERIDO), `pdf_smart_summary`, `pdf_metadata`, `pdf_sections` (DEPRECATED lento), `pdf_citations`, `extract_section`, `analyze_academic` |
| **Conversión (4)** | `convert_document`, `batch_convert`, `extract_tables`, `extract_formulas` |
| **Premium CS/AI (4)** | `search_dblp` (504), `search_paperswithcode`, `trending_papers`, `search_conferences` |
| **Utilidades (3)** | `coverage_report`, `help`, `verify_antihallucination_data` |

**Lecciones Gateway:**
- `fetch_metadata` y `recover_metadata` son DEPRECATED (timeout > 4min en DOIs muertos). Usar `enrich_metadata` (una sola API con cache).
- `pdf_sections` DEPRECATED (timeout > 4min en PDFs > 30 páginas). Usar `pdf_smart_summary` + `read_pdf_markdown` con `pages=`.
- Las tools PDF (`read_pdf`, `extract_tables`, `extract_formulas`, `batch_convert`, `pdf_metadata`) **SOLO aceptan DOI/URL remoto**. Paths locales fallan con `Cannot read properties of null (reading 'message')` (bug MinerU). Para PDFs locales usar `markitdown_convert`.
- `trending_papers` y `search_conferences` SOLO cubren AI/CS — biotech no soportado.
- Springer/BMC PDFs bloquean descarga directa → usar `read_pdf` (MinerU scraper).
- Scopus y Cochrane requieren keys institucionales → 0 resultados sin token. Fallback: crossref+openalex+zenodo.
- Para LatAm SIEMPRE pasar `fastMode:true` y preferir `batch_search` con `["latam"]` o `["iberoamerica"]` (NO grupales grandes).
- `smart_search` expansion sinonimos ES/EN/PT validado: "biología marina Ecuador" → 4 papers en 14.5s vía scielo.

### 3.2 letxinet-osm (41 herramientas Go)

| Grupo | Tools |
|-------|-------|
| **Geocoding (4)** | `geocode_address`, `reverse_geocode`, `get_version`, `osm_health` |
| **Routing (6)** | `get_route_directions`, `route_fetch`, `route_sample`, `polyline_encode`, `polyline_decode`, `enrich_emissions` |
| **POIs (5)** | `find_nearby_places`, `find_nearby_batch` (10 sub-queries), `find_charging_stations`, `find_parking_facilities`, `find_schools_nearby` |
| **Geo/Areas (4)** | `explore_area`, `analyze_neighborhood` (con `include_price_data:true`), `analyze_commute`, `suggest_meeting_point` |
| **Mapas/OSM Raw (5)** | `get_map_image`, `tile_cache`, `osm_query_bbox`, `filter_tags`, `sort_by_distance` |
| **Geo Utils (4)** | `geo_distance` (Haversine), `centroid_points`, `bbox_from_points`, `polygon_from_admin` |
| **Internos (13)** | Parsers MGRS/UTM/DMS, wrappers Nominatim/OSRM/Overpass |

**Lecciones OSM:**
- `geocode_address` filtra `importance < 0.05` → workaround: pasar coords manuales conocidas.
- **MGRS requiere bare format** sin prefix `MGRS:` (colon confunde parser). Ej.: `"17SLA2897456710"` → `36.64,-82.91`.
- **Overpass 429/504** en zonas urbanas densas → reducir radio, máximo 3-4 sub-queries en `find_nearby_batch`.
- `explore_area` y `polygon_from_admin` pueden caer en `SERVICE_UNAVAILABLE` o 429 → retry 1-2 veces con backoff.
- `analyze_neighborhood` requiere `include_price_data:true` para `price_index`. Radio óptimo 1500m.
- **Inconsistencia API:** `centroid_points` y `bbox_from_points` requieren `latitude`/`longitude` keys; `polyline_encode`/rand utiliza `lat`/`lon`._convertir antes de invocar.
- OSM EV charging stations incompleto en LatAm → puede retornar 0 resultados aunque existan.
- `route_fetch` necesita `start`/`end` como `{latitude, longitude}` (case-sensitive).

### 3.3 letxinet-markitdown (2 herramientas Python)

| Tool | Descripción |
|------|-------------|
| `markitdown_convert` | PDF/DOCX/PPTX/XLSX local → Markdown estructurado (PyMuPDF4LLM). Soporta `pages` range y `maxChars`. |
| `markitdown_health` | Status servicio en :7860 |

**Lecciones MarkItDown:**
- Es el **ÚNICO tool que acepta paths locales** (PyMuPDF4LLM en :7860). Las tools del Gateway requieren DOI/URL remoto.
- Usar `pages="all"` por defecto, `"first5"` / `"last3"` / `"1,3,7"` / `"1-5"` para rangos.
- `maxChars` opcional recorta el markdown devuelto (default sin corte).

### 3.4 omni-word-mcp (18 herramientas Node via COM)

| Grupo | Tools |
|-------|-------|
| **Creación (5)** | `create_document`, `copy_document`, `add_heading` (1-9), `add_paragraph` (con style), `add_page_break` |
| **Edición (5)** | `add_table` (requiere `rows` y `cols` siempre), `add_picture` (width inches), `add_endnote_to_document`, `add_footnote_to_document`, `delete_paragraph` |
| **Formato (5)** | `format_text`, `create_custom_style`, `format_table` (borders, shading, has_header_row), `customize_footnote_style`, `search_and_replace` |
| **Seguridad (2)** | `protect_document`, `unprotect_document` |
| **Lectura (6)** | `get_document_info`, `get_document_text`, `get_document_outline`, `get_paragraph_text_from_document`, `find_text_in_document`, `list_available_documents`, `convert_to_pdf` |

**Lecciones Word:**
- `add_table` requiere `rows` y `cols` SIEMPRE — error pydantic si faltan.
- `find_text_in_document` FALLA con caracteres acentuados (á é í ó ú ñ). Strip accents primero.
- `protect_document` → `get_document_info` falla con "Package not found" (confusing pero expected cuando encrypted).
- `add_footnote_to_document` simplified approach: anchor al final del paragraph index (no posición custom).
- `convert_to_pdf` solo disponible en este MCP (no en Gateway ni MarkItDown).

---

## 4. LAS 39 FUENTES ACADÉMICAS (pool 2026-08-07)

**30 OPERATIVAS:** openalex, semantic, pubmed, arxiv, scopus, crossref, doaj, zenodo, openaire, core, scielo, lareferencia, laref_ecuador, renati, bdtd, unam, anid, snrd, espana, costarica, uruguay, elsalvador, laref_peru, laref_brasil, laref_mexico, laref_argentina, laref_colombia, laref_chile, oasisbr, rraae, serpapi (HIDDEN TREASURE).

**8 EMPTY:** redalyc, minciencias, conacyt, dblp, paperswithcode, openreview, huggingface.

**1 DEAD:** `alicia` (Perú CONCYTEC, 90s timeout) — NO USAR.

### Grupos fuente recomendados

| Grupo | Sources | Caso de uso |
|-------|---------|-------------|
| `["latam"]` | 20 LatAm hispano | Máxima cobertura hispanoamericana |
| `["global"]` | 10 anglo/mainstream | Anglo mainstream |
| `["tesis"]` | 4 repositorios tesis | Solo tesis |
| `["iberoamerica"]` | LatAm + España | Iberoamérica completa |
| `["peru"]` o `["peru_fast"]` | renati + laref_peru + alicia (NO) | Tesis Perú (usar peru_fast) |
| `["all"]` | 38 menos alicia | Máxima cobertura |

**Reglas de invocación (post 2026-08-07 re-test):** SIEMPRE `fastMode:true`. LLAMAR sources individuales NUNCA grupales grandes. Si `["latam"]` falla probar `["scielo"]` + `["lareferencia"]` por separado.

---

## 5. LOS 62 WORKFLOWS VALIDADOS (S8 → S9G)

Índice maestro de los 62 pipelines ya ejecutados con datos vivos y documentados en `results/`. Úsalos como referencia canónica cuando un nuevo request caiga en uno de estos arquetipos.

### 5.1 S8 — Skills básicos (7) — sesiones 1-7

| ID | Skill | MCPs | Caso |
|----|-------|------|------|
| S8-1 | `gateway-markitdown-pdf-extraction` | GW + MD | PDF académico → Markdown |
| S8-2 | `gateway-word-bibliography-reports` | GW + Word | Buscar papers → docx biblio |
| S8-3 | `osm-word-neighborhood-analysis` | OSM + Word | Lat/lon → reporte vecindario |
| S8-4 | `markitdown-word-pdf-digestion` | MD + Word | PDF local → docx digest |
| S8-5 | `gateway-osm-literature-georeferencing` | GW + OSM | Mapear literatura geográficamente |
| S8-6 | `osm-markitdown-geo-pdf-bridge` | OSM + MD | Geocode + PDF roundtrip |
| S8-7 | `quad-pipeline-academic-georeport` | 4 MCPs | Reporte integrado académico-geo |

### 5.2 S9A — Triples (4)

| ID | Skill | MCPs | Caso |
|----|-------|------|------|
| S9A-T1 | `triple-gateway-osm-word-geo-bibliography` | GW+OSM+Word | Biblio geo sin PDF |
| S9A-T2 | `triple-gateway-osm-markitdown-multi-source-extraction` | GW+OSM+MD | Multi-source geo-extraction |
| S9A-T3 | `triple-gateway-markitdown-word-bibliography-from-pdf` | GW+MD+Word | PDF→Word biblio |
| S9A-T4 | `triple-osm-markitdown-word-geo-docs` | OSM+MD+Word | PDF ingestion → geo docx |

### 5.3 S9B — Cross-MCP alto valor (8)

| ID | Skill | Caso |
|----|-------|------|
| S9B-1 | `cross-evidence-based-medicine-prisma-review` | EBM guideline SLR (pubmed+scopus+cochrane via serpapi) |
| S9B-2 | `cross-academic-presentation-generator` | Slides docx con biblio |
| S9B-3 | `cross-patent-prior-art` | IP prior art (crossref+openalex+zenodo+scopus) |
| S9B-4 | `cross-pdf-bibliography-assembly` | Mass digitalization biblio |
| S9B-5 | `cross-real-estate-decision-package` | Home-buying (neighborhood+schools+charging+Word) |
| S9B-6 | `cross-comparative-university-deep-analysis` | University research cluster mapping |
| S9B-7 | `cross-georreferenced-literature-review` | Spatial SLR |
| S9B-8 | `cross-conference-paper-discovery` | AI conference prep (trending+conferences+paperswithcode) |

### 5.4 S9C — Solo-Gateway (12)

| ID | Skill | Caso |
|----|-------|------|
| S9C-1 | `gateway-peru-thesis-finder` | renati + laref_peru + serpapi |
| S9C-2 | `gateway-biotech-pubmed-search` | pubmed + scopus + openalex + rraae |
| S9C-3 | `gateway-cs-ai-trending` | arxiv + paperswithcode + openreview + trending_papers |
| S9C-4 | `gateway-systematic-review-prisma` | SLR con verify_antihallucination |
| S9C-5 | `gateway-multi-language-search` | smart_search ES/EN/PT sinonimos |
| S9C-6 | `gateway-brazilian-academia-deep` | bdtd + oasisbr + rraae + laref_brasil |
| S9C-7 | `gateway-iberian-mix` | espana + scielo + laref_argentina + laref_chile |
| S9C-8 | `gateway-prior-art-patent` | crossref + openalex + zenodo + scopus + enrich |
| S9C-9 | `gateway-paper-pipeline` | search → resolve → download → smart_summary → extract_section → verify → citations |
| S9C-10 | `gateway-cochrane-evidence` | Cochrane vía serpapi (API direct unavailable) |
| S9C-11 | `gateway-statistical-extraction` | search → analyze_academic → extract_tables → extract_formulas |
| S9C-12 | `gateway-coverage-monitoring` | coverage_report + health_check |

### 5.5 S9D — Solo-OSM (14)

| ID | Skill | Tools clave |
|----|-------|-------------|
| S9D-1 | `osm-route-analytics` | analyze_commute + get_route_directions + geo_distance + enrich_emissions |
| S9D-2 | `osm-batch-poi-survey` | find_nearby_batch (8-10 sub-queries) |
| S9D-3 | `osm-commute-analyzer` | analyze_commute 3 modes car/cycling/walking |
| S9D-4 | `osm-geocode-reverse-pair` | geocode_address + reverse_geocode |
| S9D-5 | `osm-neighborhood-comparison` | analyze_neighborhood 2 zones comparative |
| S9D-6 | `osm-charging-stations-map` | find_charging_stations (EV incomplete LatAm) |
| S9D-7 | `osm-centroid-bbox-tools` | centroid_points + bbox_from_points (recordar latitude/longitude keys) |
| S9D-8 | `osm-polygon-admin-extractor` | polygon_from_admin + osm_query_bbox |
| S9D-9 | `osm-explore-area-amenities` | explore_area (puede 504) |
| S9D-10 | `osm-find-poi-single-category` | find_nearby_places con category |
| S9D-11 | `osm-parking-finder` | find_parking_facilities |
| S9D-12 | `osm-schools-catchment` | find_schools_nearby |
| S9D-13 | `osm-word-neighborhood-analysis` | OSM + Word livability docx |
| S9D-14 | `osm-markitdown-geo-pdf-bridge` | OSM + MD roundtrip |

### 5.6 S9E — Solo-Word (8)

| ID | Skill | Caso |
|----|-------|------|
| S9E-1 | `word-template-generator` | create + heading + paragraph + table + format_table + convert_to_pdf |
| S9E-2 | `word-table-picture-rich` | 2 tablas 5x4 borders single+thick |
| S9E-3 | `word-document-audit` | get_info + outline + text → audit JSON |
| S9E-4 | `word-footnotes-endnotes` | add_footnote + add_endnote |
| S9E-5 | `word-style-customizer` | 2 custom styles + footnote Roman numerals |
| S9E-6 | `word-search-replace-bulk` | find_text + search_and_replace (strip accents) |
| S9E-7 | `word-protected-doc-workflow` | protect + unprotect cycle |
| S9E-8 | `word-outline-extractor` | get_outline 4 paragraphs + 2 tables |

### 5.7 S9F — Solo-MarkItDown (4)

| ID | Skill | Caso |
|----|-------|------|
| S9F-1 | `markitdown-batch-digest` | markitdown_convert local OK / batch_convert remote falla |
| S9F-2 | `markitdown-tables-extractor` | extract_tables local falla / extract_section DOI remote OK |
| S9F-3 | `markitdown-formulas-extractor` | extract_formulas remote falla / extract_section methods OK |
| S9F-4 | `markitdown-pages-range-reader` | markitdown_convert pages=all o range |

**Lección crítica S9F:** Las tools PDF del Gateway (MinerU remote) y `markitdown_convert` (PyMuPDF4LLM local) NO son intercambiables. La regla operativa:
- **PDF local** → `markitdown_convert` (único que acepta paths).
- **PDF remoto (DOI/URL)** → `read_pdf` / `read_pdf_markdown` / `extract_section` / `extract_tables` / `extract_formulas` (Gateway MinerU).
- Springer/BMC PDFs bloquean descarga → `read_pdf` directo (scraper).

### 5.8 S9G — Cross-MCP medio/bajo (5)

| ID | Skill | MCPs | Caso |
|----|-------|------|------|
| S9G-1 | `cross-city-commute-academia-report` | OSM + GW + Word | analyze_commute + smart_search scielo |
| S9G-2 | `cross-tactical-coordinates-mgrs-mapping` | OSM + Word | geocode MGRS bare format |
| S9G-3 | `cross-ev-route-planner-with-emissions` | OSM + Word | find_charging_stations + route + enrich_emissions |
| S9G-4 | `cross-automated-degree-audit` | MD + Word | transcript PDF → audit docx + footnotes + endnotes |
| S9G-5 | `cross-multi-language-thesaurus-reconstruction` | GW + Word | smart_search ES/EN/PT + thesaurus docx |

**Resumen coberturas:** 6 duales ✅ + 4 triples ✅ + 1 cuádruple ✅ + 12 solo-gateway ✅ + 14 solo-OSM ✅ + 8 solo-Word ✅ + 4 solo-MD ✅ + 13 cross-MCP ✅ = 108% (62/57 plan maestro).

---

## 6. CADENAS CANÓNICAS POR ARQUETIPO (15 recetas Chuck-Norris)

Cada receta lista la cadena exacta de tools, el fallback si falla un eslabón y el artefacto final esperado.

### 6.1 Cadenas DUALES (6)

**D1 Gateway + OSM** — Literature georeferencing
```
gateway.batch_search(query, sources=["latam"], fastMode=true)
  → osm.geocode_address(<institucion>)
  → osm.explore_area(<lat>, <lon>, radius=800)
  → [opcional] gateway.enrich_metadata(top_papers)
  → Artefacto: markdown con tabla papers + coords + POIs count
```
**Fallback:** si `explore_area` 504 → usar `find_nearby_places(category="university")`.

**D2 Gateway + MarkItDown** — PDF académico → Markdown
```
gateway.search(query) → gateway.resolve_pdf(<doi>) → gateway.download_pdf(<url>)
  → markitdown.markitdown_convert(<ruta_local>, maxChars=30000)
  → Artefacto: markdown estructurado
```
**Fallback:** si `download_pdf` falla → `gateway.read_pdf_markdown(doi=<doi>)` directo.

**D3 Gateway + Word** — Bibliography docx
```
gateway.batch_search → gateway.enrich_metadata(top_10_papers)
  → word.create_document → word.add_heading(level=1) → word.add_paragraph(x N)
  → word.add_table(rows=N, cols=5, data) → word.format_table(border="single", has_header_row=true)
  → word.convert_to_pdf (opcional)
  → Artefacto: docx biblio + opcional pdf
```

**D4 OSM + MarkItDown** — Geo PDF bridge
```
osm.geocode_address → osm.get_map_image(<lat>, <lon>, zoom=14)
  → markitdown.markitdown_convert(ruta_pdf_local_con_mapa)
  → Artefacto: markdown con referencias al mapa + texto extraído
```

**D5 OSM + Word** — Neighborhood analysis docx
```
osm.analyze_neighborhood(<lat>, <lon>, radius=1500, include_price_data=true)
  → word.create_document → add_heading + add_paragraph(score narrativo)
  → add_table(categorías × métricas) → format_table(shading header)
  → Artefacto: docx análisis vecindario
```

**D6 MarkItDown + Word** — PDF local → docx digest
```
markitdown.markitdown_convert(ruta_pdf_local) 
  → word.create_document → add_heading(level=1, "Digest")
  → add_paragraph(markdown_chunk) × secciones
  → add_page_break → add_table(si hay tablas en markdown)
  → Artefacto: docx digest
```

### 6.2 Cadenas TRIPLES (4) — S9A

**T1 GW + OSM + Word** — Geo-bibliography sin PDF
```
gateway.batch_search → osm.geocode_address(<institucion>) + osm.explore_area
  → word.create_document + add_heading(x3) + add_paragraph(x3) + add_table(x3) + format_table(x3)
  → Artefacto: docx con sección literatura + sección geo + sección POIs
```

**T2 GW + OSM + MD** — Multi-source extraction geo
```
gateway.search(query, sources=["global"]) → gateway.read_pdf_markdown(doi=<doi>) × N
  → osm.geocode_address(<institucion_autor>) 
  → markitdown.markitdown_convert si hay PDFs locales adicionales
  → Artefacto: markdown multi-source con tags geográficos
```

**T3 GW + MD + Word** — PDF → Word bibliography
```
gateway.search → gateway.download_pdf → markitdown.markitdown_convert(<ruta_local>)
  → gateway.enrich_metadata(top_papers) [opcional]
  → word.create_document + add_table(biblio) + format_table
  → word.add_footnote_to_document(p1) + add_endnote_to_document(p3)
  → Artefacto: docx biblio con footnotes/endnotes
```

**T4 OSM + MD + Word** — Geo docs con PDF ingestion
```
osm.geocode_address → osm.get_map_image → markitdown.markitdown_convert(<ruta_mapa_pdf>)
  → word.create_document + add_heading + add_paragraph(coords+amenities)
  → add_picture(<map_image>) + add_table(POIs)
  → Artefacto: docx geo con mapa embebido
```

### 6.3 Cadena CUÁDRUPLE (1) — Q1

```
gateway.batch_search(query, sources=["latam","global","tesis"], fastMode=true) [10.8s]
  → osm.geocode_address(<institucion>) [2s] → osm.explore_area(radius=800) [5s]
  → word.create_document + add_heading × 4 + add_paragraph × 3 + add_table × 3 + format_table × 3
  → markitdown.markitdown_convert(<ruta_pdf_local_extra>) [para resultados adicionales]
  → Artefacto: docx 40 KB + pdf 190 KB (3 páginas)
```
Tiempo total ~30s. Documentar metric en result.md (tools_count, tiempo, byte_size).

### 6.4 Cadenas CROSS-MCP alto valor (8) — S9B

**S9B-1 EBM PRISMA** — `gateway.batch_search(["pubmed","scopus","serpapi"]) → enrich_metadata → extract_section "methods" → verify_antihallucination_data → word.create_document + add_table(SLR)`
**S9B-2 Academic presentation** — `gateway.search + trending_papers → word.create_document + add_table + add_picture (slides styled)`
**S9B-3 Patent prior art** — `gateway.batch_search(["crossref","openalex","zenodo","scopus"]) → enrich_metadata → word.create_document + add_heading per claim + add_table`
**S9B-4 PDFs-to-bibliography** — `markitdown.markitdown_convert × N PDFs locales → gateway.enrich_metadata × top → verify_antihallucination_data → word.add_table biblio`
**S9B-5 Real estate** — `osm.analyze_neighborhood + find_schools_nearby + find_charging_stations → word docx decision package + add_picture(map) + add_table(schools)`
**S9B-6 Comparative university** — `gateway.search(by university) × 2-3 → osm.explore_area(campus) → word.add_table comparative`
**S9B-7 Georeferenced literature review** — `gateway.batch_search → osm.geocode_address(autors) + bbox_from_points → word docx spatial SLR + add_table(coords)`
**S9B-8 Conference discovery** — `gateway.trending_papers + search_conferences + search_paperswithcode → word.create_document + add_table(trending)`

### 6.5 Cadenas SOLO-MCP canónicas — S9C/D/E/F

Solo-Gateway (12): ver §5.4 — todas comienzan con `gateway.search|batch_search|smart_search` y combinan metadata/extract tools.

Solo-OSM (14): ver §5.5 — todas comienzan con `osm.geocode|osm_health` y combinan routing/POI/area tools.

Solo-Word (8): ver §5.6 — todas comienzan con `word.create_document` y combinan heading/paragraph/table/format/protect.

Solo-MarkItDown (4): ver §5.7 — todas comienzan con `markitdown.markitdown_convert(ruta_local)` o `gateway.extract_section(doi)`.

### 6.6 Cadenas CROSS-MCP medio/bajo (5) — S9G

**S9G-1 City commute + academia** — `osm.analyze_commute + gateway.smart_search(scielo) → word docx`
**S9G-2 MGRS tactical** — `osm.geocode_address("MGRS_BARE_FORMAT") → word situation report`
**S9G-3 EV route + emissions** — `osm.find_charging_stations + get_route_directions + enrich_emissions → word itinerary`
**S9G-4 Degree audit** — `markitdown.markitdown_convert(transcript_pdf) → word.create_document + add_table(courses) + add_footnote + add_endnote`
**S9G-5 Multi-language thesaurus** — `gateway.smart_search(ES/EN/PT) → word.create_document + add_table(thesaurus)`

---

## 7. REGLAS DE SANITIZACIÓN OBLIGATORIAS

Un skill generado con esta megaskill **NUNCA** debe contener datos personales. Aplicar las 13 reglas siguientes y el placeholder canon de la tabla.

> **Importante:** Los ejemplos de la columna "tipo de leak prohibido" son **descripciones abstractas** (no listamos el valor real nunca detectado en producción, para que esta propia regla no sea un leak).

| # | Regla | Tipo de leak prohibido | Placeholder a usar |
|---|-------|------------------------|---------------------|
| S1 | Sin nombres propios de personas | `<nombre_completo_real>` (de 2-5 tokens) | `<NOMBRE_COMPLETO>`, `<NOMBRE>`, `<APELLIDOS>` |
| S2 | Sin DNIs / IDs numericos personales | `<dni_real>` (8 dígitos) | `<DNI>` |
| S3 | Sin rutas a archivos personales | `<ruta_absoluta_a_pdf_personal>` | `<RUTA_DOCUMENTO_PERSONAL>`, `<documentoPersonal>.pdf` |
| S4 | Sin cargos laborales del usuario | `<cargo_laboral_real>` (3-6 tokens) | `<CARGO_LABORAL>`, `<cargo_laboral>` |
| S5 | Sin dep/regional laboral del usuario | `<dependencia_regional_real>` | `<ODEI_REGIONAL>` (o el equivalente abstracto del tipo de dependencia) |
| S6 | Sin ciudades del usuario en contexto laboral | `<ciudad_usuario_real>` | `<ciudad_usuario>`, `<CIUDAD_USUARIO>` |
| S7 | Sin nombres de terceros (jefes, compañeros) | `<nombre_tercero_real>` | `<nombre_tercero>`, `<apellidos_tercero>` |
| S8 | Sin periodos laborales del usuario | `<rango_fechas_laborales_real>` | `<periodo_laboral>` |
| S9 | Sin instituciones personalizadas | `<institucion_personalizada_real>` | `<institucion>` |
| S10 | Sin lat/lon del domicilio exacto | `<coords_exactas_domicilio>` | `<lat_usuario>`, `<lon_usuario>` (o `<lat>`, `<lon>` completamente abstractos) |
| S11 | Sin fechas fijas del usuario | `<fecha_prueba_real>` | `<fecha>`, `<fecha_prueba>` |
| S12 | Sin DOIs específicos de prueba | `<doi_especifico_real>` | `<doi_ejemplo>` |
| S13 | Sin querys exactas usadas en pruebas | `<query_real>` | `<query>` |

**Nota crítica sobre ciudades/universidades del usuario:** Una ciudad o una universidad pública NO son datos personales puros (son información geográfica/institucional pública), PERO si el usuario es de allí y se generan artefactos académicos referenciando su contexto, deben abstractizarse también para evitar fingerprinting inverso. Cuando veas un patrón recurrente en artefactos "demo" que siempre termina siendo la misma ciudad/universidad del usuario, sustituye por `<ciudad_demo>` / `<institucion_demo>`.

**Placeholder canon extendido** (otros elementos a abstractizar):
- `<lat>`, `<lon>`, `<lat_usuario>`, `<lon_usuario>`
- `<doi_ejemplo>`, `<query>`, `<N_papers>`
- `<ruta_local>`, `<ruta_a_tu_pdf_local>`
- `<fuente_grupo>` (e.g., `<fuente_latam>`, `<fuente_pubmed>`)
- `<fecha_actual>`, `<año_inicio>-<año_fin>`
- `<institucion_demo>` (universidad ficticia si se necesita ejemplo)
- `<ciudad_demo>` (ciudad ficticia si se necesita ejemplo)

---

## 8. FRONTMATTER YAML OBLIGATORIO

Todo SKILL.md debe empezar con:

```yaml
---
name: <kebab-case-name>  # max 60 chars, sin espacios ni signos
description: Use when <caso>. Combines <MCPs>. Ideal for <scenario>.  # 1-3 oraciones, empieza con "Use"
trigger_keywords: keyword1, keyword2, ...  # 5-15 separados por coma
author: harness-meta
audience: opencode | claude
version: <semver>
---

# SKILL: <title>
```

---

## 9. ESTRUCTURA INTERNA OBLIGATORIA DE UN SKILL.md

```markdown
# SKILL: <title>

## Proven Chain (YYYY-MM-DD)
[secuencia exacta de tools invocados, con placeholders S1-S10]

## Validated Output (YYYY-MM-DD)
[estructura JSON/markdown esperada sin valores sensibles]

## When to use
[3-10 casos de uso genéricos]

## When NOT to use (Anti-pattern)
[3-6 casos donde NO aplicar este skill]

## Gotchas
[5-10 problemas conocidos del runtime / API / MCP]

## Metrics
- Tools used: <N>
- Time: ~<seg/min>
- Output: <tipo de artefacto>
```

---

## 10. ANTI-PATRONES DE SKILL (lo que NO hacer)

1. **Skill "monumento"** — listar biografía del experimento, fechas, datos personales, outputs crudos. ❌ Fuga de datos.
2. **Skill "hola mundo"** — description vaga ("use for things"), sin trigger_keywords. ❌ Dispatcher no podrá llamarlo.
3. **Skill "camaleón"** — name en PascalCase o con espacios. ❌ YAML inválido.
4. **Skill "espejo"** — copiar pegar outputs JSON de un test concretísimo. ❌ Fuga + invalidado por cambios API.
5. **Skill "sin salida"** — no documenta tipo de artefacto final. ❌ Runtime no sabe qué esperar.
6. **Skill "rex"** — más de 15 KB, listas enormes, sin sección `## Metrics`. ❌ Excede cost-efficient skill loading.
7. **Skill "secreto"** — sin sección Anti-pattern (`When NOT`). ❌ Imposible predecir fallos.
8. **Skill "ciego"** — sin Pre-flight checks cuando encadena 5+ tools. ❌ Silencioso en fallo dependencia.
9. **Skill "fuga"** — menciona nombre/DNI/cargo del usuario o tercero. ❌ Debe reescribirse con placeholders S1-S10.
10. **Skill "geo-fingerprint"** — referencia ciudad/universidad del usuario en artefactos "demo". ❌ Fingerprinting inverso.

---

## 11. VALIDACIÓN ANTI-ALUCINACIÓN (OBLIGATORIA pre-síntesis)

Todo skill que produzca síntesis textual DEBE documentar:

```markdown
## Anti-alucinación (obligatorio antes de síntesis final)
1. Verificar que cada número, %, fecha, nombre citado provenga de un fragmento textual extraído en este mismo flujo.
2. Si falta fuente, marcar el dato como `<sin_fuente>` en lugar de inferir.
3. No inventar números de página; si el dato proviene de una sección, citar la sección.
4. Llamar a `gateway.verify_antihallucination_data` antes de imprimir el output.
```

---

## 12. FALLBACK Y RESILIENCIA POR TOOL CRÍTICO

| Tool / Falla | Síntoma | Solución |
|--------------|---------|----------|
| `gateway.recover_metadata` | Timeout > 4min en DOI muerto | Usar `enrich_metadata` |
| `gateway.pdf_sections` | Timeout > 4min en PDF > 30 págs | Usar `pdf_smart_summary` + `read_pdf_markdown(pages=)` |
| `gateway.read_pdf` (path local) | `Cannot read properties of null` | Cambiar a `markitdown_convert` |
| `gateway.batch_convert` | Error `null.message` en local | Similar — solo remoto |
| `gateway.search(["latam"])` | Timeout / 0 results | Probar sources individuales con `fastMode:true` |
| `osm.geocode_address` (importance < 0.05) | 0 results | Pasar coords manuales conocidas |
| `osm.find_nearby_batch` (urbano denso) | HTTP 429 Overpass | Reducir a 3-4 sub-queries, radio 800m |
| `osm.explore_area` | 504 SERVICE_UNAVAILABLE | Retry 1-2 con backoff |
| `osm.polygon_from_admin` | 429 rate-limited | Esperar 60s o usar `osm_query_bbox` directo |
| `osm.find_charging_stations` (LatAm) | 0 EV stations | Confirmar conaltro dataset externo |
| `word.find_text_in_document` (acentos) | 0 results | Strip accents primero |
| `word.add_table` (sin rows/cols) | Pydantic error | Pasar siempre `rows` y `cols` |
| `word.protect_document` + `get_document_info` | "Package not found" | Expected cuando encrypted, no es error real |
| `markitdown_convert` (URL remoto) | Falla | Usar `gateway.read_pdf_markdown` |

---

## 13. NOMBRADO Y ORGANIZACIÓN DE SKILLS

| Prefijo | Significado |
|---------|-------------|
| `gateway-` | Skill solo-Gateway |
| `osm-` | Skill solo-OSM |
| `markitdown-` | Skill solo-MarkItDown |
| `word-` | Skill solo-Word |
| `gateway-osm-`, `osm-word-` (sin prefijo) | Skill dual |
| `triple-` | Skill que combina 3 MCPs |
| `quad-` | Skill que combina 4 MCPs |
| `cross-<caso>` | Cross-MCP de alto valor por caso de uso |
| `solo-<mcp>-` | Skill de un solo MCP muy especializado |
| `meta-` | Skill que opera sobre otros skills |

**Tamaños recomendados:**

| Audiencia | Tamaño objetivo | Límite |
|-----------|-----------------|--------|
| Claude | 4-8 KB | Max 12 KB |
| opencode | 3-6 KB | Max 8 KB |

**Estructura de directorio:**
```
<harness_root>/
└── skills/
    ├── letxinet-dual-mcps/      # 60 dirs con SKILL.md (62 skills S8→S9G)
    └── meta-templates/          # este archivo + templates previos (DEPRECATED)
```

Cada skill en su propio directorio. No mezclar múltiples SKILL.md en una sola carpeta (simplifica carga diferida del dispatcher).

---

## 14. CHECKLIST DE VALIDACIÓN PRE-ENTREGA

Antes de marcar un skill (o un nuevo workflow) como válido:

- [ ] Frontmatter completo (name, description, trigger_keywords, audience, version)
- [ ] `name` en kebab-case ≤ 60 chars
- [ ] `description` empieza con "Use for" o "Use when"
- [ ] `trigger_keywords`: 5-15 separados por coma
- [ ] Proven Chain incluye las tools exactas, abstrayendo datos sensibles (reglas S1-S13)
- [ ] Validated Output sin identificadores personales
- [ ] When to use: 3-10 casos
- [ ] When NOT to use: 3-6 anti-casos
- [ ] Gotchas: 5-10 problemas conocidos del MCP
- [ ] Metrics con tools count, time, output type
- [ ] Sin rutas absolutas a equipos del usuario
- [ ] Sin fechas fijas del usuario (usar ISO placeholders)
- [ ] Sin nombres de personas / instituciones personalizadas (salvo el MCP público)
- [ ] Sin ciudades del usuario (usar `<ciudad_usuario>` o `<ciudad_demo>`)
- [ ] Pre-flight checks si encadena > 3 tools
- [ ] Fallback policy documentada (ver §12)
- [ ] Anti-alucinación referenciada si produce síntesis (ver §11)
- [ ] Validar con scan de leaks (regex genérica: `\b[A-Z]{4,}\s[A-Z]{4,}\b` para nombres-apellidos en mayúsculas, `\b\d{8}\b` para DNIs, `C:\\Users\\[^\\]+\\[^\.]+\.(pdf|docx)` para rutas personales, más palabras-sentinel específicas detectadas en el histórico del pool)
- [ ] Confirmar tamaño total: claude ≤ 8 KB, opencode ≤ 6 KB

---

## 15. SCRIPT DE SANITIZACIÓN POST-GENERACIÓN (PowerShell)

```powershell
# Tabla canónica de reemplazos (extender si aparecen nuevas fugas detectadas por scan)
# Los placeholders reales a reemplazar se llenan DESPUÉS del primer scan del pool de skills existente.
# Patrón de uso: ante una nueva fuga detectada, agregar entrada con pattern→placeholder abstracto.
$replacements = @(
    # Ejemplos de estructura (NO incluyen valores reales para no auto-leakear esta regla):
    @{ pat = '<nombre_completo_real>';                  repl = '<NOMBRE_COMPLETO>' },
    @{ pat = '<dni_real_8_digitos>';                    repl = '<DNI>' },
    @{ pat = '<ruta_absoluta_a_pdf_personal>';          repl = '<RUTA_DOCUMENTO_PERSONAL>' },
    @{ pat = '<nombre_archivo_pdf_personal>';           repl = '<documentoPersonal>.pdf' },
    @{ pat = '<cargo_laboral_real>';                    repl = '<CARGO_LABORAL>' },
    @{ pat = '<dependencia_regional_real>';             repl = '<ODEI_REGIONAL>' },
    @{ pat = '<ciudad_usuario_real>';                   repl = '<ciudad_usuario>' },
    @{ pat = '<nombre_tercero_real>';                   repl = '<nombre_tercero>' },
    @{ pat = '<apellidos_tercero_real>';                repl = '<apellidos_tercero>' },
    @{ pat = '<rango_fechas_laborales_real>';           repl = '<periodo_laboral>' },
    @{ pat = '<institucion_personalizada_real>';        repl = '<institucion>' }
)
foreach ($f in (Get-ChildItem "$base\skills" -Filter 'SKILL.md' -Recurse)) {
    $c = [System.IO.File]::ReadAllText($f.FullName)
    foreach ($r in $replacements) { $c = $c.Replace($r.pat, $r.repl) }
    [System.IO.File]::WriteAllText($f.FullName, $c)
}
```

**Re-scan final (debe dar 0 leaks):**
```powershell
# Tras sanitizar, ejecutar scan con palabras-sentinel conocidas + pattern genérico.
# Las palabras-sentinel reales dependen del histórico del pool; ejemplos genéricos abajo.
$pat = '<nombre_apellido_real_a>|<nombre_apellido_real_b>|<dni_real>|<ruta_pdf_real>|<cargo_real>|<dep_regional_real>|<ciudad_real>|<tercero_real_a>|<tercero_real_b>|<periodo_real>|<institucion_real>'
foreach ($f in (Get-ChildItem $base -Recurse -File | Where-Object { $_.FullName -notlike "*backups*" -and $_.FullName -notlike "*\.zip" })) {
    try { $text = [System.IO.File]::ReadAllText($f.FullName) } catch { continue }
    foreach ($p in $pat.Split('|')) { if ($text.Contains($p)) { Write-Output "RESIDUAL: $p en $($f.FullName)" } }
}
```

**Flujo operativo para detectar nuevas sentinels:** (1) Genera un skill nuevo con datos reales de prueba. (2) Scan regex genérico:
`[A-Z]{4,}\s[A-Z]{4,}` (matchea todo NOMBRE APELLIDO en mayúsculas), `\b\d{8}\b` (posibles DNIs),
`C:\\Users\\[^\\]+\\[^\.]+\.(pdf|docx|txt)` (rutas a archivos personales). (3) Revisa matches manualmente.
(4) Si son personales → agrega entrada a `$replacements`. (5) Re-run pipeline.

---

## 16. MÉTRICAS DEL HARNES COMPLETO (S8 → S9G)

| Métrica | Valor |
|---------|-------|
| **MCPs integrados** | 4 |
| **Herramientas MCP totales** | 89 (28 + 41 + 2 + 18) |
| **Fuentes académicas operativas** | 30 de 39 (77%) |
| **Workflows documentados** | 62 (108% del plan maestro 57) |
| **Cobertura combinaciones MCP** | 100% (6 duales + 4 triples + 1 cuádruple + 13 cross + 38 solo) |
| **Skills generación sesiones** | S8 + S9A-G |
| **Artefactos en disco** | 17 docx + 3 pdf (~920 KB tras sanitización) |
| **Leak fixes aplicados** | 128 (ronda 1) + 23 (ronda 2) + 5 (ronda 3) + 4 renombrado docx/pdf |
| **Placeholders sanitizers** | 13 reglas (S1-S13) |
| **Backup pre-sanitización** | `backups/pre-sanitization-<timestamp>/` (342.86 KB) |

---

## 17. CUÁNDO USAR ESTA MEGASKILL vs SKILLS INDIVIDUALES

**Usa esta MEGASKILL maestra cuando:**
- El request del usuario cruza 2+ MCPs y necesitas diseño de cadena desde cero.
- No sabes qué skill individual cargar (el dispatcher está indeciso).
- Necesitas reglas formales para construir un nuevo skill.
- Necesitas sanitizar un skill legacy con datos personales.
- Necesitas el inventario completo de 89 tools o 39 fuentes.
- Estás diseñando un fallback para un workflow que falló.

**USA el skill individual específico cuando:**
- El request cae claramente en uno de los 62 arquetipos (skill dispatcher ya lo escogió).
- Necesitas el detalle de un solo workflow sin cargar TODO el corpus.
- Tienes contexto muy concreto (por ejemplo, EBM review) y el skill correspondiente ya está validado.

---

## 18. ANTI-PATRÓN DE ESTA MEGASKILL

No aplicar esta megaskill si:
- El request es trivial y compete a un solo MCP (cargar la megaskill es overhead).
- El SKILL.md individual ya está revision-approved por proceso normativo externo (FERPA, ISO 27001 audit) y no debe colocarse más encima.
- Necesitas benchmark temporal con fecha fija (e.g., Skill "snapshot 2026-Q1") — los placeholders pueden romper la auditabilidad.

---

## 19. CASOS DE USO DE ESTA MEGASKILL (10 típicos)

1. **"Build me a workflow that searches LatAm papers and produces a Word biblio"** → §6.1 D3 + §5.4 S9C-1.
2. **"I have a local PDF; can you extract tables and put them in a Word doc?"** → §6.1 D6 + §5.7 S9F-2.
3. **"Show me neighborhood quality + schools for this address"** → §6.1 D5 + §5.5 S9D-5 + S9D-12.
4. **"Plan an EV trip with CO2 estimates"** → §6.6 S9G-3 + §5.5 S9D-1.
5. **"Generate a PRISMA systematic review docx"** → §6.4 S9B-1 + §5.4 S9C-4.
6. **"Geocode MGRS tactical coords and produce situation report"** → §6.6 S9G-2.
7. **"Find prior art for patent and write claims docx"** → §6.4 S9B-3 + §5.4 S9C-8.
8. **"Convert my transcript PDF to an audit docx with footnotes"** → §6.6 S9G-4.
9. **"Trending AI papers + conference discovery + Word report"** → §6.4 S9B-8 + §5.4 S9C-11.
10. **"Multi-language thesaurus ES/EN/PT for生物学 marina"** → §6.6 S9G-5 + §5.4 S9C-5.

---

## 20. MÉTRICAS DEL META-MEGASKILL

- **Herramientas referenciadas:** 89 (4 MCPs)
- **Workflows catálogo:** 62 (108% del plan)
- **Reglas sanitización:** 13 (S1-S13)
- **Anti-patrones skill:** 10
- **Checklist validación:** 17 ítems
- **Cadenas canónicas:** 15 recetas en §6
- **Tiempo de aplicación:** ~30s para decisión de cadena, ~2-5min para revisión de skill nuevo
- **Output típico:** SKILL.md validado de 3-8 KB
- **Audiencia:** opencode (compacto), claude (extensible con ejemplos)
- **Versión:** 6.0.0 (sustituye a `META-SKILL-UNIVERSAL-CLAUDE.md` y `META-SKILL-UNIVERSAL-OPENCODE.md` versiones 1.0.0)

**FIN DE LA MEGASKILL MAESTRA UNIVERSAL — V6.0.0**
