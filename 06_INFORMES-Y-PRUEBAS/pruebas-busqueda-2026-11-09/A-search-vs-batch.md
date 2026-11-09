# Prueba A: `search` frente a `batch_search` en V11 (sin OSM)

LetXinet Suite 1.1.3, V11 en `http://127.0.0.1:4003/api/mcp`, laptop DESKTOP-TUI78FL. Llamadas hechas con el cliente del pool (`ClienteMcp('v11').llamar`, timeout de 300 s por llamada). V11 identifica a este cliente como `unknown` (techo de 240 s), así que `batch_search` tiene un plazo de 228 s y `search` de 114 s.

## Resumen

- **`search` fue más rápido en todas las consultas que se pudieron medir**: mediana de 31 s, frente a 77 s de `batch_search` con 1 consulta y 95 s con 3 variantes. Con `peru_fast` la diferencia es enorme: unos 9 s frente a 77 s.
- **`batch_search` con una sola consulta no compensa.** Tardó entre 1,4 y 8,7 veces más, dio menos resultados (7, 0 y 8 frente a 12, 7 y 20) y no encontró ningún resultado pertinente que `search` no tuviera ya. En Q2 volvió vacío.
- **`batch_search` con 3 variantes solo ganó en una de tres consultas** (Q2, la de RENATI). En Q1 y Q3, lanzar 3 `search` seguidos fue más rápido (15,6 s frente a 82,5 s y 94 s frente a 184 s) y dio bastantes más resultados pertinentes únicos (17 frente a 7 y 38 frente a 13).
- **Q4 (fuente `global`) no se pudo medir.** Todas las llamadas de ambas herramientas superaron su plazo a partir de las 13:49 UTC. Ese fallo afectó también a los agentes B y C. La causa más probable es un estado global de geolocalización dentro de V11 que se contamina con las consultas de otros clientes (detalles en «Incidencias»).
- Se descartó **1 acierto de caché** (Q1_b_rep2, 5 ms, 13 h después de la original). Hubo **8 errores de plazo** (6 de `search` y 2 de `batch_search`, todos después de las 13:49 UTC) y **1 respuesta vacía** (Q2_b).

## Cómo se hizo

- Consultas y fuentes: Q1 «anemia infantil factores asociados» con `peru_fast`; Q2 «hipertensión arterial adulto mayor» con `peru`; Q3 «dengue control vectorial» con `latam`; Q4 «machine learning crop yield prediction» con `global`. Siempre con `fastMode: true`.
- `search`: `{query, sources, maxSources: 20, maxResults: 20, fastMode: true, filterFalsePositives: false}`. Se añadió `maxResults` porque la ruta `/api/search` no lee `maxSources` (ver «Hallazgos del código»). Sin `maxResults` devolvería hasta 50 resultados y no se podría comparar con `batch_search`.
- `batch_search`: `{queries, sources, maxResults: 20, fastMode: true, filterFalsePositives: false}`.
- `filterFalsePositives: false` es el valor por defecto documentado. Se pasó explícito para que la clave de caché fuera distinta de la de otros agentes que usaran los argumentos mínimos.
- Variantes para (c) y (d):
  - Q1: «anemia infantil factores asociados» / «factores de riesgo de anemia en niños» / «childhood anemia associated factors».
  - Q2: «hipertensión arterial adulto mayor» / «hipertensión en ancianos» / «hypertension in older adults».
  - Q3: «dengue control vectorial» / «control del mosquito Aedes aegypti» / «dengue vector control».
  - Q4: «machine learning crop yield prediction» / «predicción del rendimiento de cultivos con aprendizaje automático» / «crop yield forecasting with artificial intelligence». Como el original ya está en inglés, la segunda es la versión en español y la tercera una reformulación en inglés.
