# C — Prueba de las 28 herramientas del MCP `letxinet-osm`

- Fecha: 2026-11-01 · Cliente: Claude Code (herramientas deferred cargadas con `ToolSearch "+letxinet-osm"`, 28/28 cargadas).
- Servidor: `get_version` → version `dev`, go1.26.4, build 2026-07-12, rev `dd570171…` (vcs.modified=true), windows/amd64.
- Caso real: tesis «Perfil lipídico y grado de hipertensión en pacientes de un establecimiento de salud de Chimbote (Microred Progreso), 2025».
- Latencias: **aproximadas** (el cliente no expone cronómetro). «<1 s» = respuesta inmediata; «timeout» = error `The operation timed out.` del cliente (se trata como >90 s / timeout); «ECONNRESET» = el socket del servidor se cerró al esperar a Overpass.

## Estado de los backends

| Momento | status | Nominatim | OSRM | Overpass |
|---|---|---|---|---|
| Inicio de la prueba | degraded | ok (350 ms) | down (1106 ms) | down (3000 ms) |
| Fin de la prueba | degraded | ok (285 ms) | down (764 ms) | down (3000 ms) |

**Sigue igual que en el diagnóstico de hoy** según `osm_health`. **Ojo:** `osm_health` marca OSRM como «down», pero las 4 herramientas de ruteo **sí respondieron** con rutas reales (calles correctas de Chimbote). El chequeo de salud de OSRM da un **falso negativo** (probablemente consulta otro endpoint o tiene un umbral de latencia demasiado estricto). Overpass sí está caído de verdad: las 10 llamadas que dependen de él fallaron.

## Registro de llamadas (44 llamadas)

