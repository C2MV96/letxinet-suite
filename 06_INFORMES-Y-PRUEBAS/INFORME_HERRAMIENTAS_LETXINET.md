# Informe de pruebas — Herramientas de LetXinet Suite en Claude Code

**Fecha:** 01/11/2026, 14:06–14:17 (hora de Lima)
**Cómo se probó:** 3 subagentes de Claude Code llamaron a las herramientas MCP `letxinet-v11`, `letxinet-markitdown` y `letxinet-osm` con tareas reales de la tesis «Relación entre el perfil lipídico y el grado de la hipertensión arterial… Chimbote, 2025».
**Volumen:** 58 herramientas, 95 llamadas.
**Logs detallados (una fila por llamada):** `A_v11_busqueda_log.md` · `B_v11_pdf_log.md` · `C_osm_log.md`

## 1. Resultado global

| Grupo | Herramientas | ✅ Funciona | ⚠️ Parcial | ❌ Falla |
|---|---|---|---|---|
| A · V11 búsqueda y metadatos | 14 | 6 | 4 | 4 |
| B · V11 PDF y MarkItDown | 16 | 7 | 7 | 2 |
| C · OSM (mapas y rutas) | 28 | 13 | 5 | 10 |
| **Total** | **58** | **26 (45 %)** | **16 (28 %)** | **16 (28 %)** |

**Conclusión:** la mitad de la suite es fiable hoy. Las fallas tienen 3 causas:
1. **Un defecto del sidecar spaCy de V11**, propio de la suite, que degrada toda la búsqueda académica.
2. **Overpass caído**, un servidor externo. Explica las 10 fallas de OSM.
3. **Defectos de cada herramienta:** conversión de .docx, formatos de entrada no documentados y resultados irrelevantes.

## 2. Falla crítica: sidecar spaCy de V11 (HTTP 500)

- **Síntoma:** `smart_search` y `batch_search` superan los ~60 s, y `search` con `filterFalsePositives` devuelve 0 de 31 resultados.
- **Evidencia:** llamado directamente en `127.0.0.1:4002`, `/concept_match` y `/similarity` devuelven **500**; `/health` y `/analyze` devuelven 200. En el log de V11 aparecen series de `Exception on /concept_match` (08:43, 14:04 y otras anteriores).
- **Causa:** el sidecar carga los modelos `*_core_*_sm`, que **no traen vectores de palabra**. Al calcular la similitud, spaCy lanza `ValueError E010`, pero `MCP-V11-Local\python\spacy_server.py` (líneas ~192–245) solo captura `KeyError`.
- **Arreglo (no aplicado):** una de dos opciones.
  - (a) Instalar los modelos `_md` en `MCP-V11-Local\python-runtime`.
  - (b) En `spacy_server.py`, capturar también `ValueError` y pasar a una coincidencia léxica.

  Después hay que reiniciar el servicio `LetXinetSuiteMCPV11`.
- **Agravante:** RENATI tarda unos 30 s por llamada y se añade aunque no se pida, lo que empuja las búsquedas por encima del límite del cliente (~60 s).

## 3. Resultado por herramienta

### A · V11 búsqueda y metadatos (14)

| Herramienta | Estado | Observación |
|---|---|---|
| list_sources | ✅ | 39 fuentes: 37 gratuitas y 2 premium con clave (Scopus, SerpApi) |
| help | ✅ | |
| fetch_metadata | ✅ | Detectó los DOI falsos o ajenos |
| recover_metadata | ✅ | Rápido; vacío cuando la referencia no existe |
| search_conferences | ✅ | |
| trending_papers | ✅ | No aplica al tema médico |
| search | ⚠️ | 9–45 s; devuelve siempre 8 resultados; poca relevancia en español; PubMed y OpenAlex dan 0 |
| batch_search | ⚠️ | Con 4 consultas, timeout; con 1 consulta y 1 fuente, ~62 s |
| health_check | ⚠️ | Dice «ok» sin revisar fuentes ni sidecar: **falso positivo** |
| enrich_metadata | ⚠️ | **Peligrosa:** puso abstracts de otros artículos a referencias falsas sin avisar |
| smart_search | ❌ | Timeout en 2 de 2 intentos, incluso con fastMode |
| search_dblp | ❌ | 0 resultados incluso con «blood pressure» |
| search_paperswithcode | ❌ | Ignora la consulta y devuelve los papers del día de HuggingFace |
| coverage_report | ❌ | Siempre 0/0, incluso con `use_cache=false` |

