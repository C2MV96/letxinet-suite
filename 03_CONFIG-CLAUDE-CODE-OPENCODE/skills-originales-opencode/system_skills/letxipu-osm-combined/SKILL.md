---
name: letxipu-osm-combined
description: Skill maestro para investigación geoespacial-académica combinando letxipu-search (28 tools, 39 fuentes LatAm/Perú/global) y letxipu-osm (25 tools OpenStreetMap). Úsalo cuando el usuario pida investigar un lugar, ciudad, barrio, plaza, mercado, infraestructura o fenómeno territorial con respaldo académico. v4: las 53 herramientas probadas una por una en vivo el 18 jul 2026 contra el servidor letxipu-search-mcp v8.0.0 y letxipu-osm-mcp.
---

# Skill: Investigación Geoespacial-Académica con MCP Combinado (letxipu-search + letxipu-osm)

## Cuándo usar este skill

Úsalo SIEMPRE que el usuario solicite:
- "Investiga [lugar/ciudad/zona/plaza/mercado/barrio]"
- "Problemática de [lugar]", "Universidades de [ciudad] con papers relacionados"
- "Compara [lugar A] vs [lugar B]", "Turismo/patrimonio en [lugar]"
- Cualquier tarea que combine dimensión **territorial** con base **científica/literaria**

NO úsalo para:
- Búsqueda puramente académica sin componente geográfico → solo `letxipu-search`
- Geocodificación pura sin contexto académico → solo `letxipu-osm`

Ambos MCP son tools "deferred": llamar `tool_search` primero para cargar los esquemas exactos. Antes de asumir que algo está roto, verificar con `letxipu-search:health_check` qué versión del servidor está activa — el backend cambia de versión sin aviso y el comportamiento puede diferir de lo documentado aquí. Esta skill se re-verificó por completo, herramienta por herramienta, el 18 jul 2026; si pasa más de un mes, re-probar antes de confiar ciegamente en la tabla.

---

## letxipu-osm — 25 herramientas (las 25 confirmadas operativas, probadas una por una)

| Tool | Parámetros reales confirmados | Estado y nota |
|---|---|---|
| `geocode_address` | `address` | ✅ Soporta MGRS/UTM/DMS además de texto libre |
| `reverse_geocode` | `latitude`, `longitude` | ✅ |
| `geo_distance` | `from`, `to` (objetos {latitude, longitude}) | ✅ Haversine, resultado en metros. Ojo: los parámetros son `from`/`to`, no `point1`/`point2` |
| `route_fetch` | `start`, `end`, `mode` | ✅ OSRM real. Devuelve `polyline` codificada + distancia + duración |
| `get_route_directions` | `start_lat`, `start_lon`, `end_lat`, `end_lon`, `mode` | ✅ Da resultados idénticos a `route_fetch`/`analyze_commute` para el mismo par de puntos |
| `route_sample` | `polyline`, `interval` | ✅ Muestrea puntos a lo largo de una ruta real |
| `polyline_encode` | `points` | ✅ Round-trip verificado con `polyline_decode` |
| `polyline_decode` | `polyline` | ✅ |
| `centroid_points` | `points` | ✅ |
| `bbox_from_points` | `points` | ✅ |
| `sort_by_distance` | `elements`, `ref` | ✅ |
| `filter_tags` | `elements`, `tags` (valores como array) | ✅ |
| `osm_query_bbox` | `bbox` ({minLat,minLon,maxLat,maxLon}), `tags` | ✅ Consulta Overpass directa; la más rica para POIs específicos |
| `find_nearby_places` | `latitude`, `longitude`, `category`, `radius` (máx 50000), `limit` | ✅ Funciona correctamente |
| `find_schools_nearby` | `latitude`, `longitude`, `radius` (máx 5000), `school_type` | ✅ |
| `find_parking_facilities` | `latitude`, `longitude`, `radius` (máx 5000), `include_private`, `type` | ✅ (los nombres de resultado suelen venir duplicados, ej. "Parking parking" — es dato crudo de OSM, no un bug de la tool) |
| `find_charging_stations` | `latitude`, `longitude`, `radius` (máx 10000), `limit` | ✅ Probado con radio 8000 exitosamente — el límite real es 10000, no 5000 |
| `analyze_neighborhood` | `latitude`, `longitude`, `radius` (máx 2000), `include_price_data`, `neighborhood_name` | ✅ Muy completo: scores de habitabilidad + lista extensa de amenities reales |
| `explore_area` | `latitude`, `longitude`, `radius` (máx 5000) | ✅ Conteo por categoría (`amenity:*`, `shop:*`, `tourism:*`...) + key_features + top_places |
| `suggest_meeting_point` | `locations`, `category`, `limit` | ✅ Puede fallar de forma transitoria ("Tool execution failed") — **causa raíz confirmada leyendo el código fuente**: internamente delega en `find_nearby_places`, que a su vez consulta Overpass API; el fallo es la misma inestabilidad/rate-limit de Overpass que se ve directamente en `osm_query_bbox` (error 429), no un bug propio de esta tool. Reintentar una vez antes de descartar |
| `analyze_commute` | `home_latitude/longitude`, `work_latitude/longitude`, `transport_modes` | ✅ Da tiempos/distancias/CO2/calorías correctamente diferenciados por modo |
| `enrich_emissions` | `options` (array de {mode, distance}) | ✅ Añade CO2/costo (car) o calorías (bike/foot) a opciones de ruta ya calculadas |
| `get_map_image` | `latitude`, `longitude`, `zoom` (1-19) | ✅ Devuelve PNG real y visible en Claude |
| `tile_cache` | `action` ("list"/"get"/"stats") | ✅ |
| `get_version` | (sin parámetros) | ✅ Devuelve versión del binario Go del servicio (reporta "dev" como versión) |