- Orden alterno para que la caché no favorezca a ninguna herramienta: Q1 y Q3 empezaron por `search` (a, b, d1-d3, c) y Q2 y Q4 por `batch_search` (b, a, c, d1-d3).
- Pertinencia: juzgué uno por uno los 10 primeros de cada respuesta, con título y resumen. También juzgué todos los resultados de (c) y de la fusión de (d). Criterios:
  - Q1: anemia en niños y sus factores o determinantes. No cuentan: anemia en gestantes, adherencia a suplementos, prevención o políticas.
  - Q2: hipertensión en adultos mayores, en cualquier aspecto.
  - Q3: control o vigilancia del vector del dengue: métodos, resistencia a insecticidas, larvicidas, Wolbachia, programas. No cuentan: biología del mosquito o del virus sin relación con el control, clínica, vacunas.
  - La columna «palabras» es `esPertinente(título, grupos)` del pool, con los grupos de `plan.cjs`.
- Horas: Q1 se corrió el 08/11 entre las 19:46 y 19:49 hora local (00:46–00:49 UTC del 09/11). Un límite de uso cortó la prueba y el resto se corrió el 09/11 entre las 08:37 y 09:14 hora local (13:37–14:14 UTC). Las tablas usan UTC.
- Solapamiento: 26 de mis 27 llamadas coincidieron en el tiempo con llamadas a V11 de los agentes B o C. La última columna de cada tabla dice cuántas. Los tiempos absolutos están medidos con V11 compartido y con carga.

## Resultados por consulta

Columnas: s = segundos; n = resultados; pert. = pertinentes entre los 10 primeros (o entre los n, si hay menos de 10); dup = duplicados dentro de la respuesta; DOI/handle, PDF directo, año y resumen = cuántos de los n los traen. «PDF directo» es una URL que apunta a un archivo PDF y no a un handle o a una página del artículo.

### Q1: «anemia infantil factores asociados» (fuentes peru_fast)

| llamada | herramienta | consulta(s) | inicio (UTC) | s | n | pert. top10 (juicio) | pert. top10 (palabras) | dup | DOI/handle | PDF directo | año | resumen | caché | llamadas V11 simultáneas de B/C |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| a | search | original | 00:46:24 | 8.9 | 12 | 5/10 | 8/10 | 0 | 11 | 0 | 12 | 6 | no | C:3 |
| b | batch_search | original | 00:46:33 | 77.1 | 7 | 2/7 | 4/7 | 0 | 6 | 0 | 7 | 7 | no | C:6 |
| d1 | search | original | 00:47:50 | 7.0 | 12 | 5/10 | 8/10 | 0 | 11 | 0 | 12 | 6 | no | C:1 |
| d2 | search | «factores de riesgo de anemia en niños» | 00:47:57 | 4.4 | 10 | 9/10 | 10/10 | 0 | 9 | 0 | 10 | 8 | no | C:1 |
| d3 | search | «childhood anemia associated factors» | 00:48:01 | 4.3 | 3 | 3/3 | 3/3 | 0 | 1 | 0 | 3 | 3 | no | C:1 |
| c | batch_search | 3 variantes | 00:48:06 | 82.5 | 20 | 7/10 | 10/10 | 1 | 15 | 0 | 17 | 2 | no | 0 |
| a_rep2 | search | original | 14:04:51 | 114.0 | 0 | – | – | 0 | 0 | 0 | 0 | 0 | no | B:1 C:3 |
| b_rep2 | batch_search | original | 14:06:45 | 0.0 | 7 | 2/7 | 4/7 | 0 | 6 | 0 | 7 | 7 | sí | C:2 |
| a_rep3 | search | original (sin fFP) | 14:12:27 | 114.1 | 0 | – | – | 0 | 0 | 0 | 0 | 0 | no | B:2 C:1 |

(a) vs (b): comparten 4 títulos; solo search 8, solo batch 3.

(c) vs (d): batch 3 variantes 82.5 s y 20 resultados; 3 search seguidos 15.6 s (7.0 + 4.4 + 4.3) con 25 brutos → 25 únicos (por variante 12/10/3). Comparten 5; solo batch 14; solo search 20. Pertinencia de todo el conjunto (juicio): batch 7/20, search fusionado 17/25. Palabras: batch 20/20, search 23/25.

### Q2: «hipertensión arterial adulto mayor» (fuentes peru)