### B · V11 PDF y MarkItDown (16)

| Herramienta | Estado | Observación |
|---|---|---|
| resolve_pdf | ✅ | |
| pdf_metadata | ✅ | |
| read_pdf | ✅ | |
| extract_section | ✅ | La más útil; búsqueda flexible en español |
| pdf_smart_summary | ✅ | |
| extract_tables | ✅ | 11 tablas de Solnica y 5 de Aygun, buena calidad |
| markitdown_health | ✅ | |
| markitdown_convert | ⚠️ | Funciona con PDF; **no acepta .docx** |
| download_pdf | ⚠️ | No guarda el archivo; solo devuelve el enlace doi.org |
| read_pdf_markdown | ⚠️ | Ignora el rango de páginas; 38 s; en una tesis expuso números de DNI |
| pdf_citations | ⚠️ | Corta las referencias por línea: autores y años salen mal |
| analyze_academic | ⚠️ | Etiqueta mal las secciones; no reconoce HR ni IC; salida de hasta 81 000 caracteres |
| pdf_sections | ⚠️ | Marcada como obsoleta (funciona) |
| extract_formulas | ⚠️ | Devolvió 0, lo cual es correcto: los PDF probados no traen la fórmula de Cochran. Queda sin validar con una fórmula real |
| convert_document | ❌ | No acepta .docx; falta el script interno `pdf_to_markdown.py` |
| batch_convert | ❌ | No acepta .docx; timeout con un PDF de 7 MB; solo devuelve recuentos de caracteres |

### C · OSM (28)

| Estado | Herramientas |
|---|---|
| ✅ (13) | reverse_geocode, get_route_directions, route_fetch, route_sample, polyline_encode, polyline_decode, geo_distance, bbox_from_points, centroid_points, tile_cache, enrich_emissions, get_version, osm_health |
| ⚠️ (5) | geocode_address (un filtro de relevancia fijo descarta los resultados correctos), filter_tags y sort_by_distance (exigen `id` de texto más `location:{latitude,longitude}`, sin documentar), analyze_commute (usa el tiempo del auto para la bici y a pie), get_map_image (1 recuadro de 256 px sin marcadores) |
| ❌ (10) — **Overpass caído** | find_nearby_places, find_nearby_batch, explore_area, osm_query_bbox, polygon_from_admin, suggest_meeting_point, find_schools_nearby, find_parking_facilities, find_charging_stations, analyze_neighborhood |

`osm_health` informa que OSRM está caído, pero las 4 herramientas de rutas respondieron con rutas reales: **es un falso negativo del chequeo**.

## 4. Recomendaciones (de mayor a menor prioridad)

1. **Arreglar el sidecar spaCy** (§2). Así se recuperan `smart_search`, `batch_search` y el filtro de `search`.
2. **No usar `enrich_metadata` sin revisar el resultado**, porque inventa abstracts. Para verificar referencias conviene `fetch_metadata` con Crossref.
3. **Hacer que RENATI sea opcional** en `search` y subir el timeout del cliente a 120 s, o ajustar el presupuesto de tiempo de V11.
4. **Corregir `health_check` y `coverage_report`** para que sondeen las fuentes y el sidecar de verdad.
5. **Habilitar .docx** en `convert_document` y `markitdown_convert`, restaurar `pdf_to_markdown.py` y hacer que `download_pdf` guarde el archivo.
6. **OSM:** configurar un Overpass alternativo en `LetXinet-Suite.env`, por ejemplo `OVERPASS_URL=https://overpass.kumi.systems/api/interpreter`. Además, revisar el umbral de `geocode_address` y el perfil de `analyze_commute`.
7. **Arreglar `search_dblp` y `search_paperswithcode`** o retirarlas: hoy no aportan.