| # | Herramienta | Argumentos (resumen) | Resultado | Latencia aprox. | Resumen / error | Backend |
|---|---|---|---|---|---|---|
| 1 | osm_health | — | ✅ éxito | ~3 s | degraded: Nominatim ok, OSRM down, Overpass down; uptime 77 452 s | todos |
| 2 | get_version | — | ✅ éxito | <1 s | dev, go1.26.4, build 2026-07-12 | local |
| 3 | geocode_address | «Chimbote, Áncash, Perú», lang=es | ✅ éxito | <1 s | -9.0744966, -78.593609 (Chimbote, Santa, 02803); 2.º candidato -8.8999, -78.4084 | Nominatim |
| 4 | geocode_address | «Centro de Salud Progreso, Chimbote», region=Perú | ❌ error | <1 s | `LOW_CONFIDENCE_RESULTS`: Nominatim **sí lo encontró** («Centro de Salud Progreso, 1110, Prolongación José Gálvez, El Progresso, 2 de Mayo, Chimbote, 02800») pero el filtro de importancia (umbral 0.05; importancia 0.000053) lo descartó y no devuelve coordenadas | Nominatim OK; fallo del filtro del MCP |
| 5 | geocode_address | «Hospital Eleazar Guzmán Barrón, Nuevo Chimbote» | ❌ error | <1 s | `LOW_CONFIDENCE_RESULTS`: encontrado en Av. Brasil, Santa Rosa, Urb. San Rafael, Nuevo Chimbote, 02711; descartado (importancia 0.000047) | ídem |
| 6 | geocode_address | «Hospital La Caleta, Chimbote» | ❌ error | <1 s | `LOW_CONFIDENCE_RESULTS`: encontrado en Jr. Manuel Seoane, Centro, Chimbote, 02803; descartado (importancia 0.000038) | ídem |
| 7 | geocode_address | «Centro de Salud Progreso, Prolongación José Gálvez, Chimbote, Santa, Áncash, Perú» | ❌ error | <1 s | mismo `LOW_CONFIDENCE_RESULTS` (más contexto no ayuda: el umbral es fijo) | ídem |
| 8 | geocode_address | «Prolongación José Gálvez, El Progreso, Chimbote, Perú» | ❌ error | <1 s | `NO_RESULTS` (OSM escribe «El Progresso») | Nominatim |
| 9 | geocode_address | «Avenida Brasil, Nuevo Chimbote, Perú» | ✅ éxito | <1 s | -9.1196252, -78.522522 (tramo CP 02711, el del hospital EGB) y -9.1190, -78.5262 | Nominatim |
| 10 | geocode_address | «Jirón Manuel Seoane, Chimbote, Perú» | ✅ éxito | <1 s | tramo Centro (CP 02803, el del H. La Caleta): -9.0751035, -78.6014251 | Nominatim |
| 11 | geocode_address | «Prolongación José Gálvez, Chimbote, Perú» | ✅ éxito | <1 s | -9.0643207, -78.586546 (El Progresso, 2 de Mayo, 02800) → usado como coordenada aproximada del C.S. Progreso | Nominatim |
| 12 | geocode_address | «El Progreso, Chimbote, Perú» | ⚠️ éxito engañoso | <1 s | devuelve «Valle El Progreso» (-8.8657, -78.5428), un valle rural ~22 km al norte, **no** el barrio | Nominatim |
| 13 | reverse_geocode | -9.0643207, -78.586546, lang=es | ✅ éxito | <1 s | «1349, Prolongación José Gálvez, El Progresso, 2 de Mayo, Chimbote, 02800» (a ~240 números del C.S., n.º 1110) | Nominatim |
| 14 | find_nearby_places | C.S. Progreso aprox., category=hospital, r=5000, limit=20 | ❌ timeout | timeout | `The operation timed out.` | Overpass caído |
| 15 | explore_area | C.S. Progreso aprox., r=1500 | ❌ timeout | timeout | `The operation timed out.` | Overpass caído |
| 16 | osm_query_bbox | bbox -9.13/-78.62 a -9.04/-78.51, amenity=clinic | ❌ error | ~30–60 s | `ECONNRESET: The socket connection was closed unexpectedly` | Overpass caído |
| 17 | polygon_from_admin | «Chimbote», admin_level=8 | ❌ error | ~30–60 s | `ECONNRESET` | Overpass caído |
| 18 | find_nearby_batch | 2 sub-consultas (clinic, doctors; r=3000) | ❌ timeout | timeout | `The operation timed out.` | Overpass caído |
| 19 | get_map_image | -9.085, -78.57, zoom 13 | ✅ éxito | ~1–2 s | tesela PNG 256×256 13/2308/4303 (este de Chimbote; Progreso queda fuera, borde oeste -78.574) | tile.openstreetmap.org |
| 20 | tile_cache | action=stats | ✅ éxito | <1 s | 1 tesela en caché, máx 1000, TTL 24 h; hits/misses en 0 (contadores no se actualizan) | local |
| 21 | get_route_directions | C.S. Progreso → H. La Caleta, car | ✅ éxito | ~1–2 s | 2 882 m, 301 s (5 min), 80 puntos; route_file `\tmp\routes\route-3530123895.json` | OSRM (respondió pese a «down») |
| 22 | route_fetch | C.S. Progreso → H. EGB (Av. Brasil), car | ✅ éxito | ~1–2 s | 11 058 m, 884 s (14,7 min) + polyline | OSRM |
| 23 | analyze_commute | C.S. Progreso → H. La Caleta, modos por defecto | ⚠️ éxito con fallo de lógica | ~1–2 s | Auto/bici/a pie con **la misma duración (5 min)** y mismas instrucciones: usa el perfil de auto para todos; recomienda «walking». CO2 auto 0,35 kg | OSRM |
| 24 | get_map_image | -9.075, -78.59, zoom 13 | ✅ éxito | ~1–2 s | tesela 13/2307/4303: Chimbote Centro, 2 de Mayo, bahía; incluye Progreso | tile.openstreetmap.org |
| 25 | route_sample | polyline de #22, interval=1000 | ✅ éxito | <1 s | 13 puntos cada ~1 km a lo largo de la ruta | local |
| 26 | polyline_encode | 3 puntos (Progreso, La Caleta, EGB) | ✅ éxito | <1 s | `~jiv@\|\|s~MjbA~{AhuGelN` | local |
| 27 | polyline_decode | polyline de #22 | ✅ éxito | <1 s | 12 puntos, coherentes con origen/destino | local |
| 28 | geo_distance | Progreso → La Caleta | ✅ éxito | <1 s | 2 026,5 m (haversine) | local |
| 29 | geo_distance | Progreso → EGB | ✅ éxito | <1 s | 9 339,9 m | local |
| 30 | bbox_from_points | 4 puntos | ✅ éxito | <1 s | minLat -9.1196, minLon -78.6014, maxLat -9.0643, maxLon -78.5225 | local |
| 31 | centroid_points | 3 establecimientos | ✅ éxito | <1 s | -9.08635, -78.57016 | local |
| 32 | sort_by_distance | 3 elementos con `lat`/`lon` sueltos, id numérico | ❌ error | <1 s | `Invalid input format` (exige `id` string y `location:{latitude,longitude}`; el esquema no lo documenta) | validación |
| 33 | filter_tags | 4 elementos con `lat`/`lon`, id numérico | ❌ error | <1 s | `Invalid input format` (misma causa) | validación |
| 34 | suggest_meeting_point | 3 ubicaciones, category=pharmacy, limit=3 | ❌ timeout | timeout | `The operation timed out.` | Overpass caído |
| 35 | enrich_emissions | 4 opciones (2 auto, a pie, bici) | ✅ éxito | <1 s | auto 2,9 km: 0,35 kg CO2, costo 0,58; auto 11,1 km: 1,33 kg CO2; a pie 231 kcal; bici 144 kcal | local |
| 36 | sort_by_distance | mismos 3, `id` string + `location` | ✅ éxito | <1 s | Centro Chimbote 1 372 m; La Caleta 2 027 m; EGB 9 340 m | local |
| 37 | filter_tags | 2 elementos, `location`, amenity∈{hospital,clinic,doctors} | ✅ éxito | <1 s | devuelve solo H. La Caleta | local |
| 38 | find_schools_nearby | C.S. Progreso aprox., r=1500, limit=5 | ❌ error | ~30–60 s | `ECONNRESET` | Overpass caído |
| 39 | find_parking_facilities | H. La Caleta aprox., r=1000, limit=5 | ❌ timeout | timeout | `The operation timed out.` | Overpass caído |
| 40 | find_charging_stations | Chimbote, r=10000, limit=5 | ❌ error | ~30–60 s | `ECONNRESET` | Overpass caído |
| 41 | analyze_neighborhood | C.S. Progreso aprox., r=1000, sin precios | ❌ error | ~30–60 s | `ECONNRESET` | Overpass caído |
| 42 | tile_cache | action=list | ✅ éxito | <1 s | 2 teselas: 13/2308/4303 y 13/2307/4303 | local |
| 43 | osm_health | — (re-chequeo) | ✅ éxito | ~3 s | sigue degraded (Nominatim ok 285 ms; OSRM down; Overpass down) | todos |
| 44 | tile_cache | action=get, 13/2307/4303 | ✅ éxito | <1 s | metadatos + PNG base64 (24 656 bytes) | local |