| llamada | herramienta | consulta(s) | inicio (UTC) | s | n | pert. top10 (juicio) | pert. top10 (palabras) | dup | DOI/handle | PDF directo | año | resumen | caché | llamadas V11 simultáneas de B/C |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| b | batch_search | original | 13:37:47 | 56.6 | 0 | – | – | 0 | 0 | 0 | 0 | 0 | no | C:2 |
| a | search | original | 13:38:43 | 39.6 | 7 | 7/7 | 7/7 | 0 | 6 | 0 | 7 | 7 | no | C:2 |
| c | batch_search | 3 variantes | 13:39:23 | 94.8 | 20 | 10/10 | 10/10 | 0 | 14 | 0 | 20 | 20 | no | C:3 |
| d1 | search | original | 13:40:58 | 31.6 | 7 | 7/7 | 7/7 | 0 | 6 | 0 | 7 | 7 | no | C:5 |
| d2 | search | «hipertensión en ancianos» | 13:41:29 | 10.8 | 1 | 0/1 | 0/1 | 0 | 0 | 0 | 1 | 1 | no | C:5 |
| d3 | search | «hypertension in older adults» | 13:41:40 | 32.0 | 4 | 4/4 | 4/4 | 0 | 2 | 0 | 4 | 4 | no | B:2 C:5 |

(c) vs (d): batch 3 variantes 94.8 s y 20 resultados; 3 search seguidos 74.5 s (31.6 + 10.8 + 32.0) con 12 brutos → 12 únicos (por variante 7/1/4). Comparten 8; solo batch 12; solo search 4. Pertinencia de todo el conjunto (juicio): batch 16/20, search fusionado 11/12. Palabras: batch 16/20, search 11/12.

### Q3: «dengue control vectorial» (fuentes latam)

| llamada | herramienta | consulta(s) | inicio (UTC) | s | n | pert. top10 (juicio) | pert. top10 (palabras) | dup | DOI/handle | PDF directo | año | resumen | caché | llamadas V11 simultáneas de B/C |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| a | search | original | 13:42:12 | 31.2 | 20 | 5/10 | 6/10 | 0 | 12 | 0 | 18 | 18 | no | B:1 C:16 |
| b | batch_search | original | 13:42:43 | 137.5 | 8 | 6/8 | 7/8 | 0 | 1 | 0 | 6 | 6 | no | B:5 C:3 |
| d1 | search | original | 13:45:01 | 31.4 | 20 | 5/10 | 6/10 | 0 | 12 | 0 | 18 | 17 | no | B:1 C:1 |
| d2 | search | «control del mosquito Aedes aegypti» | 13:45:32 | 31.4 | 20 | 5/10 | 9/10 | 0 | 15 | 0 | 17 | 15 | no | B:1 C:1 |
| d3 | search | «dengue vector control» | 13:46:04 | 31.4 | 20 | 8/10 | 9/10 | 0 | 12 | 0 | 17 | 15 | no | B:1 C:2 |
| c | batch_search | 3 variantes | 13:46:35 | 184.2 | 20 | 5/10 | 10/10 | 2 | 15 | 0 | 5 | 0 | no | B:3 C:7 |

(a) vs (b): comparten 8 títulos; solo search 12, solo batch 0.

(c) vs (d): batch 3 variantes 184.2 s y 20 resultados; 3 search seguidos 94.2 s (31.4 + 31.4 + 31.4) con 60 brutos → 57 únicos (por variante 20/20/20). Comparten 2; solo batch 16; solo search 55. Pertinencia de todo el conjunto (juicio): batch 13/20, search fusionado 38/57. Palabras: batch 18/20, search 44/57.

### Q4: «machine learning crop yield prediction» (fuentes global)