---

## letxipu-search — 28 herramientas (probadas una por una con un paper real: Politai-PUCP DOI 10.18800/politai.202402.003)

### Búsqueda — todas operativas, con matices de calidad

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| `search` | `query`, `sources`, `fastMode`, `maxSources`, `yearStart/End`, `filterFalsePositives` | ✅ **Usar siempre `filterFalsePositives: true`** — probado directamente: sin este flag, resultados irrelevantes (ausentismo laboral, cultivo de limón) aparecían mezclados por coincidencia parcial de términos; con `filterFalsePositives: true` en la misma query, 6/6 resultados fueron directamente relevantes. `maxSources` no limita estrictamente el conteo final |
| `batch_search` | `queries`, `sources` (IDs o grupos) | ✅ Funciona bien tanto con fuente específica como con grupos (`sources:["peru"]` probado con 2 queries, ~30s, sin timeout, 100 resultados antes de dedup) |
| `smart_search` | `query`, `sources`, `maxResults`, `location` | ⚠️ **Causa raíz confirmada en el código** (`generateQueryVariations()`): (1) con `fastMode: true` la generación de variantes se salta por completo — el análisis spaCy y la búsqueda de sinónimos están dentro de bloques `if (!fastMode)`, algo no mencionado en la descripción de la tool; (2) incluso con `fastMode: false`, el pool de sinónimos usado para el matching semántico está hardcodeado a términos de biología/agronomía (`bacteria`, `microorganismo`, `ácido indol`, `rizosfera`, `fitohormona`...), sobrante de un caso de uso anterior — para temas ajenos a ese dominio (ciencias sociales, derecho, etc.) nunca va a encontrar un sinónimo válido. En la práctica, para la mayoría de temas de investigación en Perú, tratar `smart_search` como un `search` normal, sin esperar variantes reales. Además, con `sources:["peru"]` devolvió papers de universidades ecuatorianas etiquetados como "La Referencia (Perú)" — la fuente `laref_peru` no filtra estrictamente por país |
| `list_sources` | (sin parámetros) | ✅ Devuelve las 39 fuentes reales con id/país/categoría y los grupos (`peru`, `latam`, `ai_ml`, etc.) |

### Metadatos

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| `fetch_metadata` | `doi`/`title`/`url` | ✅ Con DOI indexado en OpenAlex: completeness 100/100. Con solo un handle ALICIA sin DOI: completeness 15/100 (no es un fallo de la tool, es que la fuente no tiene DOI recuperable) |
| `recover_metadata` | `doi`/`title`/`url` | ✅ Mismo comportamiento que `fetch_metadata` en la práctica — con handle sin DOI, completeness 15/100 también. La diferencia teórica (cascada de 5 fuentes) no se tradujo en mejor resultado en la prueba con un handle puro |
| `enrich_metadata` | `papers` (array) | ✅ Versión batch; con DOI real logró completeness 75/100 y enriqueció year/abstract/university |

