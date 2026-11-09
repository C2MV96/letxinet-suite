# Prueba B: V11 (`search` y `batch_search`) combinado con OSM

LetXinet Suite 1.1.3, laptop DESKTOP-TUI78FL. Las horas son UTC; en Perú son 5 horas menos.

- **Ronda 1 de OSM:** 09/11 00:45–00:55 UTC (08/11 a las 19:45 en Perú).
- **Resto de la prueba:** 09/11 13:37–14:28 UTC. Se retomó tras el corte por límite de uso.
- **V11 se había reiniciado:** a las 13:32 UTC, según el *uptime* de `health_check`. Por eso la caché de la noche anterior ya no servía.

Datos:

- **Llamadas una por una:** `resultados.csv`. Son 76 filas: 72 llamadas reales y 4 filas sintéticas, que fusionan las 3 `search` del paso 3c.
- **Respuestas crudas:** `crudo.jsonl`.
- **Juicio manual de cada título:** `juicio.json`, que genera `juzgar.cjs`.
- **Solapes con los agentes A y C:** `solapes.txt`.

En las columnas de pertinencia del CSV, «7 (kw 5)» significa 7 títulos pertinentes según mi juicio y 5 según `esPertinente` con palabras clave del tema y del lugar. Las palabras clave están en `analizar.cjs`.

---

## 0. Resumen en una frase

**OSM solo sirvió para geocodificar.** Overpass y OSRM no responden desde esta red, así que `find_nearby_places`, `explore_area` y `polygon_from_admin` fallaron siempre. Las instituciones se sacaron de Nominatim.

**V11 encontró el tema pero casi nunca el lugar.** En los tres lugares, solo 1 título del top 10 trataba el tema en el lugar: un caso de dengue en el Hospital La Caleta de Chimbote. Eso pasó con o sin datos de OSM.

**Con tres agentes a la vez, V11 se atascó unos 20 minutos.** Todas las `search` y `batch_search` vencieron su plazo del servidor: 114 s para `search` y 228 s para `batch_search`.

---

## 1. Línea base de OSM (paso 1)

| Llamada | Intentos | Resultado | Tiempo |
|---|---|---|---|
| `geocode_address` (lugar e instituciones) | 13 | 11 correctas y 2 `LOW_CONFIDENCE_RESULTS` | **mediana 986 ms** (452 ms a 15,9 s; el pico fue «universidad, Chimbote») |
| `find_nearby_places` (universidades u hospitales, 10 km) | 6 | todas sin respuesta en 60 s | 60 s |
| `explore_area` (5 km) | 3 | todas sin respuesta en 60 s | 60 s |
| `find_nearby_places` de diagnóstico (2 km, timeout 150 s) | 1 | `fetch failed` | 91,5 s |
| `polygon_from_admin` (Áncash, nivel 4; es del paso 5) | 1 | `fetch failed` | 35 s |

Comprobé la causa de tres maneras:

- **`osm_health`** devolvió `"overpass":{"status":"down"}` y `"osrm":{"status":"down"}`, con Nominatim en `ok`.
- **Un `curl` directo desde la laptop:** `overpass-api.de` no respondió en 20 s (HTTP 000), `router.project-osrm.org` dio HTTP 000 y Nominatim dio HTTP 200.
- **Conclusión:** es un bloqueo o caída de red externa, no un fallo de LetXinet. Ya pasaba en el harness del pool del 08/11 (h04: todo lo de Overpass en `RED fetch failed`).

Como Overpass no funcionaba, busqué las instituciones con Nominatim. Usé `geocode_address` con «universidad, <lugar>» y «hospital, <lugar>», con pausas de 1,2 s entre llamadas.