| llamada | herramienta | consulta(s) | inicio (UTC) | s | n | pert. top10 (juicio) | pert. top10 (palabras) | dup | DOI/handle | PDF directo | año | resumen | caché | llamadas V11 simultáneas de B/C |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| b | batch_search | original | 13:49:39 | 228.0 | 0 | – | – | 0 | 0 | 0 | 0 | 0 | no | B:5 C:5 |
| a | search | original | 13:53:27 | 114.0 | 0 | – | – | 0 | 0 | 0 | 0 | 0 | no | B:2 C:2 |
| c | batch_search | 3 variantes | 13:55:21 | 228.0 | 0 | – | – | 0 | 0 | 0 | 0 | 0 | no | B:1 C:2 |
| d1 | search | original | 13:59:09 | 114.0 | 0 | – | – | 0 | 0 | 0 | 0 | 0 | no | B:1 C:1 |
| d2 | search | «predicción del rendimiento de cultivos con aprendizaje automático» | 14:01:03 | 114.0 | 0 | – | – | 0 | 0 | 0 | 0 | 0 | no | B:3 C:1 |
| d3 | search | «crop yield forecasting with artificial intelligence» | 14:02:57 | 114.0 | 0 | – | – | 0 | 0 | 0 | 0 | 0 | no | B:2 C:2 |

(c) vs (d): no medible: batch con variantes devolvió 0 resultados en 228.0 s y los 3 search 0 en 342.0 s (errores de plazo).

## Resumen por herramienta (sin aciertos de caché ni errores)

| grupo | llamadas | mediana s | rango s | resultados medios | precisión top10 (juicio) | pertinentes medios en top10 | precisión top10 (palabras) | respuestas vacías |
|---|---|---|---|---|---|---|---|---|
| search (todas, fastMode=true) | 12 | 31.3 | 4.3–39.6 | 11.3 | 68 % | 5.3 | 80 % | 0 |
| search consulta original (a, d1, reps) | 6 | 31.3 | 7.0–39.6 | 13.0 | 67 % | 5.7 | 80 % | 0 |
| batch_search 1 consulta (b y reps) | 3 | 77.1 | 56.6–137.5 | 5.0 | 52 % | 2.7 | 72 % | 1 |
| batch_search 3 variantes (c) | 3 | 94.8 | 82.5–184.2 | 20.0 | 73 % | 7.3 | 100 % | 0 |

Aciertos de caché descartados: 1 (Q1_b_rep2 5 ms). Errores: 8 (Q4_b: Tool "batch_search" exceeded its deadline of 228009ms; Q4_a: Tool "search" exceeded its deadline of 113994ms; Q4_c: Tool "batch_search" exceeded its deadline of 228012ms; Q4_d1: Tool "search" exceeded its deadline of 114011ms; Q4_d2: Tool "search" exceeded its deadline of 114011ms; Q4_d3: Tool "search" exceeded its deadline of 114006ms; Q1_a_rep2: Tool "search" exceeded its deadline of 114002ms; Q1_a_rep3: Tool "search" exceeded its deadline of 114002ms). Vacías: Q2_b.

Registros de B/C leídos para solapes: 97.

## (a) `search` frente a (b) `batch_search` con una sola consulta

| consulta | search: s / n / pert. top10 | batch_search: s / n / pert. top10 | batch más lento | títulos compartidos | propios de batch |
|---|---|---|---|---|---|
| Q1 peru_fast | 8,9 / 12 / 5 de 10 | 77,1 / 7 / 2 de 7 | ×8,7 | 4 | 3, ninguno pertinente |
| Q2 peru | 39,6 / 7 / 7 de 7 | 56,6 / **0** | ×1,4 | 0 | 0 |
| Q3 latam | 31,2 / 20 / 5 de 10 | 137,5 / 8 / 6 de 8 | ×4,4 | 8 | 0 |
| Q4 global | error de plazo (114 s) | error de plazo (228 s) | no medible | – | – |

- El costo extra de `batch_search` no está en las fuentes, sino en lo que hace después:
  - En Q1_b, ALICIA y La Referencia Perú respondieron en 6 s, pero la llamada tardó 77 s.
  - En Q3_b, la fuente más lenta tardó 31 s y la llamada 137 s.