### PDFs / documentos (probadas todas contra el mismo PDF real de 25 páginas)

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| `download_pdf` | `doi`/`url` | ✅ Resuelve URL de descarga vía Unpaywall correctamente |
| `resolve_pdf` | `identifier` | ✅ Resuelve DOI→URL final con pasos explicados (`resolvedFrom: "Unpaywall"`) |
| `read_pdf` | `source`, `format`, `maxChars`, `pages` | ✅ Extrae texto real vía MinerU, soporta rango de páginas y límite de caracteres |
| `pdf_metadata` | `source` | ✅ Título/autor/páginas/fechas del archivo (nota: puede venir vacío si el PDF no tiene metadata embebida, como en este caso — devolvió `creator`/`producer` de Adobe pero título/autor vacíos) |
| `pdf_sections` | `source` | ✅ Excelente: detectó 22 secciones reales (Resumen, Metodología, Resultados, Referencias, etc.) con fuzzy match ES/EN |
| `extract_section` | `source`, `section` | ✅ Extrae texto completo de una sección con nombre fuzzy (ej. "referencias" trajo 10,470 caracteres reales) |
| `pdf_smart_summary` | `source`, `maxTotalChars` | ⚠️ Funciona pero **clasificación de tipo de documento poco confiable**: un artículo de revista académica (Politai-PUCP) fue etiquetado como `documentType: "thesis"`. No confiar en `documentType`; usar `pdf_metadata`/contexto para eso |
| `analyze_academic` | `source` | ⚠️ Mismo problema de clasificación que `pdf_smart_summary`. Además, **falsos positivos en detección estadística**: fusionó una frecuencia de tabla ("40") con un porcentaje adyacente ("5.6%") generando un porcentaje inventado ("405.6%"). Revisar manualmente cualquier estadística citada de esta tool antes de usarla |
| `convert_document` | `source`, `maxChars` | ✅ Funciona (usa MinerU API como motor). Advertencia interna visible en la respuesta: el extractor local `markitdown` está roto en el servidor (`python3: can't open file '/app/scripts/pdf_to_markdown.py'`) y cae automáticamente a MinerU — no afecta el resultado pero indica que el fallback local no está disponible |
| `batch_convert` | `sources` (array, máx 10), `maxCharsPerDoc` | 🔴 **Roto — causa raíz confirmada**: `detectFormat()` obtiene el tipo de archivo con `path.extname()` sobre el nombre/URL, no del contenido ni de `Content-Type`. URLs de descarga tipo OJS/PKP (ej. `.../article/download/30066/26980`, sin extensión visible) devuelven `'unknown'` y el pipeline de MinerU se rechaza a sí mismo con el error de "no API key". Usar `convert_document` en un loop manual en su lugar |
| `extract_tables` | `source`, `format` | 🔴 **Roto — misma causa raíz que `batch_convert`** (detección de formato por extensión de archivo falla en URLs sin extensión). `convert_document` no tiene este problema porque usa una ruta de detección distinta. Usar `convert_document` y extraer las tablas del Markdown resultante |
| `extract_formulas` | `source` | 🔴 **Roto — misma causa raíz que `extract_tables`/`batch_convert`**. Mismo workaround: `convert_document` |
| `pdf_citations` | `source` | 🔴 **Roto — causa raíz confirmada en el código fuente**: `extractCitations()` busca la sección de referencias con el regex `/\b(references|bibliography|works\s+cited)\b/i` — **solo reconoce encabezados en inglés**. Cualquier PDF en español con sección "Referencias" (como casi todo ALICIA/RENATI/revistas peruanas) nunca matchea, de ahí el `citations: []` constante. Usar `extract_section("referencias")` en su lugar |

### Fuentes especializadas CS/ML

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| `search_dblp` | `query`, `maxResults` | 🔴 **Roto** — 0 resultados en ~200-425ms (demasiado rápido para ser un sondeo real a la API), probado con queries muy conocidas ("attention is all you need"). Código fuente (V10) revisado: la lógica de la función es correcta, el fallo parece estar en la API externa de DBLP, no en el cliente |
| `search_conferences` | `query`, `maxResults` | 🔴 **Roto** — mismo patrón, 0 resultados consistentes vía OpenReview |
| `search_paperswithcode` | `query`, `maxResults` | ℹ️ **No es un bug — es un redirect intencional y documentado en el código**: `searchPapersWithCode()` contiene el comentario `"[PapersWithCode] API is dead (closed by Meta). Redirecting to Hugging Face Trending Papers."`. La API real de Papers With Code fue cerrada por Meta; la tool redirige deliberadamente a HuggingFace Daily Papers como reemplazo. Por eso resultados de temas ajenos a IA/ML (ej. "crime prediction") salen irrelevantes — es el comportamiento esperado del fallback, no un fallo |
| `trending_papers` | `query` (opcional), `maxResults` | ✅ Funciona bien **sin filtro de tema** (50 papers recientes de HuggingFace Daily Papers). Con un filtro de tema ajeno al dominio IA/ML (ej. "crime") devuelve 0 resultados — es esperable, no es un bug, ese dataset es específicamente IA/ML |