| Lugar | Universidades (OSM) | Hospital (OSM) |
|---|---|---|
| Chimbote | Universidad Tecnológica del Perú (Panamericana Norte); Universidad San Pedro (Jr. Huiracocha) | Nuevo Hospital La Caleta |
| Huaraz | Universidad Santiago Antúnez de Mayolo. Nominatim la encontró, pero el filtro de importancia del servidor la descartó (umbral 0,05) y la llamada devolvió error; el nombre solo aparecía en `discarded`. | Hospital Víctor Ramos Guardia Nivel III-1 (Independencia) |
| Arequipa | Universidad Tecnológica del Perú (2 sedes); Universidad Nacional de San Agustín | No hubo hospital útil. «hospital, Arequipa» devolvió «Hospital, Caravelí», que es un pueblo con ese nombre. «hospital in Arequipa» devolvió un hospital de La Florida, en Chile, y luego error. |

Dos lugares clave quedaron fuera porque Overpass no responde: la Universidad Nacional del Santa y el Hospital Regional Eleazar Guzmán Barrón, ambos en Nuevo Chimbote. Nominatim por texto solo da 1 a 3 candidatos.

---

## 2. V11 solo, sin datos de OSM (paso 2)

Usé `sources: ["peru_fast"]` y `fastMode: true`. En `search` puse `maxSources: 20` y en `batch_search` `maxResults: 20`.

| Lugar | Herramienta | ms | n | Tema top10 (yo / kw) | Lugar top10 (yo / kw) |
|---|---|---|---|---|---|
| Chimbote | search | 5 659 | 1 | 1 / 1 | 1 / 1 |
| Chimbote | batch_search | 77 342 | 1 | 1 / 1 | 1 / 1 |
| Huaraz | batch_search | 43 802 | 20 | **0** / 1 | 0 / 1 |
| Huaraz | search | 4 109 | 6 | 6 / 6 | 0 / 0 |
| Arequipa | search | 5 064 | 44 | 10 / 10 | 0 / 0 |
| Arequipa | batch_search | 196 910 | 20 | 10 / 10 | 0 / 0 |

**Medianas:** `search` 5,1 s y `batch_search` 77 s. Ninguna llamada fue acierto de caché.

Lo que se observa:

- **Chimbote solo dio 1 resultado.** ALICIA tenía el *circuit breaker* abierto (el log de V11 dice `Circuit open for alicia.concytec.gob.pe` a las 13:41:14). Respondió `found: 0` en 1 ms, así que solo contestó La Referencia. El usuario recibe `success: true` con 1 resultado y nada le avisa de que falta la fuente principal.
- **`batch_search` en Huaraz dio 20 resultados sin relación con el tema.** Todos eran de «calidad de servicio» en Huaraz, por ejemplo «Calidad del servicio educativo y nivel de aprendizaje… Huaraz – Áncash, 2024» y «Gobierno electrónico y calidad de servicio en la UGEL de Huaraz». `search` aplica por defecto un filtro de pertinencia que quitó 102 de 162 resultados («al menos 3 de 4 palabras del tema»). `batch_search` no lo aplica: `filterFalsePositives` vale `false` por defecto.
- **Arequipa: 10 de 10 títulos sobre el tema y 0 en Arequipa.** Son estudios nacionales o de otras regiones: Paruro (Cusco), Gorgor (Lima), Huancavelica e incluso Guayaquil (Ecuador). El filtro de `search` solo cuenta las palabras del tema («desnutricion, cronica, infantil») e ignora el lugar.
- **`maxSources` no limita el número de resultados.** Con `maxSources: 20`, Arequipa devolvió 44.

---

## 3. V11 con datos de OSM (paso 3)

Instituciones usadas:

- **Chimbote:** Universidad San Pedro y Nuevo Hospital La Caleta.
- **Huaraz:** Universidad Santiago Antúnez de Mayolo y Hospital Víctor Ramos Guardia.
- **Arequipa:** Universidad Nacional de San Agustín y Universidad Tecnológica del Perú.

### 3a. `search` con `location` y `university`