- `batch_search` filtra mucho después de reordenar: Q1_b reunió 103 resultados brutos y entregó 7; Q3_b reunió 147 y entregó 8.
- Su precisión en el top 10 fue algo mayor en Q3 (6 de 8 frente a 5 de 10), pero los 8 resultados ya estaban en la respuesta de `search`.
- Q2_b volvió vacío en 56,6 s: RENATI dio 0 en 30 s y La Referencia Perú 0 en 56 s. Justo después, `search` sacó 20 de La Referencia Perú en 6 s. No se reintentó porque, cuando tocaba, V11 ya estaba colgado.
- Repeticiones:
  - Q1_b_rep2 (los mismos argumentos 13 h después) respondió en **5 ms**: acierto de caché, descartado. Confirma la caché persistente de 24 h de `batch_search`.
  - Q1_a_rep2 y Q1_a_rep3 (`search`, que el día anterior tardó 9 s) superaron el plazo de 114 s.
  - No hay una segunda muestra válida de `search` para medir variación. Lo más parecido es Q1_d1, idéntica a Q1_a: 7,0 s frente a 8,9 s y exactamente los mismos 12 resultados en el mismo orden.
  - Las repeticiones de Q4 no se hicieron.

## (c) `batch_search` con 3 variantes frente a (d) 3 `search` seguidos y fusionados

| consulta | (c) batch: s / n | (d) 3 search: s totales / únicos | comparten | solo batch | solo search | pertinentes en todo el conjunto: batch / search |
|---|---|---|---|---|---|---|
| Q1 | 82,5 / 20 | 15,6 / 25 | 5 | 14 | 20 | 7 de 20 / **17 de 25** |
| Q2 | 94,8 / 20 | 74,5 / 12 | 8 | 12 | 4 | **16 de 20** / 11 de 12 |
| Q3 | 184,2 / 20 | 94,2 / 57 | 2 | 16 | 55 | 13 de 20 / **38 de 57** |
| Q4 | 228 (error) / 0 | 342 (3 errores) / 0 | – | – | – | no medible |

- **Q1**: lanzar los 3 `search` a mano fue 5 veces más rápido y dio más del doble de resultados pertinentes. Las variantes de batch arrastran trabajos sobre prevención, políticas y anemia en gestantes. Ejemplos de su top 10: «Desarrollo sostenible y prevención de anemia infantil en el Barrio Lluyllucucha…» y «Factores asociados a la anemia en gestantes del Centro Materno Infantil San Fernando…».
- **Q2**: es el único caso en que batch aporta. Encontró 12 resultados que los `search` no dieron, 16 de 20 pertinentes, y tardó solo un 27 % más. La razón es que `search` se queda corto con sinónimos: «hipertensión en ancianos» devolvió **1** resultado. Las fuentes encontraron 38, pero el filtro de pertinencia de repositorios de la 1.1.3 quitó 15 con la regla «al menos 2 de 2 palabras del tema (hipertension, ancianos)». `batch_search` no aplica ese filtro.
- **Q3**: batch tardó el doble y aportó un tercio de los pertinentes. Sus 20 resultados vienen solo de RRAAE, Oasisbr, ALICIA y BDTD. 5 de ellos traen año y ninguno trae resumen. Hay temas fuera del control vectorial, como «Dinâmica da diversidade bacteriana intestinal do mosquito Aedes aegypti…» y «Dengue virus serotype 1 effects on mosquito survival…».

## Calidad de los resultados

- **Pertinencia media en el top 10, según mi juicio** (sin errores ni caché):

  | grupo | precisión top 10 | pertinentes medios en top 10 | según `esPertinente` |
  |---|---|---|---|
  | `search` | 68 % | 5,3 | 80 % |
  | `batch_search` con 1 consulta | 52 % | 2,7 (incluye la respuesta vacía) | 72 % |
  | `batch_search` con 3 variantes | 73 % | 7,3 | 100 % |