### Utilidad

| Tool | Parámetros clave | Estado y nota |
|---|---|---|
| `health_check` | (sin parámetros) | ✅ Reporta versión real del servidor activo (`8.0.0` al momento de esta prueba) y estado de MinerU/markitdown/pdf-parse — usar esto para verificar qué versión se está probando |
| `coverage_report` | `use_cache` | 🔴 **Roto en la práctica, pero con causa raíz explicable**: `performCoverageReport()` no hace ningún sondeo en vivo — lee un archivo persistido en `.agents/skills/source-tester/references/last_test_results.json`, generado por la skill separada `source-tester` del mismo repo. Si esa skill nunca se ejecutó (o el archivo no se encuentra por la ruta `LETXIPU_PROJECT_ROOT`), el reporte queda vacío por diseño — **no es un problema de caché**, `use_cache: false` nunca lo iba a arreglar. El fix real sería correr la skill `source-tester` primero. Mientras tanto, usar `health_check` |
| `help` | `topic` | ✅ Devuelve documentación completa de cualquier tool/fuente, incluye los 39 sources y sus grupos |

---

## Anti-patrones (solo lo confirmado roto tras probar cada tool individualmente)

- ❌ **`pdf_citations`** → usar `extract_section("referencias")`
- ❌ **`extract_tables` / `extract_formulas` / `batch_convert`** → las tres fallan con el mismo error de detección de formato aunque `convert_document`/`read_pdf` sí funcionan con el mismo documento. Usar `convert_document` y parsear tablas/fórmulas del Markdown resultante
- ❌ **`search_dblp` / `search_conferences`** → 0 resultados consistentemente; usar `search(sources=["global"])` para cobertura CS/ML alternativa
- ❌ **`coverage_report`** → depende de una skill (`source-tester`) que probablemente no se corrió; usar `health_check`
- ❌ **Confiar en `documentType` de `pdf_smart_summary`/`analyze_academic`** → puede clasificar un artículo de revista como tesis
- ❌ **Citar estadísticas de `analyze_academic` sin revisar** → puede fusionar números de tablas adyacentes en falsos porcentajes
- ❌ **Esperar que `smart_search` genere variantes reales** → con `fastMode:true` la generación de variantes se salta por completo (no documentado); incluso sin `fastMode`, el pool de sinónimos está hardcodeado a biología/agronomía y no sirve para otros dominios
- ❌ **`find_charging_stations` con radio > 10000** → ese es el límite real (no 5000 como se documentaba antes)
- ❌ **`search` sin `fastMode: true`** → riesgo de timeout con el enriquecimiento DME activado
- ❌ **`search`/`batch_search` sin `filterFalsePositives: true`** → ruido alto confirmado (resultados de temas completamente ajenos por coincidencia parcial de palabras); con el flag activado, ruido cero en la misma prueba
- ℹ️ **`search_paperswithcode` no es un anti-patrón, es un fallback intencional** (Papers With Code cerró su API real) — para tema ajeno a IA/ML, usar directamente `trending_papers` sabiendo que es HuggingFace Daily Papers

---

## TOOLBOX recomendado

### letxipu-osm — flujo recomendado
1. `geocode_address` / `reverse_geocode` → coordenadas del lugar
2. `osm_query_bbox` (bbox ±0.01°-0.02°, tags específicos) → POIs precisos por categoría
3. `explore_area` o `analyze_neighborhood` (radio ≤2000-5000m) → panorama general de la zona
4. `find_nearby_places` → alternativa directa cuando se necesita una sola categoría simple
5. `route_fetch` / `analyze_commute` / `enrich_emissions` → movilidad, comparación de modos y huella de carbono
6. `get_map_image` → imagen visual de apoyo