| Lugar | ms | n | Tema (yo / kw) | Lugar (yo / kw) | Comparación con el paso 2 |
|---|---|---|---|---|---|
| Chimbote | 2 998 | 1 | 1 / 1 | 1 / 1 | El mismo único resultado; ALICIA seguía sin responder. |
| Huaraz | 114 023 | 0 | — | — | Error: venció el plazo de 114 s en pleno atasco. |
| Huaraz (reintento) | 2 683 | **0** | — | — | Empeora: pasa de 6 resultados a 0. |
| Arequipa | 2 933 | 3 | 3 / 2 | 0 / 0 | Empeora: pasa de 44 resultados a 3, ninguno de Arequipa. |

`location` y `university` solo añaden palabras a la consulta; no filtran, como dice el propio esquema. El resultado es una consulta más larga y más estricta, que encuentra menos y no encuentra nada más local.

### 3b. `batch_search` con 3 consultas («tema + lugar», «tema + universidad 1», «tema + institución 2»), `maxResults: 60`

| Lugar | ms | n | Tema (yo / kw) | Lugar (yo / kw) | Duplicados | Nota |
|---|---|---|---|---|---|---|
| Chimbote | 217 408 | 60 | 10 / 10 | 1 / 1 | **7** | ALICIA aportó 189 y La Referencia 32 |
| Huaraz | 228 007 | 0 | — | — | — | Error de plazo (en atasco) |
| Huaraz (2.º intento) | 228 023 | 0 | — | — | — | Error de plazo |
| Huaraz (3.er intento) | 7 610 | 60 | **0** / 2 | 0 / 2 | 3 | ALICIA con *circuit breaker* abierto; solo La Referencia |
| Arequipa | 228 011 | 0 | — | — | — | Error de plazo, sin otros agentes activos |
| Arequipa (reintento) | 6 092 | 31 | 10 / 10 | 0 / 0 | 0 | ALICIA con *circuit breaker* abierto; solo La Referencia |

Ejemplos concretos:

- **Chimbote:** añadir «Universidad San Pedro» y «Nuevo Hospital La Caleta» no trajo nada de esas instituciones. El top 10 son los mismos estudios generales de dengue: Piura, Tingo María, Yurimaguas, Bagua y Wolbachia en Medellín. El único resultado local sigue siendo el caso del Hospital La Caleta.
- **Huaraz:** la consulta con «Hospital Víctor Ramos Guardia» sí trajo títulos de Huaraz, pero de otros temas. Por ejemplo «Muerte de tres neonatos en hospital de Huaraz», «Thrombocytopenic purpura and acute bartonellosis (Carrion's disease) in Huaraz, Peru» y «Factores de riesgo asociados a lesiones precancerosas del cuello uterino… Hospital Víctor Ramos Guardia». El nombre de la institución gana más peso que el tema.
- **Los duplicados vienen de una fuente a otra.** `batch_search` dice deduplicar globalmente, pero el mismo artículo aparece dos veces con la misma URL, una desde ALICIA y otra desde La Referencia. En Chimbote pasa 7 veces de 60, por ejemplo con «Dengue in Peru: chronicle of recurrent epidemics (1990-2023)…», «Peruvian plant resources as potential natural controllers…» y «Genetic and molecular diversity of Bacillus thuringiensis…».

### 3c. Tres `search` separadas, fusionadas sin duplicados (alternativa manual)

Las fusioné por turnos, uno de cada lista, y quité los títulos repetidos.

| Lugar | Modo | Tiempo total | n único | Repetidos quitados | Tema (yo / kw) | Lugar (yo / kw) |
|---|---|---|---|---|---|---|
| Chimbote | en paralelo | 114 021 ms | 0 | — | — | — (las 3 vencieron el plazo de 114 s) |
| Chimbote | en serie (reintento) | 2 100 ms | 9 | 0 | 9 / 9 | 1 / 1 (probable caché, ~0,5 s por llamada) |
| Huaraz | en serie | 12 763 ms | 12 | 1 | 10 / 9 | 0 / 0 |
| Arequipa | en serie | 137 430 ms | 47 | 4 | 10 / 10 | 0 / 0 |

En Arequipa, la primera llamada tardó 105 s: ALICIA respondió en 23 s y el resto fue la cola que dejó el atasco.

**`batch_search` frente a 3 `search` manuales:**

- **Tiempo:** las 3 `search` en serie tardaron entre 2 y 13 s sin atasco. El `batch_search` de 3 consultas tardó 217 s o venció el plazo de 228 s (3 de 6 intentos). Solo fue rápido, 6 a 8 s, cuando ALICIA estaba desactivada por el *circuit breaker*, es decir, con la mitad de las fuentes.
- **Pertinencia:** las `search` fusionadas tienen igual o mejor pertinencia temática y menos ruido, porque pasan el filtro de pertinencia de `search`. Además no traen duplicados.
- **Pertinencia local:** ninguna de las dos opciones la mejora.

**¿Mejoran los datos de OSM la pertinencia local?** No. En los tres lugares, el número de resultados pertinentes al lugar en el top 10 fue el mismo con y sin instituciones de OSM: 1 en Chimbote, 0 en Huaraz y 0 en Arequipa. Con `location` y `university` el número de resultados bajó (Huaraz de 6 a 0, Arequipa de 44 a 3). Con el nombre del hospital en `batch_search` llegaron resultados locales pero de otro tema.

**V11 no recupera material local que sí existe.** Hice 3 consultas directas a la API pública de ALICIA, por título:

- «dengue Chimbote»: 10 registros, entre ellos «Mejorando la atención en el paciente con dengue en el hospital regional Eleazar Guzmán Barrón – Nuevo Chimbote 2015» (ULADECH).
- «calidad agua Huaraz»: 13 registros, entre ellos «Evaluación mediante el índice de calidad de agua (ICA) del río Santa…» (UNASAM).
- «desnutrición crónica Arequipa»: 3 registros, entre ellos «Intervención de enfermería en el manejo de la desnutrición crónica… Microred Socabaya Arequipa» (UNSA).

Ninguno salió en el top 10 de V11. Su puntuación de lugar (`geoScore`) fue 0 en todos los resultados de `search`, y el filtro solo cuenta las palabras del tema.

---

## 4. Concurrencia

### 4a. Concurrencia diseñada (paso 4: mi `batch_search` de fondo, más OSM y 1 `search`)

| Medida | Ronda 1 | Ronda 2 | Mediana | Referencia |
|---|---|---|---|---|
| `search` sin carga | 2 028 ms | 1 192 ms | 1,6 s | — |
| `search` durante el batch | **10 935 ms** | 1 664 ms | 6,3 s | — |
| `batch_search` de fondo (3 consultas) | 25 579 ms (n=11) | 43 172 ms (n=17) | — | — |
| `geocode_address` durante el batch | 320 y 331 ms | 678 y 707 ms | **505 ms** | Línea base OSM: mediana 986 ms |
| `find_nearby_places` durante el batch | 60 s, timeout | 60 s, timeout | — | Igual que la línea base (Overpass caído) |

- **OSM no se ve afectado por V11.** Los `geocode_address` fueron incluso más rápidos que la línea base, porque son servicios separados.
- **La `search` se frena mientras corre un batch.** En la ronda 1, La Referencia respondió en 1,1 s y aun así la llamada tardó 10,9 s; los ~9,8 s restantes fueron espera interna detrás del batch. En la ronda 2 el efecto fue pequeño (1,7 s frente a 1,2 s).
- **Advertencia:** en todo el paso 4, ALICIA tuvo el *circuit breaker* abierto (desde las 14:23:38, con 276 s para reiniciarse). Por eso los batch tardaron 26 a 43 s y no 77 a 217 s. El paso 4 mide V11 trabajando solo con La Referencia, y estos tiempos no se pueden comparar con los pasos 2 y 3.

### 4b. Concurrencia real entre agentes (A, B y C a la vez, 13:41–14:14 UTC)

Esta fue la observación más importante. Las horas vienen de `solapes.txt`, de los registros de A y C, y del log de V11, que solo leí.

- **Hasta las 13:51 V11 respondía, aunque lento.** Mis llamadas convivieron con 1 a 9 llamadas de A y C. Mi `batch_search` de Arequipa, de 197 s, coincidió con 5 de A y 2 de C.
- **De 13:51 a ~14:12 V11 quedó atascado.** Venció el plazo en todas mis `search`, incluso en una sonda con una sola fuente (`laref_peru`), y en mis `batch_search`. A y C registraron lo mismo: su `log.txt` y su `registros.jsonl` muestran `exceeded its deadline` desde las 13:53.
- **El log de V11 muestra una cola.** En la sonda «leishmaniasis cutánea Cusco», ALICIA respondió en 1 s (14:02:55). La `search` terminó su posproceso a las 14:08:17, 5 min 22 s después, cuando el cliente ya había recibido el error de plazo (14:04:48). Otras búsquedas terminaron con 6 a 9 minutos de retraso.
- **El fallo es interno de V11.** Mientras tanto, la API de ALICIA respondía en 0,8 s desde la misma laptop.
- **El trabajo vencido no se cancela.** Las búsquedas siguen procesándose después de vencer el plazo, de modo que la cola crece mientras lleguen peticiones nuevas.
- **V11 se recuperó solo hacia las 14:12,** cuando A y C dejaron de enviar peticiones. Después de las 14:14 no había llamadas de otros agentes.
- **Hubo efectos secundarios:** el *circuit breaker* de ALICIA se abrió dos veces (13:41 y 14:23). Ahí V11 devuelve resultados solo de La Referencia sin avisar.
- **Qué hice yo:** paré mi paso 3 a las 13:59 para no alimentar la cola. Esperé midiendo la cola en el log, sin enviar llamadas, y reanudé cuando una sonda respondió en 1,3 s. En la reanudación ejecuté las 3 `search` en serie.

---

## 5. Calidad de los metadatos (360 resultados de llamadas correctas)

- **DOI o handle:** casi todos tienen handle o URL de repositorio (por ejemplo 42 de 44 o 30 de 31). Solo **4 de 360** traen el campo `doi` lleno.
- **PDF:** **0 de 360** tienen un enlace directo a PDF. `pdfUrl` siempre viene lleno, pero en 237 casos es un `hdl.handle.net` y en el resto una página del repositorio o de la revista. Hay que resolverlo con `resolve_pdf`.
- **Duplicados:**
  - `search`: 0.
  - `batch_search`: 7 de 60 en Chimbote y 3 de 60 en Huaraz; son el mismo artículo desde ALICIA y La Referencia, con la misma URL.
  - 3 `search` fusionadas: 1 a 4 títulos repetidos entre consultas, que quité al fusionar.
- **País:** el campo `country` vale **`_version`** en 188 de 360 resultados, todos los de La Referencia. Es un error de mapeo. Los de ALICIA dicen `peru`, que es correcto.
- **Universidad, revisada en 3 resultados (más un caso extra):**
  1. «Efectos de la contaminación de los relaves mineros sobre la calidad del agua del río Colca»: Universidad Nacional de San Agustín de Arequipa, handle 20.500.12773, que es el de la UNSA. **Correcto.**
  2. «Variación de la calidad del agua del río Chinchán…»: Universidad Nacional del Centro del Perú, handle 20.500.12894 (UNCP). **Correcto.**
  3. «Eficacia de las ovitrampas… Tingo María 2018»: dice **Instituto Peruano de Energía Nuclear**, pero la URL es `repositorio.udh.edu.pe`, de la Universidad de Huánuco. **Incorrecto.**
  4. Caso extra: «Evaluación de la susceptibilidad/resistencia del adulto Aedes aegypti a la cipermetrina» dice «Universidad Peruana», un nombre truncado. Su handle 20.500.12959 es de EsSalud. **Incorrecto.**
  - En los artículos de revista que vienen de La Referencia, la «universidad» es la editorial de la revista (por ejemplo UNMSM para *Anales de la Facultad de Medicina*), no la filiación de los autores.

## 6. Paso 5 (reducido)

- **`polygon_from_admin` (Áncash, nivel 4):** `fetch failed` en 35 s, porque Overpass no responde.
- **`fastMode=false` en Huaraz** («calidad del agua y relaves mineros Huaraz»): 11,8 s y **0 resultados**, frente a 4,1 s y 6 resultados con `fastMode=true`. ALICIA tenía el *circuit breaker* abierto en ese momento, así que no es una comparación limpia. Lo que sí se ve es que fue más lento y no mejoró la pertinencia.

## 7. Errores y lo que no se pudo medir

- **V11:** 11 llamadas vencieron el plazo (`Tool "search" exceeded its deadline of 114004ms` o `batch_search … 228011ms`). 9 ocurrieron durante el atasco con varios agentes. Los 2 `batch_search` de las 14:13 (Huaraz) y las 14:17 (Arequipa) fueron justo después, mientras la cola todavía se vaciaba.
- **OSM:** 13 llamadas a Overpass fallaron (timeout o `fetch failed`) y hubo 2 `geocode_address` con `LOW_CONFIDENCE_RESULTS`.
- **No se pudieron medir:**
  - Los nombres de universidades y hospitales por radio con `find_nearby_places`, ni `explore_area`.
  - Un `batch_search` de 3 consultas con ALICIA activa en Huaraz y Arequipa.
  - Un paso 4 con ALICIA activa.
- **3 llamadas perdidas:** las 3 `search` en paralelo de Huaraz del primer intento (13:58:52) no quedaron registradas, porque paré el script; habrían vencido el plazo.
- **Probables aciertos de caché:** la repetición de las 3 `search` de Chimbote (543, 546 y 1 007 ms) repite consultas que el servidor terminó de procesar tras el atasco. Están marcadas «probable» en el CSV y no las usé para comparar tiempos.

---

## 8. Conclusión: ¿qué combinación conviene para investigar un lugar?

1. **Usa OSM (Nominatim) solo para fijar el lugar y obtener nombres de instituciones.** Desde esta red, Overpass y OSRM no funcionan, así que no cuentes con `find_nearby_places` ni con `explore_area`.
2. **No pases las instituciones como `university` o `location`.** No filtran, solo alargan la consulta y reducen los resultados (Huaraz de 6 a 0, Arequipa de 44 a 3).
3. **Para buscar, usa varias `search` cortas en serie, una por idea:** «tema + ciudad», «tema + región o cuenca» y, si acaso, «tema + universidad local». Fusiónalas tú. Tardan segundos, pasan el filtro de pertinencia y no traen duplicados.
4. **Evita `batch_search` para investigar un lugar.** Con 3 consultas suele pasar de 200 s o vencer el plazo de 228 s. No filtra falsos positivos (en Huaraz dio 20 de 20 sobre «calidad de servicio»). Duplica resultados entre fuentes. No mejora la pertinencia local.
5. **No ejecutes varias búsquedas de V11 a la vez,** ni de un mismo agente ni de varios. V11 forma una cola interna que no cancela el trabajo vencido y se bloquea durante minutos.
6. **Revisa a mano la pertinencia local.** El campo `stats` revela si ALICIA respondió `found: 0` en pocos milisegundos (*circuit breaker* abierto). V11 no prioriza el lugar: en esta prueba solo 1 de los títulos del top 10 era del lugar pedido, aunque ALICIA tiene tesis locales sobre los tres temas. Para el material local conviene una búsqueda por título en el repositorio o en ALICIA, con la ciudad en el título.