- **`esPertinente` sobrestima la pertinencia** entre 10 y 27 puntos. Solo mira el título y acepta palabras sueltas. Ejemplo: «Factores asociados a la anemia en gestantes del Centro Materno Infantil…» cuenta como pertinente para anemia infantil porque contiene «infantil». En Q3_c dio 10 de 10 cuando mi juicio fue 5 de 10.
- **Duplicados**: ninguno en `search`. `batch_search` con variantes tuvo 1 en Q1_c y 2 en Q3_c, a pesar de que deduplica.
- **Año**: lo traen el 93 % de los resultados de `search`, el 87 % de batch con 1 consulta y el 70 % de batch con variantes (5 de 20 en Q3_c).
- **Resumen**: 79 % en `search`, 87 % en batch con 1 consulta y 37 % en batch con variantes.
- **DOI**: casi nunca (9 % en `search`, alrededor del 1 % en batch). Lo que sí suele venir es un handle: 71 % de los resultados de `search` tienen DOI o handle, frente al 47 % y 73 % de batch.
- **PDF directo: 0 de 217.** El campo `pdfUrl` siempre viene relleno, pero nunca apunta a un PDF: en 142 casos es un handle y en 75 una página del artículo (casi siempre OJS). Hay que pasar por `resolve_pdf`.
- **Universidad y país** (3 muestras por llamada):
  - La universidad suele ser correcta para tesis con handle. Comprobé los prefijos: 20.500.12672 es UNMSM, 13084 es UNFV, 12692 es UCV, 12737 es UNAP, 12394 es Continental, 12727 es USMP y 10495 es la U. de Antioquia.
  - Algunas fuentes ponen un valor genérico en vez de la universidad: «Ecuador» en todo RRAAE, «Brasil» en Oasisbr y BDTD, «FapUNIFESP (SciELO)» en SciELO. En ALICIA aparece truncada como «Universidad Peruana».
  - **El país falla de forma sistemática en La Referencia**: `country = "_version"` en 60 de 70 resultados de La Referencia (Perú) y en 11 de 19 de La Referencia regional.
  - Hay además errores sueltos: «Genética de las poblaciones virales y transmisión del dengue» (IMSS, México) figura como `peru`, y «Fragilidad y factores asociados en adultos mayores…» (revista del Hospital Almanzor Aguinaga, Chiclayo) figura como `brasil`.

## Hallazgos del código (comprobados en `dist` instalado)

1. **`search` nunca se guarda en caché y `batch_search` sí, durante 24 h.** El MCP solo guarda la respuesta si trae `data.results`, y `/api/search` devuelve `data.sources` (`dist/routes/mcp.js`, línea 2386). Por eso las repeticiones solo benefician a `batch_search`. La clave es exactamente la herramienta más los argumentos, así que cualquier cambio en los argumentos la evita.
2. **`/api/search` ignora `maxSources`** aunque el esquema lo describe como «Max results to return». Lee `maxResults` (50 por defecto). Además limita cada fuente a 8 resultados antes de deduplicar. Por eso, con 2 fuentes, `search` rara vez llega a 20.
3. **`batch_search` usa spaCy aunque se pida `fastMode: true`.** Llama a `rerankByRelevanceSmart` sin el parámetro `skipSpacy`, mientras que `search` sí le pasa `fastMode`. Esto explica parte de los 50–100 s extra.
4. **`batch_search` limita cada consulta a 12 fuentes con el cliente `unknown`.** Con `latam`, que tiene 16, se quedan fuera SciELO, Redalyc, Timbó y El Salvador. Q3_b y Q3_c no consultaron SciELO, que en Q3_a aportó 3 resultados.
5. **`batch_search` no aplica el filtro de pertinencia de repositorios de la 1.1.3 ni la regla que quita ALICIA cuando ya está RENATI** (en `batch_search` corren ambas, y RENATI llama a ALICIA por dentro). En cambio, aplica un umbral de relevancia que recorta mucho (103 → 7 en Q1_b).
6. **El contexto de geolocalización es una variable global (`globalThis.__osmGeoResult`) que nunca se limpia.** Se rellena geocodificando el texto de la consulta de cualquier cliente. Ver «Incidencias».

## Incidencias y lo que no se pudo medir