**Uso recomendado hoy para la tesis:** `search` (con Crossref y fastMode), `fetch_metadata`, `recover_metadata`, `extract_section`, `extract_tables`, `pdf_smart_summary`, `read_pdf` y `geo_distance`/`reverse_geocode`.

## 5. Mejoras para la tesis obtenidas con las herramientas

Archivos completos: `A_mejoras_tesis.md`, `B_mejoras_tesis.md` y `C_mejoras_tesis.md`.

### Referencias
- **Falsas, hay que eliminarlas:**
  - Carey 2018 NEJM: el DOI no existe.
  - Winters 2019 J Clin Med: el DOI pertenece a otro artículo.
  - Gamboa y Benavides 2010: no aparece en ninguna fuente.
- **Reemplazos verificados en Crossref:**
  - Carey et al. 2018, JACC (10.1016/j.jacc.2018.07.008), o Carey et al. 2022, JAMA (10.1001/jama.2022.19590).
  - Oparil et al. 2018 (10.1038/nrdp.2018.14).
  - Unger et al. 2020, guía ISH (10.1161/HYPERTENSIONAHA.120.15026).
  - Ruiz-Alejos et al. 2021, dato peruano (10.17843/rpmesp.2021.384.8502).
- **Perveen et al. 2025 existe:** Saudi J Med, 10.36348/sjm.2025.v10i06.003, aunque es una revista de bajo impacto.
- **Kumari y Kishor 2024 no existe.** Hay que reemplazarla por Gangapatnam et al. 2025 (10.9734/ajcr/2025/v8i1336) o por Lakhi y Kumari 2025, Cureus (10.7759/cureus.93080). Conviene leerlos a texto completo antes de citar cifras.

### Antecedente local
- **No hay ningún estudio de perfil lipídico + HTA en Chimbote:** ese vacío sirve como argumento para la **justificación**.
- **Antecedentes cercanos:** Domínguez Granda 2019 (ULADECH), Rojas Eustaquio 2015 (UNS), Arredondo 2017 (provincia del Santa), Calderón 2023 (UCV) y Solano 2026 (Huaraz; la universidad está por confirmar).

### Discusión
- **Xie 2022:** cohorte de 2116 personas, Cox. HR 1,369 (IC 95 %: 1,164–1,610) en menores de 55 años; en los de 55 o más no hubo asociación.
- **Baca Carrasco 2020:** n = 267, chi-cuadrado. CT/HDL y LDL/HDL se asocian con la HTA solo en mujeres (p = 0,016 y p = 0,017).
- **Segovia 2024:** n = 141, prueba exacta de Fisher. Sin relación entre CT o TG y el grado de HTA (p = 0,133 y p = 0,331).

### Metodología
- **La tabla NCEP 2002 de la tesis es correcta.** Las guías recientes usan cortes más estrictos: Solnica 2024 (CT < 190, TG < 100 en ayunas, HDL > 45 en mujeres) y Aygun 2022 (metas de LDL según el riesgo). Conviene mencionarlo en las **limitaciones**.
- **La fórmula de Cochran está bien escrita:** hay que citarla como **Cochran (1977)**, no como Hadi ni Medina.

### Localización
- **Chimbote:** -9.0745, -78.5936.
- **C.S. Progreso:** -9.0643, -78.5865, aproximadas; hay que confirmarlas con GPS.
- **Distancias desde el C.S. Progreso:**
  - Hospital La Caleta: 2,03 km en línea recta y 2,9 km en auto.
  - Hospital Regional Eleazar Guzmán Barrón: 9,34 km en línea recta y 11,1 km en auto.
- **Mapa base:** `mapa_chimbote.png`, en baja resolución y sin marcadores.
- **Lista de establecimientos de la Microred Progreso:** no se pudo obtener porque Overpass está caído. Hay que pedirla a la Microred o consultar RENIPRESS.

*Durante las pruebas no se modificó ningún documento de la tesis ni ningún archivo de la suite.*
