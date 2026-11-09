# Pruebas de búsqueda: search, batch_search, OSM y letxinet-jobs (08–09/11/2026)

Tres agentes probaron en la laptop DESKTOP-TUI78FL, con LetXinet Suite 1.1.3 instalada (el código de V11 es igual en la 1.1.4). Corrieron al mismo tiempo sobre los mismos servicios, y cada llamada quedó registrada con su hora. Un límite de uso de la API cortó las pruebas unas 13 horas, entre el 08/11 a las 19:5x y el 09/11 a las 08:37.

| Agente | Qué probó | Informe |
|---|---|---|
| A | `search` frente a `batch_search`, solos, con las mismas consultas | [`A-search-vs-batch.md`](pruebas-busqueda-2026-11-09/A-search-vs-batch.md) |
| B | `search` y `batch_search` combinados con OSM, en Chimbote, Huaraz y Arequipa | [`B-con-osm.md`](pruebas-busqueda-2026-11-09/B-con-osm.md) |
| C | El puente `letxinet-jobs` para tareas largas | [`C-letxinet-jobs.md`](pruebas-busqueda-2026-11-09/C-letxinet-jobs.md) |

## Conclusiones

1. **`search` es la mejor opción por defecto.** Es la más rápida (mediana 31 s; de 5 a 9 s con `peru_fast`) y la más pertinente en 2 de 3 temas.
2. **Para varias variantes de una consulta, varias `search` seguidas superan a `batch_search`:**
   - Anemia: 15,6 s y 17 pertinentes de 25, frente a 82,5 s y 7 de 20.
   - Dengue: 94 s y 38 de 57, frente a 184 s y 13 de 20.
   - `batch_search` solo ganó en «hipertensión en ancianos», donde el filtro de `search` recortó los sinónimos.
3. **`batch_search` con una sola consulta no conviene nunca:** tardó entre 1,4 y 8,7 veces más, trajo menos resultados y no encontró nada pertinente que `search` no tuviera.
4. **OSM sirve para ubicar el lugar y sacar nombres de instituciones, pero no mejora la búsqueda.**
   - Pasar `location` o `university` a `search` redujo los resultados.
   - Meter instituciones en `batch_search` trajo títulos del lugar sin relación con el tema.
   - V11 se perdió tesis locales que sí existen en ALICIA (10 sobre dengue en Chimbote, 13 sobre agua en Huaraz y 3 sobre desnutrición en Arequipa).
5. **OSM no se ve afectado por la carga de V11:** `geocode_address` tardó 986 ms sin carga y 505 ms con un `batch_search` corriendo.
6. **Overpass y OSRM no respondieron desde esta red:** fallaron `find_nearby_places`, `explore_area` y `polygon_from_admin`. Nominatim sí funcionó.
7. **`letxinet-jobs` corta las búsquedas largas a los 114 s.**
   - Su ejecutor se presenta como OpenCode (`User-Agent: opencode/1.0` en `letxinet-jobs-bridge.cjs`), y V11 le aplica el límite de OpenCode.
   - 7 de 8 tareas largas no cacheadas se cortaron a los 114 s. Las llamadas directas tienen 228 s.
   - La mecánica funciona: el `task_id` llega en menos de 0,2 s, cada sondeo tarda menos de 20 ms y dos tareas a la vez no chocan.
   - `gateway_call` para PDF largos funcionó bien.
8. **Varias llamadas a V11 a la vez lo traban.**
   - Con los tres agentes a la vez, todas las búsquedas se cortaron entre las 13:49 y las 14:12 UTC.
   - V11 no cancela el trabajo vencido, y el registro muestra búsquedas que terminaban de procesarse 5 a 9 minutos después de llegar.
   - Se recuperó al bajar la carga.

## Fallos encontrados (para la próxima versión)

| Componente | Fallo | Prueba |
|---|---|---|
| `letxinet-jobs` | Se presenta como OpenCode y V11 corta sus tareas a los 114 s | C (aislado cambiando solo el User-Agent: 114 029 ms frente a 228 018 ms) |
| `letxinet-jobs` | `gateway_poll` responde «todavía no listo» cuando la tarea falló o no existe | C |
| `letxinet-jobs` | Los cortes y errores de validación quedan como `STATUS=DONE` con el error dentro | C |
| `letxinet-jobs` | `gateway_poll` no valida el `task_id` y puede leer archivos fuera de la carpeta de tareas | C |
| `letxinet-jobs` | Cada tarea deja 5 archivos que nadie borra | C |
| `letxinet-jobs` | `gateway_call` con una herramienta inexistente responde `isError=false`; `gateway_chat` no marca error cuando falla la clave | C |
| V11 | Guarda la primera ubicación detectada en `globalThis.__osmGeoResult` y no la borra; una geocodificación equivocada contamina las búsquedas siguientes | A (confirmado en `routes/mcp.ts` y `utils/reranking.ts`) |
| V11 | No cancela el trabajo vencido: con varias llamadas a la vez la cola crece | B |
| V11 | `search` ignora `maxSources` (hay que usar `maxResults`) y nunca entra en la caché | A y C |
| V11 | `batch_search` no aplica el filtro de pertinencia de repositorios, usa spaCy aunque se pida `fastMode` y consulta como máximo 12 fuentes por consulta | A |
| V11 | `smart_search` devolvió `success:true` con 0 resultados a los 120 s | C |
| V11 | Ningún resultado trae enlace directo al PDF; La Referencia pone `_version` como país; algunas fuentes ponen la universidad mal o genérica | A y B |
| Servicios externos | OpenAlex y PubMed respondieron 429, CORE rechazó la clave (401), y el *circuit breaker* de ALICIA se abrió a ratos | A y B |

## Límites de estas pruebas

- Casi todas las llamadas coincidieron con las de otro agente: los tiempos absolutos están inflados. La comparación entre herramientas se hizo con las mismas consultas y en el mismo periodo.
- Quedaron sin medir el tema global en inglés de A, las búsquedas de instituciones por radio (Overpass caído) y un `batch_search` de 3 consultas con ALICIA activa en Huaraz y Arequipa.
- La pertinencia se juzgó leyendo los 10 primeros títulos y resúmenes. El chequeo automático por palabras clave la sobrestima, porque solo mira el título.