- **V11 colgado desde las 13:49 UTC del 09/11 para todos los agentes.** Desde entonces, toda llamada de `search` o `batch_search` cuyos resultados traen universidad agotó su plazo (114 o 228 s). Les pasó también a B (`search` y `batch_search` con errores de plazo desde las 13:51) y a C (`batch_search` y `smart_search` desde las 13:52). `GET /api/health` seguía respondiendo 200 en 6 ms.
  - Qué muestran los registros:
    - Hasta las 13:43 el log de V11 dice `city=none`. Desde las 13:49 dice `city=vítor → region=arequipa`, luego `pueblo libre → lima` y luego `independencia → ancash`.
    - En `.cache/osm-geocode-cache.json` aparecen fragmentos de consultas ajenas mal geocodificados: «la caleta, peru» → Vítor (Arequipa), «de universidad, peru» → Pueblo Libre, «ramos guardia, peru» → Independencia (Áncash).
  - Por qué cuelga: con ese contexto activo, cada `search` calcula una «distancia» para cada universidad de sus resultados. Para eso geocodifica las universidades con Nominatim de una en una y con límite de velocidad (`rateLimitNominatim`). `uni-geo-cache.json` pasó de 8,9 KB a 10,6 KB entre las 14:10 y las 14:14 UTC y muchas entradas quedan en `null`.
  - Ejemplo: en mi diagnóstico de las 14:07, ALICIA devolvió 57 resultados en 4 s, pero la llamada no terminó antes del plazo. En cambio, PubMed, Crossref, DOAJ y OpenAIRE solos, cuyos resultados no traen universidad, respondieron en 1–4 s.
  - Es una causa probable, deducida de los registros y del código; no la verifiqué reiniciando V11, porque no estaba permitido. Hasta que se reinicie, cualquier consulta con un topónimo, de cualquier cliente, puede contaminar las búsquedas de todos los demás.
- **Problemas externos durante la prueba**: OpenAlex respondió HTTP 429 (limitado), PubMed 429 en `esummary`, CORE 401 (clave no válida) y Semantic Scholar 0 resultados. RENATI dio 0 en unos 30 s en casi todas las llamadas (solo funcionó en Q2_d2: 20 en 10,8 s). Ese tiempo de espera de RENATI explica por qué `search` con `peru` o `latam` tarda unos 31 s fijos.
- **No medido**:
  - Q4 completa: 6 llamadas con error de plazo.
  - Repeticiones de Q4.
  - Una segunda muestra válida de Q1 (a): dio error de plazo.
  - Una segunda muestra fresca de Q1 (b).
  - `search` con `fastMode=false`.
  - El reintento de Q2_b.
  - La «Q4S» preparada (global sin las fuentes caídas) no se lanzó porque el problema no era de una fuente.
  - La calibración de `maxSources` se resolvió leyendo el código en vez de con una llamada.
- El corte por límite de uso dejó 13 h entre Q1 y el resto, así que Q1 se midió con V11 más descansado.

## Conclusión: cuándo conviene cada una

- **Por defecto, `search`.** En las tres consultas medibles fue más rápido (de 1,4 a 8,7 veces), dio igual o más resultados pertinentes y trae más metadatos (año y resumen). Con `peru_fast` responde en menos de 10 s.
- **`batch_search` con una sola consulta no conviene nunca** con esta versión. Paga 50–100 s de reordenación con spaCy (aunque se pida `fastMode`), consulta menos fuentes (tope de 12) y recorta mucho la respuesta. Su única ventaja es que la repetición exacta sale de caché en milisegundos durante 24 h.
- **Para varias variantes, lanzar `search` en serie y fusionar suele ser mejor que `batch_search`**: en Q1 y Q3 fue más rápido y dio de 2 a 3 veces más pertinentes. `batch_search` con variantes solo vale la pena cuando `search` se queda corto por su filtro de repositorios con sinónimos, como «hipertensión en ancianos» en Q2. Ahí `batch_search` dio 16 pertinentes frente a 11, a cambio de un 27 % más de tiempo.
- **Antes de seguir comparando** habría que:
  - reiniciar V11 para limpiar el contexto de geolocalización global;
  - repetir Q4 y las muestras que faltan, sin otros agentes en paralelo;
  - revisar las claves de CORE y el límite de OpenAlex, que dejan `global` en 4 fuentes útiles.

Archivos: `resultados.csv`, `metricas.json`, `tablas.md`, `juicio.json` (mi juicio por título), `raw\*.json` (respuestas completas), `diag-d1.json` (diagnóstico por fuente) y `log.txt`, todos en esta carpeta.
