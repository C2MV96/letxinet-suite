# Cambios

Las versiones anteriores a la 1.1.2 están en `07_DOCUMENTACION-ORIGINAL/PLAN-Y-PROGRESO-suite/CHANGELOG.md`. El detalle de cada versión está en `08_REPORTE-COMPLETO-DE-LO-SUCEDIDO.md`.

## 1.1.6 (10/11/2026)

Corrige todo lo que quedó pendiente de las pruebas de búsqueda del 09/11/2026 (`06_INFORMES-Y-PRUEBAS/pruebas-busqueda-2026-11-09.md`). Cambia V11, OSM-MCP y el Desktop.

### Búsqueda (V11)

- **Encuentra las tesis locales.** Con 4 palabras o más, la consulta a ALICIA se partía en pares de las primeras palabras y el lugar, que va al final, nunca se enviaba. Ahora se envían la consulta completa, «tema + lugar» por título y el tema solo (`planConsultasAlicia` en `utils/pertinencia-repositorios.ts`). La Referencia recibe además «tema + lugar».
- **Lo local va primero, sin quitar resultados.** Los resultados que nombran el lugar suben al inicio, hasta media página. El filtro de pertinencia conserva los trabajos del lugar que tratan el tema aunque no tengan todas las palabras.
- **El lugar se reconoce mejor.** Es la última palabra con mayúscula de la consulta («Aedes» ya no cuenta como lugar) o una ciudad o departamento conocido, aunque vaya en minúscula («dengue chimbote»).
- **`location` y `university` ya no reducen los resultados.** Solo ordenan, en todas las fuentes. Antes `university` filtraba en ALICIA, OpenAlex y Scopus, y `location` se anteponía a la consulta.
- **RENATI ya no espera a la cosecha OAI-PMH.** La cosecha corría siempre y retenía la respuesta unos 30 s. Ahora solo corre si ALICIA trae menos de 5 resultados, con un plazo de 12 s (`RENATI_OAI_TIMEOUT_MS`), y se pausa 10 minutos si vence 2 veces seguidas.
- **`batch_search`:**
  - aplica el filtro de pertinencia de repositorios y pone lo local primero, como `search`;
  - respeta `fastMode` al reordenar;
  - une los duplicados entre ALICIA y La Referencia (compara la dirección y el título, no solo «título + año»);
  - no consulta ALICIA dos veces cuando también va RENATI;
  - informa en `fuentesConError` las fuentes que no respondieron.
- **`batch_search` y `smart_search` son mucho más rápidos.** Al reordenar pedían la misma geocodificación una vez por resultado, y cada petición hacía fila en el límite de 1 por segundo: 60 resultados tardaban cerca de 60 s. Ahora se pide una sola vez (`utils/osm-geocoder.ts`).
- **`smart_search` ya no devuelve «éxito» con 0 resultados** cuando todas sus consultas fallan: devuelve el error. Si fallan algunas, lo avisa en `aviso`.
- **`search` y `smart_search` entran en la caché.** No se guarda una respuesta a la que le faltó alguna fuente.
- **País correcto.** La Referencia salía con país `_version` por un error al leer `country-keywords.json`.
- **Universidad según el repositorio.** Si la dirección del registro es de un repositorio peruano conocido, manda el repositorio; el valor anterior queda en `universityReported`. Un país suelto («Ecuador») ya no figura como universidad (`utils/acabado-resultados.ts`).
- **Enlace directo al PDF.** Para los 5 primeros resultados se resuelve el PDF en un plazo de 6 s; `pdfUrl` pasa a ser el PDF y la página del repositorio queda en `handleUrl`. En `fastMode` solo se hace con `resolverPdf: true`.
- **ALICIA en pausa se informa.** Si su *circuit breaker* está abierto, `stats` muestra el motivo en lugar de `found: 0`.
- **Descripciones de `search` y `batch_search`:** `search` figura como la búsqueda recomendada.

### Estabilidad (V11)

- **Cancela el trabajo vencido.** Al vencer el plazo de una herramienta, o si el cliente cierra la conexión, se cancelan sus descargas en curso y las que esperaban turno (`utils/geo-context.ts`, `providers/base.ts`, `utils/inter-process-provider-limiter.ts`). Antes seguían corriendo minutos y la cola crecía.
- **Una cancelación no cuenta como fallo de la fuente,** así que no abre su *circuit breaker*.
- **Límite de búsquedas simultáneas.** `search`, `batch_search` y `smart_search` corren como máximo 3 a la vez (`LETXINET_MAX_BUSQUEDAS`). Las demás esperan turno hasta 45 s; si no lo consiguen, devuelven «V11 está ocupado» en vez de agotar el plazo (`utils/turnos-busqueda.ts`).
- **`health_check` informa el estado de cada fuente:** sondea ALICIA, La Referencia, OpenAlex, Crossref, PubMed, Semantic Scholar y CORE, y avisa de las que están en pausa, limitadas o con la clave rechazada. El estado general pasa a «degradado» si alguna falla.

### Mapas (OSM-MCP)

- **Los servidores espejo de Overpass ahora sí se usan.** El servidor principal consumía los 30 s del plazo total y los espejos nunca se probaban. Ahora cada intento tiene su límite (10 s el principal, 25 s cada espejo) y se recuerda 10 minutos el servidor que respondió.
- **Nuevo primer espejo:** `overpass.openstreetmap.fr`, el único que respondió desde la red de pruebas el 10/11/2026. El instalador lo agrega también a la lista de espejos de `LetXinet-Suite.env` en las laptops que se actualizan (ese archivo se conserva, y con la lista antigua el espejo nuevo no se probaba).
- **Si ningún servidor responde, las siguientes llamadas fallan enseguida** durante 45 s, en vez de esperar otro minuto por cada reintento.
- **Error claro.** Si ningún servidor responde, las herramientas dicen que Overpass no responde y que `geocode_address` y `reverse_geocode` siguen funcionando.
- **`osm_health`** indica el espejo en uso y explica en `notes` qué funciona y qué no.