(La numeración llega a 44 porque incluye los reintentos; son 44 llamadas en total: 27 con éxito (1 engañosa) y 17 con error o timeout (10 por Overpass, 7 por validación o filtro del MCP).)

## Conclusión por herramienta (28)

| Herramienta | Veredicto | Causa / comentario |
|---|---|---|
| osm_health | ✅ | Funciona, pero **falso negativo para OSRM** (dice «down» y el ruteo funciona) |
| get_version | ✅ | — |
| geocode_address | ⚠️ | Ciudades y calles OK. **POI pequeños (C.S., hospitales) se descartan** por el umbral de importancia fijo 0.05: Nominatim los encuentra pero el MCP no da coordenadas. Falta un parámetro para bajar el umbral |
| reverse_geocode | ✅ | Dirección precisa con número de puerta |
| find_nearby_places | ❌ | Timeout — Overpass caído |
| find_nearby_batch | ❌ | Timeout — Overpass caído |
| explore_area | ❌ | Timeout — Overpass caído |
| osm_query_bbox | ❌ | ECONNRESET — Overpass caído |
| filter_tags | ⚠️ | Funciona solo con `id` string y `location:{latitude,longitude}`; con `lat/lon` (formato Overpass nativo) da `Invalid input format`. Esquema sin documentar |
| polygon_from_admin | ❌ | ECONNRESET — Overpass caído |
| get_map_image | ⚠️ | Devuelve una sola tesela 256×256 sin marcadores (no sirve para señalar establecimientos sin edición posterior) |
| tile_cache | ✅ | stats/list/get OK; contadores de hits/misses no se actualizan |
| get_route_directions | ✅ | OK pese a «OSRM down» |
| route_fetch | ✅ | OK |
| route_sample | ✅ | — |
| analyze_commute | ⚠️ | Responde, pero bici y a pie usan la duración del auto (5 min para 2,9 km a pie) |
| polyline_encode | ✅ | — |
| polyline_decode | ✅ | — |
| geo_distance | ✅ | — |
| bbox_from_points | ✅ | — |
| centroid_points | ✅ | — |
| sort_by_distance | ⚠️ | Igual que filter_tags: formato de entrada estricto y no documentado |
| suggest_meeting_point | ❌ | Timeout — Overpass caído |
| enrich_emissions | ✅ | — |
| find_schools_nearby | ❌ | ECONNRESET — Overpass caído |
| find_parking_facilities | ❌ | Timeout — Overpass caído |
| find_charging_stations | ❌ | ECONNRESET — Overpass caído |
| analyze_neighborhood | ❌ | ECONNRESET — Overpass caído |

**Resumen:** 13 ✅ · 5 ⚠️ · 10 ❌. Los 10 ❌ se deben todos a **Overpass caído** (ninguno a OSRM). OSRM funciona aunque `osm_health` diga lo contrario. Fallos propios del MCP: umbral de importancia de geocodificación, esquema de elementos sin documentar en filter_tags/sort_by_distance, analyze_commute que usa el perfil de auto para todos los modos, mapa sin marcadores.
