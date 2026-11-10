# LetXinet Suite

LetXinet Suite es un instalador para Windows 10 y 11 (x64). Deja funcionando en el equipo, como servicios locales, herramientas de investigación académica, mapas y conversión de PDF. Los clientes de IA compatibles con MCP las usan: Claude Code, Claude Desktop y OpenCode.

- **Suite 1.1.6, Variante B:** sin claves; cada usuario carga las suyas.
- **Addon Bridges 1.0.0:** complemento opcional que agrega Word y LaTeX.
- **Herramientas MCP:** 28 de búsqueda académica y PDF, 28 de mapas, 2 de conversión de PDF, 5 del puente de tareas largas, más 24 de Word y 9 de LaTeX con el addon.
- **Skills:** 2 skills para Claude Code y 62 para OpenCode.

| | |
|---|---|
| **Versión** | 1.1.6 (10/11/2026) · [cambios](CHANGELOG.md) |
| **Sistema** | Windows 10 y 11, 64 bits |
| **Instalador** | `Setup.exe` (6 MB) + `Setup-1.bin` (424 MB), en *Releases* |
| **Privacidad** | Todo corre en `127.0.0.1`; el instalador no trae claves |
| **Estado** | Compilado y probado sin instalar; ver [qué se probó](#qué-se-probó-de-la-116) |

## Inicio rápido

1. Descarga de *Releases* los dos archivos del instalador y déjalos en la misma carpeta.
2. Ejecuta `LetXinet-Suite-1.1.6-VariantB-Setup.exe` como administrador y deja marcada la casilla que configura los clientes de IA.
3. Reinicia Claude Code, Claude Desktop u OpenCode.
4. Pide algo como: «busca tesis peruanas sobre anemia infantil con `search` en `peru_fast`».
5. Si algo falla: menú Inicio → «Probar LetXinet Suite» y revisa [Solución de problemas](#solución-de-problemas).

## Novedades de la 1.1.6

- **Las tesis del lugar salen primero.** Si la consulta nombra una ciudad o región, V11 la envía a ALICIA junto con el tema y pone esos resultados al inicio.
- **`location` y `university` ya no reducen los resultados:** solo ordenan.
- **`batch_search` y `smart_search` tardan segundos, no minutos,** y `batch_search` ya aplica el filtro de pertinencia y une los duplicados.
- **V11 ya no se atasca con varias búsquedas a la vez:** cancela el trabajo vencido y corre como máximo 3 búsquedas simultáneas.
- **RENATI responde en segundos** (antes unos 30 s fijos).
- **Enlace directo al PDF** en los 5 primeros resultados, universidad según el repositorio y país correcto.
- **Los mapas vuelven a funcionar cuando el servidor principal de Overpass no responde:** se usan los servidores espejo.
- **`health_check` y `osm_health` dicen qué fuente o servicio falla,** y el Desktop avisa si una clave fue rechazada.

### Qué se probó de la 1.1.6

Consultas de la prueba del 09/11/2026, con `peru_fast` y `fastMode`:

| Prueba | 1.1.5 | 1.1.6 |
|---|---|---|
| `search`: del lugar en los 10 primeros (Chimbote, Huaraz, Arequipa) | 1, 0 y 0 | 10, 10 y 10 |
| `search` con `location` y `university` (Huaraz, Arequipa) | 0 y 3 resultados | 20 y 20 resultados |
| `search` con RENATI (`peru`, `latam`) | 22,6 a 25,4 s | 1,9 a 9,7 s |
| `batch_search`, 3 consultas, 60 resultados | 217 s, 7 duplicados | 11,4 s, 0 duplicados |
| `smart_search` | 84 s | 5,0 s |
| 8 `search` a la vez | atasco de 20 minutos | las 8 bien, 12 a 27 s en total |
| `find_nearby_places` (hospitales en Chimbote) | sin respuesta en 60 s | 16,7 s la primera vez |

Los tiempos dependen de ALICIA, que ese día respondió entre 1 y 9 s por consulta. Falta probar MarkItDown en un procesador sin SSE4.2 real, y OSRM (rutas) sigue sin responder desde la red de pruebas. El detalle está en [CHANGELOG.md](CHANGELOG.md).

## Contenido

- [Inicio rápido](#inicio-rápido) · [Novedades de la 1.1.6](#novedades-de-la-116)

1. [Cómo está armado](#cómo-está-armado)
2. [Requisitos](#requisitos)
3. [Instalar](#instalar)
4. [Servicios, puertos y direcciones](#servicios-puertos-y-direcciones)
5. [Herramientas de búsqueda académica y PDF (V11)](#herramientas-de-búsqueda-académica-y-pdf-v11)
6. [Fuentes académicas](#fuentes-académicas)
7. [Herramientas de mapas (OSM)](#herramientas-de-mapas-osm)
8. [Conversión de PDF a Markdown (MarkItDown)](#conversión-de-pdf-a-markdown-markitdown)
9. [Puentes MCP de la Suite](#puentes-mcp-de-la-suite)
10. [Addon Bridges: Word y LaTeX](#addon-bridges-word-y-latex)
11. [LetXinet Desktop HF](#letxinet-desktop-hf)
12. [Configurar Claude Code, Claude Desktop y OpenCode](#configurar-claude-code-claude-desktop-y-opencode)
13. [Skills](#skills)
14. [Comandos y accesos](#comandos-y-accesos)
15. [Configuración: LetXinet-Suite.env](#configuración-letxinet-suiteenv)
16. [Pruebas](#pruebas)
17. [Código fuente explicado](#código-fuente-explicado)
18. [Compilar](#compilar)
19. [Solución de problemas](#solución-de-problemas)
20. [Estructura del repositorio](#estructura-del-repositorio)
21. [Seguridad](#seguridad)
22. [Licencias](#licencias)

## Cómo está armado

```
 Claude Code · Claude Desktop · OpenCode
        │  MCP (stdio o HTTP)
        ▼
 ┌──────────────────────── Puentes ────────────────────────┐
 │ letxinet-v11 / letxinet-osm / letxinet-ambos             │
 │ letxinet-markitdown · letxinet-jobs · letxinet-gateway   │
 │ omni-word-mcp · latex-mcp-local   (Addon Bridges)        │
 └──────────────────────────────────────────────────────────┘
        │  HTTP en 127.0.0.1
        ▼
 MCP-V11-Local :4003 ──► 39 fuentes académicas, PDF, MinerU (opcional)
   └─ sidecar spaCy :4002 (apagado de fábrica)
 OSM-MCP :7082 ───────► Nominatim, Overpass, OSRM (OpenStreetMap)
 MarkItDown API :7860 ► PyMuPDF4LLM (PDF a Markdown, sin internet)
 LetXinet Desktop HF :43123 ► interfaz de chat, consola y gateway hacia los servicios
```

- Los tres servicios (V11, OSM y MarkItDown) corren como servicios de Windows con NSSM y arrancan con el equipo.
- LetXinet Desktop HF es una app de escritorio (Electron). Se abre a mano y su backend es el gateway del puerto 43123.
- Todo escucha solo en `127.0.0.1`: nada queda expuesto a la red.

## Requisitos

| Para | Qué hace falta |
|---|---|
| Instalar la Suite | Windows 10 u 11 x64, permisos de administrador y unos 3 GB libres. Node.js 22 viene incluido y se instala solo si falta |
| Clientes de IA | Claude Code (en Windows necesita Git for Windows), Claude Desktop u OpenCode, instalados desde sus sitios oficiales |
| Addon Bridges | LetXinet Suite instalada. Microsoft Word para las herramientas de Word. XeLaTeX y Biber (MiKTeX o TeX Live) para LaTeX |
| Claves (opcionales) | MinerU para OCR, tablas y fórmulas; CORE, Scopus, Semantic Scholar y SerpAPI para más fuentes; proveedores de IA para el chat del Desktop |

## Instalar

### LetXinet Suite
1. Descarga `LetXinet-Suite-1.1.6-VariantB-Setup.exe` y `LetXinet-Suite-1.1.6-VariantB-Setup-1.bin` desde *Releases* y déjalos en la misma carpeta.
2. Comprueba los hashes SHA-256 (también en `01_INSTALADORES/HASHES-SHA256-v1.1.6-VariantB.txt`):

   | Archivo | Tamaño | SHA-256 |
   |---|---|---|
   | `LetXinet-Suite-1.1.6-VariantB-Setup.exe` | 6 MB | `8ED9C6E8CBB041828457DAAF9DD0D610AEA14B36EFFF70A7A5CC2117BB1F6312` |
   | `LetXinet-Suite-1.1.6-VariantB-Setup-1.bin` | 424 MB | `CE27CA2CFD38F2243921328C0A6D116063C56F69A042D25DAE62B8FDC168CB26` |

   ```powershell
   Get-FileHash .\LetXinet-Suite-1.1.6-VariantB-Setup.exe, .\LetXinet-Suite-1.1.6-VariantB-Setup-1.bin -Algorithm SHA256
   ```
3. Ejecuta el `.exe` como administrador. El instalador:
   - instala Node.js si falta;
   - pide un correo de contacto opcional para OpenStreetMap (lo exige la política de Nominatim);
   - registra e inicia los tres servicios;
   - al final, si dejas marcada la casilla, configura Claude Code, Claude Desktop y OpenCode.
4. Carga tus claves con «Configurar API keys» del menú Inicio, o desde la pantalla de claves del Desktop.
5. Reinicia los clientes de IA.
6. Comprueba la instalación: menú Inicio → «Probar LetXinet Suite». El informe queda en el Escritorio.

**Actualizar desde una versión anterior:** ejecuta el instalador nuevo encima; no hace falta desinstalar. Conserva `LetXinet-Suite.env` con tus claves y solo agrega los ajustes nuevos.

**Instalación sin ventanas** (desde una consola como administrador):

```bat
LetXinet-Suite-1.1.6-VariantB-Setup.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG="instalar.log"
```

**Desinstalar:** menú Inicio → «Desinstalar LetXinet Suite». Quita el programa y los tres servicios; la configuración de `C:\ProgramData\LetXinet Suite` queda en el equipo.

### Addon Bridges (opcional)
Ejecuta `LetXinet-Addon-Bridges-v1.0.0.exe` después de la Suite. Se instala en `C:\Program Files\LetXinet Addon`, revisa los requisitos (Suite, Word, OpenCode y Node) y agrega los servidores de Word, LaTeX y el gateway a `opencode.json`. Antes guarda una copia `opencode.json.bak-<fecha>`, que se restaura al desinstalar.

## Servicios, puertos y direcciones

| Componente | Servicio de Windows | Puerto | Direcciones útiles |
|---|---|---|---|
| MCP-V11-Local | `LetXinetSuiteMCPV11` | 4003 | `/api/health`, `/api/mcp` (MCP JSON-RPC), `/metrics`, API REST en `/api/*` |
| Sidecar spaCy | (lo lanza V11) | 4002 | Interno. Apagado de fábrica (`SPACY_DISABLE=1`) |
| OSM-MCP | `LetXinetSuiteOSMMCP` | 7082 | `/mcp` (MCP por HTTP y SSE) |
| Métricas de OSM | (mismo servicio) | 9090 | Métricas Prometheus y estado |
| MarkItDown API | `LetXinetSuiteMarkitDown` | 7860 | `GET /` (estado), `POST /convert` |
| LetXinet Desktop HF | (app, no servicio) | 43123 | `/health`, `/api/mcp/tools`, `/api/mcp/call`, `/api/chat` |

Carpetas de la instalación:

| Qué | Dónde |
|---|---|
| Programa | `C:\Program Files\LetXinet Suite` |
| Configuración | `C:\ProgramData\LetXinet Suite\LetXinet-Suite.env` |
| Registros | `C:\ProgramData\LetXinet Suite\Logs` |
| Tareas largas del puente | `%LOCALAPPDATA%\LetXinet\jobs` |
| Addon Bridges | `C:\Program Files\LetXinet Addon` |

## Herramientas de búsqueda académica y PDF (V11)

Servidor MCP `letxinet-v11` (también dentro de `letxinet-ambos`). El asterisco marca los parámetros obligatorios.

### Búsqueda

| Herramienta | Qué hace | Parámetros |
|---|---|---|
| `search` | Una sola consulta en las fuentes elegidas, con filtro de pertinencia y lo local primero. Unos 2 a 10 s. Úsala por defecto | `query`*, `sources`, `maxResults`, `maxSources` (alias de `maxResults`), `yearStart`, `yearEnd`, `university`, `location`, `fastMode`, `resolverPdf`, `filterFalsePositives` |
| `batch_search` | Varias consultas en una llamada, con una sola lista sin duplicados, el mismo filtro de pertinencia y lo local primero. Desde la 1.1.6 tarda unos 3 a 12 s con `fastMode` | `queries`, `query`, `sources`, `maxResults`, `yearStart`, `yearEnd`, `university`, `location`, `fastMode`, `resolverPdf`, `filterFalsePositives` |
| `smart_search` | Genera variantes de la consulta (sinónimos, traducciones ES/EN/PT, términos más amplios o específicos), busca con todas y quita duplicados. Desde la 1.1.6 tarda unos 5 s con `fastMode` y avisa si alguna variante no respondió | `query`*, `sources`, `maxResults`, `yearStart`, `yearEnd`, `location`, `fastMode`, `filterFalsePositives` |
| `search_dblp` | Busca en DBLP (informática): publicaciones, autores y eventos, listo para BibTeX | `query`*, `maxResults` |
| `search_paperswithcode` | Papers con código, benchmarks, datasets y métodos | `query`*, `maxResults` |
| `search_conferences` | Papers de conferencias en OpenReview (ICLR, NeurIPS, ICML…) | `query`*, `maxResults` |
| `trending_papers` | Papers de IA del día en HuggingFace, con filtro opcional por tema | `query`, `maxResults` |

**Qué conviene, según las pruebas del 09/11/2026** (tres agentes con las mismas consultas, solas y combinadas con OSM; detalle en [`06_INFORMES-Y-PRUEBAS/pruebas-busqueda-2026-11-09.md`](06_INFORMES-Y-PRUEBAS/pruebas-busqueda-2026-11-09.md)):

| Forma de buscar | Tiempo mediano | Pertinentes en los 10 primeros |
|---|---|---|
| `search`, 1 consulta | 31 s (5 a 9 s con `peru_fast`) | 68 % |
| `batch_search` con 1 consulta | 77 s | 52 % |
| `batch_search` con 3 variantes | 95 s | 73 % |
| 3 `search` seguidas con las mismas 3 variantes, fusionadas | De 2 a 5 veces menos que `batch_search` | Más pertinentes que `batch_search` en 2 de 3 temas |

La tabla anterior es de la 1.1.5. Con la 1.1.6 cambió así (ver [qué se probó](#qué-se-probó-de-la-116)):

- **Usa `search` por defecto**, siempre con `sources`.
- **Para varias variantes** sirven tanto varias `search` seguidas como un `batch_search`: los dos aplican el mismo filtro y tardan segundos. `batch_search` entrega además una sola lista sin duplicados.
- **Varias llamadas a la vez ya no atascan V11:** corren 3 búsquedas a la vez y el resto espera turno. Si una espera más de 45 s, recibe «V11 está ocupado» y hay que reintentar.
- **Para un lugar**, escríbelo en la consulta («dengue Chimbote») o pásalo en `location`. Los trabajos del lugar salen primero y no se pierde ningún resultado.

Notas de uso:
- Indica siempre `sources`: sin fuentes, `search` consulta todas y tarda más.
- Para limitar resultados usa `maxResults`. `maxSources` es un alias desde la 1.1.5.
- `sources` acepta identificadores de fuente o grupos: `latam`, `global`, `tesis`, `iberoamerica`, `peru`, `peru_fast` o `all` (ver [Fuentes académicas](#fuentes-académicas)).
- `university` y `location` solo ordenan: ponen primero los resultados de esa institución o de ese lugar, sin quitar ninguno.
- `fastMode` salta el enriquecimiento lento de metadatos y la búsqueda del PDF directo.
- `resolverPdf`: los 5 primeros resultados traen el enlace directo al PDF en `pdfUrl` (y la página del repositorio en `handleUrl`). Va activado salvo en `fastMode`; se fuerza con `true` o se apaga con `false`. Puede sumar hasta 6 s.
- Si una fuente está caída o en pausa, `stats` (o `fuentesConError` en `batch_search`) dice cuál y por qué.
- `filterFalsePositives` descarta resultados que no contienen las palabras o conceptos de la consulta.

### Metadatos y PDF abiertos

| Herramienta | Qué hace | Parámetros |
|---|---|---|
| `fetch_metadata` | Metadatos completos de un paper por DOI, URL o título. Devuelve un puntaje de completitud, los campos agregados, el handle del repositorio y la URL del PDF | `doi`, `url`, `title` |
| `enrich_metadata` | Completa resumen, DOI, año, universidad, autores y PDF de una lista de papers con OpenAlex, Crossref, Semantic Scholar, DSpace 7 y la página del repositorio | `papers`* |
| `recover_metadata` | Recuperación profunda desde cualquier identificador: encadena OpenAlex, Crossref, Semantic Scholar, DSpace 7, la página web y ALICIA. Tope de 90 s | `doi`, `url`, `title` |
| `resolve_pdf` | Encuentra la URL final del PDF sin descargarlo, con la fuente y los pasos seguidos. Si un repositorio no entrega el PDF, explica por qué | `identifier`* |
| `download_pdf` | Obtiene la URL de descarga del PDF solo desde fuentes legales de acceso abierto: Unpaywall, CORE, Semantic Scholar, PMC, Europe PMC, DOI.org, OA.mg y repositorios institucionales | `url`, `doi` |

### Lectura y análisis de documentos

`source` acepta una URL, un DOI o una ruta local.

| Herramienta | Qué hace | Parámetros |
|---|---|---|
| `pdf_smart_summary` | Resumen compacto: resumen, métodos, resultados y conclusiones recortados a un presupuesto de caracteres. La mejor primera llamada para un PDF | `source`*, `maxTotalChars` |
| `read_pdf` | Texto del PDF como Markdown (MinerU, con OCR, tablas y fórmulas) o como texto plano, con límite de caracteres y rango de páginas | `source`*, `maxChars`, `pages`, `format` |
| `read_pdf_markdown` | PDF a Markdown que conserva títulos, tablas y listas. Gasta menos tokens que `read_pdf` | `source`*, `maxChars`, `pages` |
| `pdf_metadata` | Título, autor, número de páginas, fecha de creación y tamaño | `source`* |
| `pdf_sections` | Detecta las secciones de un paper: resumen, introducción, métodos, resultados, conclusiones, referencias… | `source`* |
| `extract_section` | Texto completo de una sección por nombre («metodología», «marco teórico», «results»…), sin límite de caracteres y con coincidencia aproximada en español e inglés | `source`*, `section`* |
| `pdf_citations` | Lista de referencias y citas, en estilo numérico [1] o autor-año | `source`* |
| `analyze_academic` | Análisis de tesis y artículos: tipo de documento, idioma, 22 tipos de sección y datos estadísticos (valores p, correlaciones, ANOVA, chi², regresiones, tamaños de muestra) | `source`* |
| `convert_document` | Convierte PDF, DOCX, PPTX, XLSX o imágenes a Markdown con MinerU: OCR en 109 idiomas, tablas y fórmulas en LaTeX. Si MinerU no responde, descarga el PDF y lo convierte en local | `source`*, `maxChars` |
| `batch_convert` | Convierte hasta 10 documentos en paralelo y devuelve un resumen de cada uno | `sources`*, `maxCharsPerDoc` |
| `extract_tables` | Todas las tablas del documento en HTML o Markdown, incluidas tablas rotadas, partidas entre páginas o con celdas combinadas | `source`*, `format` |
| `extract_formulas` | Todas las fórmulas matemáticas en LaTeX | `source`* |

`convert_document`, `batch_convert`, `extract_tables`, `extract_formulas` y el modo Markdown de `read_pdf` usan MinerU y necesitan `MINERU_API_KEY`.

### Estado y ayuda

| Herramienta | Qué hace | Parámetros |
|---|---|---|
| `list_sources` | Lista las fuentes con su identificador y descripción | — |
| `health_check` | Conectividad con cada fuente, latencia y claves configuradas | — |
| `coverage_report` | Cobertura por país y fuente: repositorios activos y caídos, porcentaje de resúmenes y tiempo de respuesta | `use_cache`, `format` |
| `help` | Ayuda y ejemplos de una herramienta, de una fuente o de todo (`all`) | `topic` |

### API REST de V11
Además de MCP, V11 responde por HTTP en `http://127.0.0.1:4003`:

| Método y ruta | Qué hace |
|---|---|
| `GET /api/health`, `GET /health` | Estado del servicio |
| `GET /health/gate`, `GET /health/openalex` | Estado de los límites por proveedor y de OpenAlex |
| `GET /metrics` | Métricas |
| `POST /api/mcp` | MCP JSON-RPC (`tools/list`, `tools/call`) |
| `POST /api/search` | Búsqueda |
| `POST /api/metadata/enrich`, `POST /api/metadata/fetch` | Metadatos |
| `POST /api/pdf/download` | URL del PDF abierto |
| `POST /api/pdf/read`, `/metadata`, `/sections`, `/citations`, `/analyze`, `/markdown`, `/summary` | Lectura de PDF |
| `GET /api/sources` | Catálogo de fuentes |
| `POST /admin/reload-profiles`, `GET /admin/profile` | Recarga y consulta de perfiles de búsqueda |

## Fuentes académicas

V11 consulta 39 fuentes.

| Grupo | Fuentes |
|---|---|
| `global` | Semantic Scholar, OpenAlex, PubMed, Crossref, DOAJ, Zenodo, OpenAIRE, CORE |
| `latam` | ALICIA (CONCYTEC), RENATI (SUNEDU), La Referencia, CONAHCyT, UNAM, ANID, Oasisbr, BDTD, SNRD, MinCiencias, RRAAE, KIMUK (Costa Rica), Timbó (Uruguay), REDICCES (El Salvador), SciELO, Redalyc |
| `iberoamerica` | `latam` más Recolecta (España) |
| `tesis` | ALICIA, RENATI, BDTD, RRAAE, La Referencia, SNRD, MinCiencias, Recolecta, KIMUK, Timbó, REDICCES |
| `peru` | RENATI y La Referencia (Perú) |
| `peru_fast` | ALICIA y La Referencia (Perú): respuesta en unos 3 a 5 segundos |
| Por país | La Referencia de Perú, Brasil, Ecuador, México, Argentina, Colombia y Chile |
| Especializadas | arXiv, Scopus (clave), Google Scholar (SerpAPI, clave), DBLP, Papers With Code, HuggingFace Daily Papers, OpenReview |

- **Pertinencia:** desde la 1.1.3, RENATI, ALICIA y La Referencia descartan resultados que no tratan el tema de la consulta.
- **Fuentes desactivadas:** Sci-Hub y WeLib, por riesgo legal.
- **Direcciones internas bloqueadas:** ninguna herramienta lee direcciones internas, como `127.0.0.1`, la red local o `169.254.169.254`.

## Herramientas de mapas (OSM)

Servidor MCP `letxinet-osm` (también dentro de `letxinet-ambos`). Usa Nominatim, Overpass y OSRM de OpenStreetMap; si Overpass falla, prueba servidores espejo.

### Direcciones y coordenadas

| Herramienta | Qué hace |
|---|---|
| `geocode_address` | Dirección, lugar o coordenadas militares (MGRS, UTM, DMS) a latitud y longitud |
| `reverse_geocode` | Coordenadas a dirección (`latitude`, `longitude`) |
| `geo_distance` | Distancia entre dos puntos (`from`, `to`) |
| `centroid_points` | Centroide de varios puntos (`points`) |
| `bbox_from_points` | Rectángulo que contiene varios puntos (`points`) |
| `polygon_from_admin` | Polígono GeoJSON del límite de un área administrativa por nombre (`name`*, `admin_level`* de 1 a 11, `lang`) |
| `polyline_encode` | Lista de coordenadas a polyline (`points`) |
| `polyline_decode` | Polyline a lista de coordenadas (`polyline`) |

### Lugares y zonas

| Herramienta | Qué hace |
|---|---|
| `find_nearby_places` | Lugares de interés cerca de un punto |
| `find_nearby_batch` | Hasta 10 búsquedas de lugares cercanos en paralelo (3 a la vez) |
| `explore_area` | Características principales de una zona (`latitude`, `longitude`, `radius` en metros) |
| `analyze_neighborhood` | Evalúa un barrio para vivir (`latitude`, `longitude`, `name`) |
| `find_schools_nearby` | Colegios cercanos (`latitude`, `longitude`, `radius`, `limit`) |
| `find_parking_facilities` | Estacionamientos (`latitude`, `longitude`, `radius`, `type`, `include_private`, `limit`) |
| `find_charging_stations` | Estaciones de carga para autos eléctricos (`latitude`, `longitude`, `radius`, `limit`) |
| `osm_query_bbox` | Elementos de OpenStreetMap dentro de un rectángulo con filtros de etiquetas, por ejemplo `{"amenity": "restaurant", "cuisine": "*"}` |
| `filter_tags` | Filtra elementos de OSM por etiquetas (`elements`, `tags`) |
| `sort_by_distance` | Ordena elementos por distancia a un punto (`elements`, `ref`) |

### Rutas

| Herramienta | Qué hace |
|---|---|
| `route_fetch` | Ruta entre dos puntos en auto, bicicleta o a pie (`start`, `end`, `mode`) |
| `get_route_directions` | Indicaciones paso a paso (`start_lat`, `start_lon`, `end_lat`, `end_lon`, `mode`) |
| `route_sample` | Puntos a intervalos regulares a lo largo de una ruta (`polyline`, `interval` en metros) |
| `analyze_commute` | Compara opciones de traslado entre casa y trabajo (`home`, `work`) |
| `suggest_meeting_point` | Punto de encuentro para varias ubicaciones (`locations`, `radius`, `category`) |
| `enrich_emissions` | Agrega emisiones a cada modo de transporte (`options`) |

### Mapas y estado

| Herramienta | Qué hace |
|---|---|
| `get_map_image` | Imagen del mapa de un lugar (`latitude`, `longitude`, `zoom` de 1 a 19) |
| `tile_cache` | Caché de teselas: `list`, `get` o `stats` (`action`, `x`, `y`, `zoom`) |
| `osm_health` | Conectividad con Nominatim, OSRM y Overpass |
| `get_version` | Versión del servidor |

## Conversión de PDF a Markdown (MarkItDown)

MarkItDown convierte PDF a Markdown en el propio equipo, sin internet ni claves, con PyMuPDF4LLM.

**Servidor MCP `letxinet-markitdown`:**

| Herramienta | Qué hace | Parámetros |
|---|---|---|
| `markitdown_convert` | Convierte un PDF local a Markdown estructurado | `path`, `pages`, `maxChars` |
| `markitdown_health` | Estado del servicio MarkItDown | — |

**API REST** en `http://127.0.0.1:7860`:
- `GET /`: estado (`"status": "online"`).
- `POST /convert`: form-data con `file` (PDF) y `pages` opcional. `pages` acepta `all`, `1-5`, `first5`, `last3`, `1,3,5` o `7`.

```powershell
curl.exe -F "file=@C:\ruta\tesis.pdf" -F "pages=first5" http://127.0.0.1:7860/convert
```

## Puentes MCP de la Suite

Los puentes están en `C:\Program Files\LetXinet Suite\bin\mcp\` y hablan MCP por stdio, que es lo que aceptan todos los clientes.

### `letxinet-mcp-bridge.cjs`
Conecta con V11 (`http://127.0.0.1:4003/api/mcp`) y OSM (`http://127.0.0.1:7082/mcp`) sin necesitar la app Desktop. Si un servicio no responde, sigue ofreciendo las herramientas del otro y la llamada fallida devuelve un error claro.

| Variable | Valores |
|---|---|
| `LETXINET_SELECCION` | `ambos` (por defecto), `v11` u `osm` |
| `LETXINET_V11_URL`, `LETXINET_OSM_URL` | Direcciones de los servicios |
| `LETXINET_TIMEOUT_MS` | Tiempo máximo por llamada (por defecto 300000) |

El configurador lo registra como `letxinet-v11`, `letxinet-osm` o `letxinet-ambos`, según el modo.

### `letxinet-jobs-bridge.cjs` (servidor `letxinet-jobs`)
Sirve para tareas largas que superarían el tiempo de espera del cliente. Las lanza en segundo plano y devuelve un `task_id` para consultar después.

**Corregido en la 1.1.5:**
- **Tiempo de las tareas:** en la 1.1.3 y la 1.1.4 cada tarea se presentaba ante V11 como OpenCode (`User-Agent: opencode/1.0`), y V11 la cortaba a los 114 s; en las pruebas, 7 de 8 búsquedas largas por el puente se cortaron así. Ahora se presenta como `letxinet-jobs-bridge/1.1.5` y V11 le da hasta 360 s en `batch_search` y 300 s en `smart_search`.
- **Estado de las tareas:** `gateway_poll` responde `PENDING`, `DONE`, `ERROR` (con el motivo), `LOST` (el proceso terminó sin resultado), `NOT_FOUND` o `INVALID`. Los cuatro últimos llevan `isError`.
- **Validación y limpieza:** valida el `task_id` y borra las tareas de más de 24 h.

Con una Suite 1.1.3 o 1.1.4, llama `batch_search` y `smart_search` directo desde Claude Code o Claude Desktop. `gateway_call` funciona bien para resumir PDF largos en todas las versiones.

| Herramienta | Qué hace | Parámetros |
|---|---|---|
| `letxipu_local_call` | Llama a una herramienta de V11 local. `search` responde al momento; `smart_search` y `batch_search` se lanzan como tareas | `tool`, `arguments` |
| `gateway_call` | Llama a cualquier herramienta del gateway del Desktop (necesita el Desktop abierto). Las largas (`extract_tables`, `read_pdf`, `batch_search`, `pdf_smart_summary`, `analyze_academic`, `extract_formulas`, `extract_section`, `read_pdf_markdown`, `batch_convert`, `search_conferences`) se lanzan como tareas | `tool`, `arguments` |
| `gateway_poll` | Estado y resultado de una tarea. Consultar cada 30 a 60 s | `task_id` |
| `gateway_list_tools` | Herramientas disponibles en el gateway | — |
| `gateway_chat` | Chat del gateway (`/api/chat`) con ejecución de herramientas | `message`, `model`, `autoExecuteTools`, `executionMode` |

Variables: `GATEWAY_URL` (por defecto `http://127.0.0.1:43123`), `LETXIPU_LOCAL_URL` (`http://127.0.0.1:4003`) y `JOBS_DIR`.

## Addon Bridges: Word y LaTeX

Complemento opcional (`LetXinet-Addon-Bridges-v1.0.0.exe`) con tres piezas que la Suite no trae. Su código fuente se distribuye aparte (zip de 152 MB) y su script de Inno Setup está en `07_DOCUMENTACION-ORIGINAL/LetXinet-Addon-Bridges.iss`.

| Pieza | Carpeta | Qué hace |
|---|---|---|
| `mcp-bridge.cjs` (servidor `letxinet-gateway`) | `mcp-bridge\` | Expone por stdio las herramientas del gateway del Desktop (`/api/mcp/tools` y `/api/mcp/call`). Variables: `LETXINET_SUITE_URL` y `LETXINET_SERVER_SELECTION` (`both`, `v11` u `osm`) |
| `omni-word-mcp` | `omni-word-mcp\` | Crea y edita documentos de Word con Python y automatización COM |
| `latex-mcp-local` | `latex-mcp-local\` | Crea proyectos LaTeX y los compila a PDF con XeLaTeX y Biber |

Scripts del addon (`bin\`): `check-requirements.ps1` revisa Suite, Word, OpenCode y Node; `patch-opencode-config.ps1` escribe `opencode.json` con rutas absolutas; `restore-config.ps1` restaura la copia al desinstalar.

### Herramientas de Word (`omni-word-mcp`)

| Grupo | Herramientas |
|---|---|
| Documentos | `create_document`, `copy_document`, `get_document_info`, `get_document_text`, `get_document_outline`, `list_available_documents`, `convert_to_pdf` |
| Contenido | `add_heading`, `add_paragraph`, `add_table`, `add_picture`, `add_page_break`, `delete_paragraph`, `search_and_replace`, `find_text_in_document`, `get_paragraph_text_from_document` |
| Formato | `create_custom_style`, `format_text`, `format_table` |
| Notas | `add_footnote_to_document`, `add_endnote_to_document`, `customize_footnote_style` |
| Protección | `protect_document`, `unprotect_document` |

### Herramientas de LaTeX (`latex-mcp-local`)

| Herramienta | Qué hace |
|---|---|
| `generate_and_compile_latex` | Crea el proyecto (`main.tex`, secciones y `references.bib`) y lo compila a PDF. Descarga antes las imágenes referenciadas por URL |
| `list_projects` | Lista los proyectos compilados con fecha, estado del PDF, tamaño y secciones |
| `read_project` | Lee todos los archivos de un proyecto |
| `patch_section` | Reemplaza una sola sección y recompila |
| `edit_section` | Buscar y reemplazar exacto dentro de una sección, y recompila |
| `expand_section` | Reemplaza una sección por una versión más extensa y recompila |
| `shrink_section` | Reemplaza una sección por una versión más corta y recompila |
| `extract_section` | Saca una sección como `.tex` independiente y compilable |
| `restructure_project` | Agrega, quita o renombra secciones y actualiza `main.tex` |

## LetXinet Desktop HF

App de escritorio (Electron y React) con su backend Express en el puerto 43123.

### Arranque
- Al abrirse muestra «Iniciando LetXinet Desktop...» y espera a su backend hasta 10 minutos. El tiempo se cambia con `LETXIPU_BACKEND_TIMEOUT_MS`.
- Si V11 ya responde en el puerto 4003, lo usa; si no, lo arranca.
- Si el backend no arranca, el mensaje indica qué registros revisar: `backend.log` y `letxipu-desktop-main.log`.

### Pantallas
| Pantalla | Para qué |
|---|---|
| Chat con agente | Conversa con un modelo de IA que usa las herramientas de la Suite y acepta archivos adjuntos |
| Historial de chats | Guarda, renombra y borra conversaciones |
| Consola | Ejecuta cualquier herramienta a mano con sus parámetros y ve la respuesta |
| Catálogo de fuentes | Fuentes de V11 y selección manual, con el parámetro `sources: [...]` listo para copiar |
| Galería de skills | Skills disponibles |
| Herramientas activas y para adjuntos | Qué herramientas se usan y cuáles sirven para cada tipo de archivo |
| Proveedores y modelos | OpenRouter, NVIDIA, Nebius, DeepSeek, OpenCode y proveedores o modelos propios; sincroniza los catálogos |
| Claves API y variables del sistema | Carga claves, edita la configuración y reinicia los servicios para aplicar los cambios |

También tiene tema claro y oscuro, varios idiomas, contador de tokens y vista para teléfono.

### API del gateway (`http://127.0.0.1:43123`)
| Método y ruta | Qué hace |
|---|---|
| `GET /health` | Estado |
| `GET /api/mcp/tools?server=v11\|osm\|juntos` | Herramientas disponibles, filtradas por servidor |
| `POST /api/mcp/call` | Ejecuta una herramienta |
| `POST /api/chat` | Chat con ejecución de herramientas |
| `GET/POST /api/keys`, `POST /api/keys/restart-services` | Claves y reinicio de servicios |
| `GET/POST /api/system-variables` | Variables de configuración |
| `GET /api/providers`, `GET /api/providers/:id/models`, `GET /api/detect-provider`, `ALL /api/models/sync` | Proveedores y modelos de IA |
| `POST /api/custom-providers`, `GET/POST /api/custom-models` | Proveedores y modelos propios |
| `GET/POST/PUT/DELETE /api/chats…` | Conversaciones guardadas |
| `POST /api/attachment/tools` | Herramientas que sirven para un adjunto |
| `/api/search`, `/api/metadata/*`, `/api/pdf/*`, `/api/sources` | Las mismas rutas de búsqueda y PDF que V11 |

## Configurar Claude Code, Claude Desktop y OpenCode

El instalador corre el configurador al terminar. Para repetirlo o cambiar de modo: menú Inicio → «Configurar Claude Code, Claude Desktop y OpenCode», o:

```bat
"C:\Program Files\LetXinet Suite\bin\configurar-clientes.cmd" --modo juntos
```

| Opción | Qué hace |
|---|---|
| `--modo separados` | Por defecto. Registra `letxinet-v11` y `letxinet-osm` por separado, más `letxinet-markitdown` y `letxinet-jobs` |
| `--modo juntos` | Un solo servidor `letxinet-ambos` (V11 y OSM), más `letxinet-markitdown` y `letxinet-jobs` |
| `--modo ambos` | Los dos estilos a la vez |
| `--clientes claude-code,claude-desktop,opencode` | Elige los clientes. Sin esta opción configura los que encuentre instalados |
| `--silencioso` | No hace preguntas |
| `--sin-skills` | No copia los skills |
| `--mantener-addon` | En Claude Desktop conserva `letxinet-gateway` y `markitdown-api` del Addon Bridges. Sin esta opción se reemplazan por los servidores de la Suite, que no dependen del Desktop abierto |

Antes de cambiar cada archivo guarda una copia `.bak-letxinet-<fecha>`, y solo toca los servidores de LetXinet. En Claude Code también fija `MCP_TOOL_TIMEOUT` para que las herramientas largas no se corten.

## Skills

| Para | Dónde | Cuáles |
|---|---|---|
| Claude Code | `bin\clientes\skills\` | `letxinet-investigacion-academica` (tesis, antecedentes, verificación de referencias y DOI, lectura de PDF) y `letxinet-geo-academico` (investigación de un lugar con respaldo académico y mapas) |
| OpenCode | `bin\clientes\opencode-skills\` (62) | Ver la tabla siguiente |

| Familia | Cantidad | Ejemplos |
|---|---|---|
| `letxinet-*` | 2 | Skill maestra y buenas prácticas de búsqueda |
| `gateway-*` | 15 | Tesis peruanas, revisión PRISMA, PubMed cáncer, citas en OpenAlex, SciELO, Zenodo, preprints |
| `cross-*` | 13 | Revisión de literatura georreferenciada, PRISMA en medicina basada en evidencia, patentes, coordenadas MGRS, comparativo de universidades |
| `osm-*` | 14 | Análisis de traslados, colegios, estacionamientos, polígonos administrativos, comparación de barrios |
| `markitdown-*` | 5 | Tablas, fórmulas, rangos de páginas, resumen por lotes |
| `word-*` | 8 | Plantillas, notas al pie, estilos, auditoría de documentos |
| `triple-*` y `quad-*` | 5 | Flujos que combinan búsqueda, mapas, PDF y Word en un solo informe |

## Comandos y accesos

### Menú Inicio
| Acceso | Qué hace |
|---|---|
| LetXinet Desktop HF | Abre la app (también en el Escritorio) |
| Configurar API keys | Asistente para cargar claves en el `.env` |
| Editar LetXinet-Suite.env | Abre la configuración en el Bloc de notas |
| Ver logs centralizados | Abre la carpeta de registros |
| Reiniciar servicios del Suite | Reinicia OSM, MarkItDown y V11 |
| Detener servicios del Suite | Detiene los tres servicios sin desinstalarlos |
| Configurar Claude Code, Claude Desktop y OpenCode | Corre el configurador de clientes |
| Probar LetXinet Suite | Harness de pruebas con informe en el Escritorio |
| Desinstalar LetXinet Suite | Quita la Suite y sus servicios |

### Servicios (en una consola como administrador)
```bat
"C:\Program Files\LetXinet Suite\bin\nssm.exe" restart LetXinetSuiteMCPV11
"C:\Program Files\LetXinet Suite\bin\nssm.exe" restart LetXinetSuiteOSMMCP
"C:\Program Files\LetXinet Suite\bin\nssm.exe" restart LetXinetSuiteMarkitDown
sc query LetXinetSuiteMCPV11
```

### Comprobar y llamar a los servicios (PowerShell)
```powershell
Invoke-RestMethod http://127.0.0.1:4003/api/health
Invoke-RestMethod http://127.0.0.1:7860/

# Llamar una herramienta de V11 por MCP JSON-RPC
$cuerpo = @{ jsonrpc = '2.0'; id = 1; method = 'tools/call'
  params = @{ name = 'search'; arguments = @{ query = 'anemia infantil'; sources = @('peru_fast') } } } | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4003/api/mcp -ContentType 'application/json' -Body $cuerpo
```

### Scripts de la instalación
| Script | Qué hace |
|---|---|
| `register-services.cmd` | Registra los tres servicios con NSSM y los inicia (lo corre el instalador) |
| `restart-suite.cmd`, `uninstall-services.cmd` | Reinicia o detiene los servicios |
| `run-v11.cmd`, `run-osm.cmd`, `run-md.cmd` | Punto de entrada de cada servicio para NSSM |
| `bin\start-*.cmd` | Lanzadores de cada componente; cargan el `.env` con `suite-env-loader.cmd` |
| `bin\configure-keys.cmd`, `bin\set-env-key.ps1` | Asistente de claves y escritura de una clave en el `.env` |
| `bin\actualizar-config.ps1` | Actualiza un `.env` existente al instalar una versión nueva, sin tocar tus claves |
| `bin\pruebas\probar-letxinet.cmd`, `verificar-instalacion.ps1` | Pruebas de la instalación |

### Scripts de mantenimiento (`04_SCRIPTS-MANTENIMIENTO`)
| Script | Qué hace |
|---|---|
| `desactivar-spacy.cmd`, `reactivar-spacy.cmd` | Apaga o enciende el sidecar spaCy de V11 y reinicia el servicio |
| `limpiar-logs-letxinet.cmd` | Borra los registros rotados y las copias `.env.backup`; no toca los registros activos |
| `verificar-instalacion.ps1` | Revisión rápida de servicios y puertos |
| `arreglo-1.1.3\arreglar-letxinet.cmd` | Arregla una 1.1.3: copia `msvcp140.dll` y sube a 10 minutos la espera del Desktop |
| `arreglo-2-markitdown\arreglar-markitdown.cmd` | MarkItDown en procesadores sin SSE4.2: cambia numpy 2.5.1 por 2.3.5 y guarda el original |
| `harness\probar-letxinet.cmd` | Harness rápido |
| `harness\pool\ejecutar-pool.cmd` | Pool de pruebas completas con comparativo frente a IA |

## Configuración: LetXinet-Suite.env

Archivo: `C:\ProgramData\LetXinet Suite\LetXinet-Suite.env`. La reinstalación lo conserva. Después de cambiarlo, reinicia el servicio afectado. Plantillas con todas las variables y las claves vacías: `03_CONFIG-CLAUDE-CODE-OPENCODE/LetXinet-Suite.env.ejemplo` y `02_CODIGO-FUENTE/instalador/shared-env/LetXinet-Suite.env`.

| Grupo | Variables principales |
|---|---|
| Puertos | `MCP_V11_PORT=4003`, `SPACY_PORT=4002`, `OSM_MCP_PORT=7082`, `OSM_METRICS_PORT=9090`, `MARKITDOWN_API_PORT=7860`, `DESKTOP_PORT=43123` |
| Modo del Desktop | `DESKTOP_ENDPOINT_MODE`: `local_only` (de fábrica), `auto`, `remote_only` o `hf_only` |
| OpenStreetMap | `OSM_USER_AGENT` (con el contacto que pide Nominatim), `NOMINATIM_URL`, `OVERPASS_URL`, `OVERPASS_FALLBACK_URLS` |
| PDF abiertos | `UNPAYWALL_EMAIL` (correo real, lo pide Unpaywall), `UNPAYWALL_BASE_URL`, `DOI_RESOLVER_URL`, `SCIHUB_MIRRORS` (vacío: desactivado) |
| Extracción | `DOC_EXTRACTOR_MODE=auto`, `ALLOW_REMOTE_EXTRACTION`, `MARKITDOWN_ENABLED`, `MARKITDOWN_API_URL`, `EXTRACTOR_TIMEOUT_MS`, `EXTRACTOR_MAX_MB`, `MAX_BATCH_CONCURRENCY` |
| Tiempos | `PROVIDER_TIMEOUT_MS`, `PROVIDER_GATE_TTL_MS`, `RENATI_ATTEMPT_TIMEOUT_MS`, `MINERU_TIMEOUT`, `OAI_MAXPAGES` |
| spaCy | `SPACY_DISABLE=1` (apagado), `SPACY_MODEL=es_core_news_sm` |
| Claves académicas | `MINERU_API_KEY`, `CORE_API_KEY`, `SCOPUS_API_KEY`, `SEMANTIC_SCHOLAR_API_KEY`, `SERP_API_KEY` y `SERPAPI_KEY`, `HF_TOKEN`, `REDALYC_TOKEN`, `OPENALEX_MAILTO` |
| Claves de IA | `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, `NVIDIA_API_KEY`, `OPENCODE_API_KEY`, `NEBIUS_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY` |
| Registros | `LOG_LEVEL=info`, `SUITE_LOG_DIR` |
| Desktop | `LETXIPU_BACKEND_TIMEOUT_MS` (espera del backend), `LETXINET_BIND_HOST` (de fábrica `127.0.0.1`), `BUILD_VARIANT=public` |

## Pruebas

### Harness rápido: «Probar LetXinet Suite»
`bin\pruebas\probar-letxinet.ps1` revisa:
- servicios y puertos;
- respuesta de V11, OSM y MarkItDown;
- una conversión real de PDF a Markdown;
- Visual C++ (`msvcp140.dll`) y cuánto espera el Desktop a su backend;
- la configuración de Claude Code: servidores, `MCP_TOOL_TIMEOUT` y skills.

Deja un informe en el Escritorio. Cada punto sale como OK, AVISO o FALLA.

### Pool de pruebas completas
`04_SCRIPTS-MANTENIMIENTO/harness/pool/ejecutar-pool.cmd` corre pruebas por módulo y genera `informe-pool.md`:

| Prueba | Qué revisa |
|---|---|
| `h01-servicios` | Servicios y puertos |
| `h02-v11-herramientas` | Las 28 herramientas de V11 |
| `h03-fuentes` | Cada fuente académica |
| `h04-osm-herramientas` | Las herramientas de OSM |
| `h05-markitdown` | Conversión de PDF |
| `h06-puentes` | Puentes MCP |
| `h07-clientes` | Configuración de los clientes de IA |
| `h08-gateway` | Gateway del Desktop |
| `h09-rendimiento` | Tiempos de respuesta |
| `h10-seguridad` | Puertos solo locales, que no haya claves en los archivos instalados y bloqueo de direcciones internas |
| `h11-benchmark-letxinet` | Comparativo de resultados frente a IA |
| `verificar-referencias` | Que las referencias encontradas existan |

Los archivos de prueba (PDF, DOCX y XLSX) están en `harness/pool/fixtures`.

## Código fuente explicado

### `02_CODIGO-FUENTE/mcp-v11-local`: búsqueda académica y PDF (TypeScript)

| Ruta | Qué contiene |
|---|---|
| `src/server.ts` | Servidor Express: monta las rutas, el estado, las métricas y los perfiles. Escucha en `127.0.0.1:4003` |
| `src/routes/mcp.ts` | Definición de las 28 herramientas MCP y el despachador JSON-RPC. Antes de ejecutar, revisa `source`, `url`, `identifier` y `sources` para bloquear direcciones internas |
| `src/routes/search.ts` | Orquesta la búsqueda: expande grupos de fuentes, llama a los proveedores en paralelo, quita duplicados y ordena |
| `src/routes/sources.ts` | Catálogo de las 39 fuentes y sus grupos |
| `src/routes/metadata.ts` | `fetch_metadata` y `enrich_metadata`; usa Crossref si OpenAlex no responde |
| `src/routes/pdf.ts`, `src/routes/pdf-reader.ts` | Descarga de PDF abiertos y lectura: texto, secciones, citas, análisis, Markdown y resumen |
| `src/providers/` | Un archivo por fuente o familia: `openalex`, `semantic-scholar`, `pubmed`, `arxiv`, `scopus`, `dblp`, `openreview`, `huggingface`, `paperswithcode`, `global-academic` (Crossref, DOAJ, Zenodo, OpenAIRE, CORE…), `latam-repositories` (ALICIA, RENATI, La Referencia y repositorios nacionales), `oai-pmh` (cosecha OAI-PMH genérica) |
| `src/providers/base.ts` | Base común de los proveedores: `fetchWithTimeout` con plazo total, que incluye la espera en cola y la lectura de la respuesta |
| `src/providers/pdf-resolver.ts`, `pdf-processor.ts` | Encuentra el PDF abierto y lo procesa |
| `src/providers/extraction-router.ts` | Decide cómo convertir cada documento: MinerU, MarkItDown local o lectura directa |
| `src/providers/mineru-client.ts`, `markitdown-client.ts` | Clientes de MinerU (nube) y de MarkItDown (local) |
| `src/scraping/` | Lectura de páginas de repositorios: DSpace, handles, PMC, extracción de metadatos HTML y descargas con reintentos |
| `src/utils/url-segura.ts` | Bloquea direcciones internas: normaliza la IP, resuelve el DNS y valida cada redirección |
| `src/utils/inter-process-provider-limiter.ts`, `inter-process-rate-limiter.ts`, `openalex-throttle.ts` | Límites de velocidad por proveedor y por dominio, compartidos entre procesos |
| `src/utils/reranking.ts`, `pertinencia-repositorios.ts` | Ordena por relevancia y descarta resultados que no tratan el tema |
| `src/utils/osm-geocoder.ts` | Ubica universidades e instituciones en el mapa |
| `src/utils/tool-timeouts.ts`, `search-limits.ts` | Tiempos máximos por herramienta y límites de resultados |
| `src/utils/cache.ts`, `metrics.ts`, `logger.ts`, `validators.ts`, `profile-loader.ts` | Caché, métricas, registros, validación de parámetros y perfiles de búsqueda |
| `src/config/` | Sinónimos académicos para `smart_search`, palabras clave por país, ciudades y regiones, palabras vacías, niveles de universidades y perfiles (`global`, `peru`) |
| `src/data/` | Instituciones de ALICIA, prefijos de handles, coordenadas de universidades peruanas y dominios académicos |
| `src/python/spacy_server.py` | Sidecar de spaCy (Flask, puerto 4002) para reconocer entidades. Apagado de fábrica |
| `tests/`, `scripts/` | Pruebas y scripts de pools de pruebas |

Se compila con `tsc` y se empaqueta como `.exe` con yao-pkg. **El servicio ejecuta el código que lleva dentro el `.exe`, no la carpeta `dist`:** cualquier cambio requiere volver a generar el `.exe`.

### `02_CODIGO-FUENTE/osm-mcp`: mapas y rutas (Go)

| Ruta | Qué contiene |
|---|---|
| `cmd/osmmcp/main.go` | Punto de entrada y opciones de línea de comandos: `--enable-http`, `--http-only`, `--http-addr :7082`, `--monitoring-addr :9090`, `--user-agent`, `--debug`, límites de Nominatim, Overpass y OSRM |
| `pkg/server/` | Servidor MCP, transporte HTTP y SSE, autenticación opcional y límites de velocidad |
| `pkg/tools/` | Las 28 herramientas, agrupadas por archivo: `geocode`, `places`, `find_nearby_batch`, `explore`, `neighborhood`, `schools`, `parking`, `specialized_ev`, `routes`, `route_tools`, `commute`, `polygon_tools`, `polyline_tools`, `geo_tools`, `osm_query_tools`, `map_image`, `tile_cache`, `osm_health_tool`. `registry.go` las registra |
| `pkg/osm/` | Clientes de Nominatim, Overpass y OSRM, límites de velocidad, cachés y `overpass_fallback.go` (servidores espejo) |
| `pkg/coords/` | Conversión de coordenadas MGRS, UTM y DMS |
| `pkg/core/` | HTTP, OSRM, teselas, validación y fábrica de herramientas |
| `pkg/cache/`, `pkg/geo/` | Caché de teselas y cálculos geográficos (haversine) |
| `pkg/monitoring/`, `pkg/tracing/` | Métricas Prometheus, estado y trazas OpenTelemetry |
| `vendor/` | Dependencias de Go incluidas, para compilar sin internet |

Se compila con `go build` (Go 1.24 o superior).

### `02_CODIGO-FUENTE/markitdown-api`: PDF a Markdown (Python)

| Ruta | Qué contiene |
|---|---|
| `app.py` | API FastAPI: `GET /` (estado) y `POST /convert`, con selección de páginas |
| `mcp-adapter/markitdown-mcp.js` | Servidor MCP por stdio con `markitdown_convert` y `markitdown_health` |
| `requirements.txt` | Dependencias: FastAPI, uvicorn y PyMuPDF4LLM |
| `start-markitdown-api.cmd`, `Dockerfile` | Arranque local y en contenedor |

No se compila. Corre con el Python 3.12 embebido en la Suite, junto con `msvcp140.dll` de `runtime-extra`.

### `02_CODIGO-FUENTE/desktop-hf`: app de escritorio y gateway (Electron, React, Node)

| Ruta | Qué contiene |
|---|---|
| `electron/main.cjs` | Proceso principal: ventana «Iniciando...», arranque del backend, espera configurable y arranque de V11 si no responde |
| `electron/preload.cjs` | Puente seguro entre la ventana y Electron |
| `server.ts` | Backend Express (se compila a `dist/server.cjs` con esbuild): gateway MCP, chat, claves, variables, proveedores de IA, historial de chats y rutas de búsqueda y PDF. Escucha en `127.0.0.1:43123` |
| `src/App.tsx`, `src/components/` | Interfaz React: `AgentChat`, `ChatSidebar`, `ConsolePlayground`, `SourcesCatalog`, `SkillsGallery`, `ActiveToolsList`, `AttachmentExtraToolsPanel`, `ProvidersSyncPanel`, `ApiKeysConfig`, `SystemVariablesConfig`, navegación para teléfono y tema |
| `src/lib/` | Idiomas (`i18n.ts`), catálogo de proveedores, modelos propios, historial de chats, traducción de nombres de herramientas, matriz de adjuntos y conteo de tokens |
| `data/*_models.json` | Catálogos de modelos de OpenRouter, NVIDIA, Nebius, DeepSeek y OpenCode |
| `scripts/` | `apply-variant.cjs` (variante pública o privada), `copy-deps.cjs`, `install-deps.cjs` |
| `vite.config.ts`, `index.html`, `public/` | Compilación de la interfaz con Vite |

### `02_CODIGO-FUENTE/instalador`: instalador (Inno Setup y NSSM)

| Ruta | Qué contiene |
|---|---|
| `instalador/LetXinet-Suite.iss` | Script de Inno Setup: componentes, accesos del menú Inicio, Node.js si falta, página de contacto de OSM, registro de servicios y configuración de clientes |
| `instalador/register-services.cmd`, `restart-suite.cmd`, `uninstall-services.cmd`, `run-*.cmd` | Servicios NSSM |
| `instalador/bin/` | Lanzadores, cargador del `.env`, asistente de claves, `actualizar-config.ps1`, configurador de clientes |
| `instalador/bin/mcp/` | Puentes MCP: `letxinet-mcp-bridge.cjs` y `letxinet-jobs-bridge.cjs` |
| `instalador/bin/pruebas/` | Harness `probar-letxinet` y `verificar-instalacion.ps1` |
| `instalador/bin/clientes/` | Skills para Claude Code y OpenCode |
| `instalador/nssm/`, `instalador/prerequisitos/` | NSSM y el instalador de Node.js (este último se consigue aparte) |
| `shared-env/LetXinet-Suite.env` | Plantilla del `.env`, sin claves |
| `variant-tokens/variantB-publico/.env` | Configuración interna de V11 para la Variante B, sin claves |

### Otros archivos de `02_CODIGO-FUENTE`
| Ruta | Qué contiene |
|---|---|
| `recompilar-todo.cmd`, `recompilar-todo.ps1` | Compilan todo y generan el instalador |
| `LEEME-RECOMPILAR.md` | Cambios de cada versión en el código y detalles de la compilación |
| `runtime-extra/` | Lugar de `msvcp140.dll` para los dos Python embebidos (se consigue aparte) |
| `herramientas/` | Lugar del binario base de Node para yao-pkg (opcional) |

## Compilar

**Requisitos:**
- LetXinet Suite instalada en el equipo. De ahí salen los runtimes que no son código: Electron, `node_modules` y los Python embebidos.
- Node.js 22 o superior, Go 1.24 o superior e Inno Setup 6.3 o superior.
- Internet para `npm ci`, y unos 6 GB libres la primera vez (1 GB si recompilas sobre un árbol ya armado).

**Archivos que no están en el repositorio** por tamaño o porque son de terceros:

| Archivo | Dónde va | Cómo conseguirlo |
|---|---|---|
| `node-v22.23.4-x64.msi` | `02_CODIGO-FUENTE/instalador/instalador/prerequisitos/` | https://nodejs.org/dist/v22.23.4/node-v22.23.4-x64.msi |
| `msvcp140.dll` (Visual C++ 2015-2022, x64) | `02_CODIGO-FUENTE/runtime-extra/` | Cópialo de `C:\Windows\System32` de un equipo con el redistribuible de Visual C++ x64 |
| Binario base de Node para yao-pkg | `02_CODIGO-FUENTE/herramientas/pkg-cache/` | Opcional: si falta, yao-pkg lo descarga solo |
| Modelos de spaCy | `02_CODIGO-FUENTE/mcp-v11-local/src/python/models/` | Solo para desarrollar V11 con spaCy: `python -m spacy download es_core_news_sm` (y `en_core_web_sm`, `pt_core_news_sm`) |
| Fuentes de Addon Bridges 1.0.0 | — | Se distribuyen aparte (zip de 152 MB) |

**Compilar todo:** doble clic en `02_CODIGO-FUENTE/recompilar-todo.cmd`. Tarda de 30 a 40 minutos y deja el instalador en `C:\LetXinet-Recompilado\installer-output\variantB`. Si se corta, vuelve a lanzarlo: completa lo que faltó.

| Opción de `recompilar-todo.ps1` | Qué hace |
|---|---|
| `-Trabajo <carpeta>` | Carpeta de trabajo (por defecto `C:\LetXinet-Recompilado`; evita OneDrive) |
| `-Instalado <carpeta>` | Suite instalada de donde salen los runtimes |
| `-NodeModulesV11 <carpeta>`, `-NodeModulesDesktop <carpeta>` | Reusan un `node_modules` en vez de correr `npm ci` |
| `-SinInstalador` | Compila y arma todo sin correr Inno Setup |
| `-SoloInstalador` | Solo corre Inno Setup sobre lo ya armado |

El script se detiene si encuentra una clave en lo que va a empaquetar o si falta `msvcp140.dll`. Más detalles en [`02_CODIGO-FUENTE/LEEME-RECOMPILAR.md`](02_CODIGO-FUENTE/LEEME-RECOMPILAR.md).

## Solución de problemas

| Síntoma | Causa | Qué hacer |
|---|---|---|
| MarkItDown figura «Running» pero no responde en 7860 (versión 1.1.3) | Falta `msvcp140.dll` de Visual C++ | Instalar la 1.1.5 o correr `arreglo-1.1.3` |
| MarkItDown no arranca: «DLL load failed while importing _multiarray_umath» | El procesador no tiene SSE4.2 y numpy 2.5.1 (versiones 1.1.3 y 1.1.4) lo exige | Instalar la 1.1.5, que trae numpy 2.3.5, o correr `arreglo-2-markitdown` |
| «The desktop backend did not start in time» | El backend tardó más de 2 minutos (versión 1.1.3) | Instalar la 1.1.5 o correr `arreglo-1.1.3`. Ahora espera 10 minutos |
| Una herramienta larga se corta en el cliente | Tiempo de espera del cliente | Volver a correr el configurador, que fija `MCP_TOOL_TIMEOUT`, y llamar la herramienta directo. En la 1.1.3 y la 1.1.4, `letxinet-jobs` la corta a los 114 s (ver [Puentes](#puentes-mcp-de-la-suite)) |
| Todas las búsquedas se cortan por tiempo aunque `/api/health` responde (hasta la 1.1.5) | Muchas llamadas a V11 a la vez: el trabajo vencido no se cancelaba y la cola crecía | Instalar la 1.1.6. En versiones anteriores, reiniciar el servicio `LetXinetSuiteMCPV11` |
| «V11 está ocupado: N búsquedas en curso» | Hay 3 búsquedas corriendo y esta esperó 45 s sin turno | Reintentar en unos segundos. El máximo se cambia con `LETXINET_MAX_BUSQUEDAS` |
| Una búsqueda trae pocos resultados o falta una fuente | Esa fuente está caída, limitada o en pausa | `health_check` muestra el estado de cada fuente; `stats` del resultado dice cuál falló |
| Los resultados priorizan un lugar que no se pidió | En la 1.1.3 y la 1.1.4, V11 guarda la primera ubicación que detecta y no la borra hasta reiniciarse | Instalar la 1.1.5 o reiniciar el servicio `LetXinetSuiteMCPV11` |
| `find_nearby_places`, `explore_area` o `polygon_from_admin` fallan | Ningún servidor de Overpass responde desde la red (hasta la 1.1.5 no se llegaban a probar los espejos) | Instalar la 1.1.6. `osm_health` dice qué servidor se usa. `geocode_address` (Nominatim) sigue funcionando |
| Las rutas y tiempos de viaje fallan | OSRM no responde desde la red | `osm_health` lo confirma; no hay servidor alterno configurado |
| `convert_document`, `extract_tables` o `extract_formulas` fallan | Falta `MINERU_API_KEY` | Cargar la clave o usar `markitdown_convert` para PDF |
| OSM responde lento o con errores de Overpass | Servidor público saturado | Se prueban servidores espejo solos; se pueden fijar con `OVERPASS_FALLBACK_URLS` |
| Claude Code no ve las herramientas | No se configuró, o se instaló después de la Suite | Menú Inicio → «Configurar Claude Code, Claude Desktop y OpenCode» |

Los registros de cada servicio están en `C:\ProgramData\LetXinet Suite\Logs`, por ejemplo `markitdown-api.stderr.log` y `mcp-v11-local.stdout.log`.

### Corregidos en la 1.1.5
- **MarkItDown en procesadores sin SSE4.2:** trae numpy 2.3.5 en lugar de 2.5.1.
- **`letxinet-jobs`:**
  - ya no corta las búsquedas a los 114 s;
  - `gateway_poll` informa los errores y valida el `task_id`;
  - las tareas de más de 24 h se borran.
- **Ubicación arrastrada entre búsquedas:** V11 guardaba la primera ubicación detectada en `globalThis.__osmGeoResult`. Ahora vale solo para la petición en curso (`utils/geo-context.ts`).
- **`search` y `maxSources`:** `maxSources` no limitaba nada. Ahora es un alias de `maxResults`.

### Corregidos en la 1.1.6
- **Atasco con varias llamadas a la vez:** V11 cancela el trabajo vencido y limita las búsquedas simultáneas a 3.
- **Tesis locales que no aparecían:** la consulta a ALICIA incluye el lugar, y lo local va primero.
- **`location` y `university`:** ya no reducen los resultados.
- **`batch_search`:** aplica el filtro de pertinencia, respeta `fastMode`, une duplicados y pasó de minutos a segundos.
- **`search`:** entra en la caché.
- **`smart_search`:** ya no devuelve éxito con 0 resultados cuando sus consultas fallan.
- **Metadatos:** enlace directo al PDF en los 5 primeros resultados, país correcto en La Referencia y universidad según el repositorio.
- **Overpass:** los servidores espejo se usan de verdad.

El detalle de cada arreglo está en [CHANGELOG.md](CHANGELOG.md).

### Problemas conocidos (pendientes)
- **`batch_search` consulta como máximo 12 fuentes por consulta** (16 con Claude). Con `latam` o `all` quedan fuera las últimas del grupo.
- **El enlace directo al PDF solo se busca en los 5 primeros resultados** y en repositorios con handle. Para el resto sigue sirviendo `resolve_pdf`.
- **El lugar en minúscula** solo se reconoce si es un departamento o una de unas 90 ciudades conocidas. Con mayúscula se reconoce siempre.
- **OSRM (rutas)** no tiene servidor alterno.
- **El aviso de claves del Desktop** solo comprueba Gemini y CORE.

## Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| `00_LEEME-PRIMERO.md` | Resumen del paquete y novedades de cada versión |
| `01_INSTALADORES/` | Solo los hashes SHA-256. Los instaladores van en *Releases* |
| `02_CODIGO-FUENTE/` | Código de todos los componentes y la compilación |
| `03_CONFIG-CLAUDE-CODE-OPENCODE/` | Configurador de clientes, skills y plantillas del `.env` |
| `04_SCRIPTS-MANTENIMIENTO/` | Harness, pool de pruebas, arreglos y utilidades |
| `05_GUIA-MODIFICAR-COMPILAR-INSTALAR.md` | Guía técnica de cada componente |
| `06_INFORMES-Y-PRUEBAS/` | Informes y registros de pruebas |
| `07_DOCUMENTACION-ORIGINAL/` | Planes, línea de tiempo y documentación de versiones anteriores, incluido el script del Addon Bridges |
| `08_REPORTE-COMPLETO-DE-LO-SUCEDIDO.md` | Historial detallado de cambios, pruebas y seguridad |
| `09_PLAN-VERIFICACION-E-INSTALACION.docx` | Plan de verificación e instalación |
| `CHANGELOG.md` | Cambios por versión |

## Seguridad

- El repositorio no lleva claves. Las claves van en `C:\ProgramData\LetXinet Suite\LetXinet-Suite.env` o en la pantalla de claves del Desktop, nunca en el código.
- `.gitignore` bloquea los `.env`, `secrets.json`, las carpetas de claves y los binarios.
- `recompilar-todo.ps1` revisa que no haya claves antes de generar el instalador.
- Los servicios escuchan solo en `127.0.0.1`, y las herramientas no leen direcciones internas.
- Si usaste la versión 1.1.0, rota las claves que llevaba.

## Licencias

El proyecto todavía no tiene licencia propia: mientras no se elija una, el código es de uso reservado de su autor. Los componentes de terceros conservan sus licencias, por ejemplo:
- NSSM: dominio público.
- numpy: BSD.
- PyMuPDF y PyMuPDF4LLM, que usa MarkItDown: AGPL-3.0 o licencia comercial de Artifex. Tenlo en cuenta si distribuyes el instalador.
- OpenStreetMap: datos bajo ODbL; respeta las políticas de uso de Nominatim, Overpass y OSRM.
- Modelos de spaCy y dependencias de npm y Go: cada uno con su propia licencia.