### letxipu-search — flujo recomendado
1. `search(sources=["peru"|"alicia"|"renati"], fastMode: true, maxSources: 10-15)` → búsqueda base
2. `batch_search(queries: [...], sources: [...])` → cobertura amplia con varias queries/fuentes en paralelo
3. `recover_metadata` o `fetch_metadata` → completar datos de un paper puntual (funcionan igual de bien/mal según si el paper tiene DOI indexado)
4. `pdf_sections` → mapa de secciones del PDF
5. `extract_section(section="metodología"/"resultados"/"referencias")` → contenido específico completo
6. `convert_document` → cuando se necesiten tablas/fórmulas reales o el texto completo estructurado (NO usar `extract_tables`/`extract_formulas`/`batch_convert`, están rotas)

---

## Combinaciones núcleo

| Patrón | Secuencia |
|---|---|
| **Geo→Acad** | `geocode_address` → `search(fastMode:true)` |
| **Area→Acad** | `osm_query_bbox` + `explore_area`/`analyze_neighborhood` → `search` |
| **POI→Acad** | `find_nearby_places` u `osm_query_bbox` → `search` por cada POI |
| **Commute→Acad** | `analyze_commute` o `route_fetch` × cada modo → `enrich_emissions` → `search` (movilidad) |
| **Paper→Detalle** | `recover_metadata`/`fetch_metadata` → `pdf_sections` → `extract_section` (nunca `pdf_citations`) |
| **Compare→Acad** | `geocode_address` × N lugares → `batch_search` o `search` por lugar |

---

## PROTOCOLOS (5 niveles de profundidad)

### NIVEL 1 — Mini-análisis (5-10 min, 2 tools)
```
1. reverse_geocode(lat, lon) o geocode_address("{lugar}, {ciudad}, Peru")
2. search(query="{lugar} {tema}", sources=["peru"], maxSources=10, fastMode=true, filterFalsePositives=true)
```

### NIVEL 2 — Estándar (15-25 min, 3-5 tools)
```
1. geocode_address(lugar)
2. osm_query_bbox(bbox=±0.01°, tags={amenity:"marketplace"})
3. explore_area(lat, lon, radius=1000) o analyze_neighborhood(lat, lon, radius=1000)
4. search(query=raíz del lugar + problemática, sources=["peru"], maxSources=15, fastMode=true, filterFalsePositives=true)
5. search(query=tema específico, maxSources=10, fastMode=true, filterFalsePositives=true)
```

### NIVEL 3 — Profundizado (25-40 min, 5-8 tools)
```
1. geocode_address(lugar)
2. osm_query_bbox(bbox=±0.02°, tags={amenity:"marketplace"})
3. analyze_neighborhood(lat, lon, radius=1500)
4. search(query="{tema} {ciudad} problemática", sources=["peru"], maxSources=15, fastMode=true, filterFalsePositives=true)
5. batch_search(queries=[2-3 variantes], sources=["peru"] o fuente específica, maxResults=15)
6. Para 1-2 papers clave: recover_metadata → pdf_sections → extract_section("resultados")
7. Redactar informe completo (ver plantilla)
```

### NIVEL 4 — Comparativo inter-provincial (40-60 min, 8-12 tools)
```
Para cada lugar [A, B, ...]:
  1. geocode_address(lugar)
  2. osm_query_bbox(bbox=±0.02°)
  3. search(query=problema + lugar, sources=["peru"], maxSources=10, fastMode=true, filterFalsePositives=true)
Síntesis: tabla comparativa POIs + papers + problemas
```

### NIVEL 5 — Benchmark territorial (25+ regiones, 2-8h)
```
for región in 25_REGIONES_PERU:
    1. geocode_address(ciudad + ", Peru")
    2. batch_search(queries=[tema + ciudad + "universidad"], sources=["peru"], maxResults=5)
```

---

## Plantilla de informe estándar

```markdown
# Investigación: [TEMA] de [LUGAR]

## Ubicación geográfica (OSM MCP)
- Coords: lat, lon | Nombre oficial OSM | Mapa: openstreetmap.org/#map=17/LAT/LON

## POIs detectados (osm_query_bbox / find_nearby_places)
| # | Nombre | Coords | Tags | ID |

## Cartografía de la problemática (letxipu-search)
### A. [Categoría 1]
- Autor (Universidad, Año) — "Título" (URL hdl.handle.net): hallazgo resumido

[5-7 categorías]

## Cadenas de problemas interconectados (causal loop ASCII)

## Propuestas de solución detectadas
| # | Solución | Fuente | Aplicabilidad |

## Brechas de investigación
## Conclusión (≤200 palabras)
```

---

## Quickstart checklist