### Desktop

- **Aviso de claves rechazadas.** La pantalla de claves comprueba con el proveedor las claves de Gemini y CORE (`GET /api/keys/verify`) y muestra un aviso si alguna fue rechazada.

### Medido el 10/11/2026

Consultas de la prueba B del 09/11, con `peru_fast` y `fastMode`:

| Prueba | 1.1.5 | 1.1.6 |
|---|---|---|
| `search`: del lugar en los 10 primeros (Chimbote, Huaraz, Arequipa) | 1, 0 y 0 | 10, 10 y 10 |
| `search` con `location` y `university` (Huaraz, Arequipa) | 0 y 3 resultados | 20 y 20 resultados |
| `search` con RENATI (`peru`, `latam`) | 22,6 a 25,4 s | 1,9 a 9,7 s |
| `batch_search`, 1 consulta | 44 a 197 s | 3,0 s |
| `batch_search`, 3 consultas, 60 resultados | 217 s, 7 duplicados | 11,4 s, 0 duplicados |
| `smart_search` | 84 s | 5,0 s |
| `search` repetida (caché) | sin caché | 4 ms |
| 8 `search` a la vez | atasco de 20 minutos el 09/11 | las 8 bien, 12 a 27 s en total |
| `find_nearby_places` (hospitales en Chimbote) | sin respuesta en 60 s | 16,7 s la primera vez y 0,7 a 10,6 s las siguientes |

Los tiempos dependen de ALICIA, que ese día respondió entre 1 y 9 s por consulta.

### Límites de estas pruebas

- OSRM (rutas) no responde desde la red de pruebas; eso no cambió.
- Instalada sobre la 1.1.5 en la laptop de pruebas: el harness dio 33 OK, 1 aviso (Desktop cerrado) y 0 fallas.
- El aviso de claves del Desktop se compiló, pero no se probó con una clave rechazada real.
- Falta probar MarkItDown en un procesador sin SSE4.2 real (pendiente desde la 1.1.5).

## 1.1.5 (09/11/2026)

Arregla lo que encontraron las pruebas de búsqueda del 08–09/11/2026 (`06_INFORMES-Y-PRUEBAS/pruebas-busqueda-2026-11-09.md`).

- **MarkItDown funciona en procesadores sin SSE4.2.** El instalador trae numpy 2.3.5 en lugar de 2.5.1, y `recompilar-todo.ps1` comprueba que cargue con PyMuPDF4LLM. Para laptops con la 1.1.3 o la 1.1.4 sigue disponible `04_SCRIPTS-MANTENIMIENTO/arreglo-2-markitdown`.
- **`letxinet-jobs`:**
  - las tareas se presentan como `letxinet-jobs-bridge/1.1.5`, y V11 ya no las corta a los 114 s;
  - `gateway_poll` informa `ERROR`, `LOST`, `NOT_FOUND` e `INVALID` con `isError` y valida el `task_id`;
  - se borran las tareas de más de 24 h;
  - `gateway_call` y `gateway_chat` marcan los errores del gateway.
- **V11:**
  - la ubicación detectada vale solo para la petición en curso (antes quedaba guardada para todas las búsquedas siguientes);
  - el User-Agent `letxinet-jobs` recibe el límite de 600 s;
  - `search` acepta `maxResults`, y `maxSources` es un alias.
- **Skill `letxinet-investigacion-academica`:** recomienda `search` y varias `search` seguidas en lugar de `batch_search`.
- **README:** tiempos y pertinencia medidos, problemas corregidos y pendientes.

## 1.1.4 (08/11/2026)

- **MarkItDown arranca sin Visual C++.** El instalador incluye `msvcp140.dll` dentro de los dos Python embebidos. Sin ese archivo, MarkItDown figuraba «Running» pero nunca respondía en el puerto 7860.
- **LetXinet Desktop espera hasta 10 minutos a su backend** (antes eran 2) y muestra «Iniciando...». El tiempo se cambia con `LETXIPU_BACKEND_TIMEOUT_MS`.
- **Harness:** revisa Visual C++ y cuánto espera el Desktop, no da un error confuso cuando MarkItDown no responde y marca Claude Code como aviso si no está instalado.
- **Arreglo para laptops con la 1.1.3:** `04_SCRIPTS-MANTENIMIENTO/arreglo-1.1.3`.

## 1.1.3

- `convert_document` vuelve a funcionar con URL.
- V11 ya no se atasca con muchas consultas de metadatos seguidas.
- Búsqueda de tesis peruanas más pertinente en RENATI, ALICIA y La Referencia.
- Sci-Hub y WeLib desactivados: `download_pdf` usa solo fuentes abiertas.
- Ninguna herramienta lee direcciones internas (127.0.0.1, red local, 169.254.169.254).
- Arreglos en `extract_tables`, `fetch_metadata`, `resolve_pdf` y el configurador.
- Pool de pruebas completas con comparativo frente a IA.

## 1.1.2

- Node.js LTS incluido: el instalador lo instala solo si falta.
- Configuración automática de Claude Code, Claude Desktop y OpenCode, en modo separados o juntos.
- Puentes MCP nuevos y puente de tareas largas corregido.
- OSM: contacto para Nominatim, servidores espejo de Overpass y servicios solo en este equipo.
- Accesos en el menú Inicio: «Configurar Claude Code, Claude Desktop y OpenCode» y «Probar LetXinet Suite».