- [ ] ¿Lugar identificado?
- [ ] ¿`tool_search` ejecutado para cargar los tools deferred de ambos MCP?
- [ ] ¿Nivel de profundidad decidido? (1=rápido, 3=estándar, 5=benchmark)
- [ ] ¿Evitando `pdf_citations` / `search_dblp` / `search_conferences` / `search_paperswithcode` / `coverage_report` / `extract_tables` / `extract_formulas` / `batch_convert`?
- [ ] ¿Verificaste con `health_check` qué versión del servidor está activa?
- [ ] ¿`fastMode: true` y `filterFalsePositives: true` en `search`/`batch_search`?
- [ ] ¿`sources` adecuado? (`["peru"]` solo Perú, `["peru","latam"]` LatAm — recordar que `laref_peru` puede filtrar de forma laxa)
- [ ] ¿Estructura de output respetada? (POIs + Categorías + Causal loop + Soluciones + Brechas + Conclusión)

---

## Referencia

Las 53 herramientas (25 `letxipu-osm` + 28 `letxipu-search`) fueron probadas **una por una, individualmente, con llamadas reales** el 18 jul 2026, contra el servidor activo `letxipu-search-mcp` v8.0.0 (confirmado vía `health_check`) y `letxipu-osm-mcp`. Se usó como caso de prueba un artículo académico real (Benites Guerrero et al., 2024, Politai-PUCP, DOI 10.18800/politai.202402.003) para todas las herramientas de PDF/metadata, y coordenadas reales de Trujillo/Lima/Piura para todas las herramientas OSM.

Resultado: **39 de 53 herramientas funcionan correctamente**, **2 no son bugs sino comportamiento intencional documentado en el código** (`search_paperswithcode` redirige a HuggingFace porque la API real de Papers With Code fue cerrada por Meta), y **12 tienen problemas reales** (`pdf_citations`, `extract_tables`, `extract_formulas`, `batch_convert`, `search_dblp`, `search_conferences`, `coverage_report`, `smart_search` sin variantes reales, `pdf_smart_summary`/`analyze_academic` con clasificación y falsos positivos).

**Causas raíz confirmadas leyendo el código fuente línea por línea (no solo el síntoma en producción):**
- `pdf_citations`: regex de detección de sección de referencias solo reconoce inglés (`references|bibliography|works cited`), nunca matchea "Referencias" en español (`src/providers/pdf-processor.ts:410-457`)
- `extract_tables`/`extract_formulas`/`batch_convert`: `detectFormat()` deriva el tipo de archivo de la extensión del nombre/URL (`path.extname`), no del contenido; URLs de descarga tipo OJS/PKP sin extensión visible (muy comunes en revistas peruanas) devuelven `'unknown'` (`src/providers/mineru-client.ts:67-75`)
- `coverage_report`: no sondea nada en vivo, lee un archivo `.agents/skills/source-tester/references/last_test_results.json` generado por una skill separada del mismo repo; si nunca se corrió, el reporte queda vacío por diseño (`src/routes/mcp.ts:736-893`)
- `smart_search`: `generateQueryVariations()` salta toda su lógica de variantes cuando `fastMode:true` (no documentado), y su pool de sinónimos semánticos está hardcodeado a términos de biología/agronomía (`bacteria`, `rizosfera`, `ácido indol`...), inútil fuera de ese dominio (`src/routes/mcp.ts:534-667`)
- `search_paperswithcode`: redirect intencional y documentado en un `console.warn`, no un bug (`src/providers/paperswithcode.ts:5-11`)
- `suggest_meeting_point` (letxipu-osm): el fallo transitorio ocurre porque delega internamente en `find_nearby_places` → Overpass API; es la misma inestabilidad de Overpass vista directamente en `osm_query_bbox` (error 429), no un bug propio (`pkg/tools/routes.go:259-436`)

El repo `LETXIPU-SEARCH-MCP-V10` incluye además corridas de prueba históricas propias en `.agents/skills/python-tools-multiregion-tester/reports/` (25 regiones de Perú, múltiples tools) que no se reprocesaron aquí para evitar redundancia, pero son un recurso adicional útil si se necesita profundizar.

Código fuente de referencia: `D:\OTROS\LETXIPU-SEARCH-MCP-V10` (97,119 nodos / 98,623 edges, indexado con `codebase-memory-mcp` en modo `fast` — los modos `full`/`moderate` no completan en repos de este tamaño) y `D:\OTROS\letxipu-osm-mcp` (1,140 nodos / 4,226 edges, Go).
