# Prueba C: puente MCP `letxinet-jobs` (LetXinet Suite 1.1.3)

Equipo: DESKTOP-TUI78FL. Puente: `C:\Program Files\LetXinet Suite\bin\mcp\letxinet-jobs-bridge.cjs`. V11 en `http://127.0.0.1:4003/api/mcp`, gateway del Desktop en `http://127.0.0.1:43123` (respondió `/health` = ok en las dos sesiones).

Cuándo se hizo:
- Sesión 1: 09/11/2026 00:46–00:48 UTC (pasos 1 y 2 con J1).
- Sesión 2: 09/11/2026 13:37–14:15 UTC (todo lo demás). La prueba se cortó unas 13 h por un límite de uso de la API.
- V11 se había reiniciado a las ~13:32 UTC (uptime de 1032 s a las 13:49). El agente C no lo reinició.
- Los agentes A y B usaban los mismos servicios a la vez. Las horas exactas de cada llamada están en `resultados.csv` para cruzarlas con las suyas.

Datos:
- `resultados.csv`: 53 filas.
- `registros.jsonl`: las mismas filas, más los títulos y la duración real de cada tarea.
- `raw\`: respuestas completas.
- `log.txt`: traza con horas.
- Scripts: `paso1.cjs` a `paso7.cjs`, `paso3b.cjs`, `ua-experimento.cjs`, `auditar-jobs.cjs` y `generar-csv.cjs`.

Vías probadas:
- `puente_mcp`: las herramientas `mcp__letxinet-jobs__*` desde esta sesión de Claude Code, como un cliente real. El tiempo de esta vía se tomó con `Get-Date` antes y después, así que incluye unos 5–20 s de latencia del propio agente. Sirve para ver cómo se comporta, no para cronometrar.
- `puente_script`: el puente lanzado con Node y JSON-RPC por stdio, con cronómetro en milisegundos.
- `directo`: `ClienteMcp('v11')` del harness.

---

## 1. Resumen en una frase

El puente funciona mecánicamente: devuelve el `task_id` en menos de 200 ms, los sondeos tardan menos de 20 ms y las tareas simultáneas no se pisan. Pero **en la 1.1.3 no evita los cortes por tiempo: los provoca**. El proceso que ejecuta la tarea se presenta ante V11 como `opencode/1.0`, y V11 le aplica un límite de **114 s**. Una llamada directa desde Node tiene **228 s**. En esta prueba, 6 de las 7 tareas largas del puente que no venían de la caché murieron exactamente a los 114 s. Al menos 2 de esas búsquedas sí terminaban por la vía directa: J1 en 117 s y J2 en 220 s.

## 2. Qué expone el puente (paso 1)

| Medida | Resultado |
|---|---|
| Arranque del proceso + `initialize` | 90 ms |
| `tools/list` | 1 ms, 5 herramientas: `gateway_call`, `gateway_poll`, `gateway_list_tools`, `gateway_chat`, `letxipu_local_call` |
| `gateway_list_tools` (script) | 1632 ms la primera vez; el GET directo a `/api/mcp/tools` tarda 48–96 ms |
| `gateway_list_tools` (MCP) | Funciona: 59 herramientas del gateway (V11, OSM, web_search, etc.) |

Detalle: el texto de `gateway_list_tools` dice «Wrapper ofrece 4 meta-tools» y no menciona `letxipu_local_call`, que es la quinta y la más útil. La descripción de `gateway_poll` habla solo de `gateway_call`, aunque también recoge las tareas de `letxipu_local_call`.

## 3. `search` con y sin puente (paso 2)

Argumentos: `maxSources 20`, `fastMode true`. El puente usa la llamada síncrona de `letxipu_local_call`.

| Consulta | Puente (script) | Directo | Puente (MCP)* | ¿Coincide con directo? |
|---|---|---|---|---|
| J1 «tuberculosis pulmonar adherencia al tratamiento» [peru_fast] | 7,6 s, 34 resultados (1.º en correr) | 9,3 s, 34 | 22,2 s, 34 | Sí, idéntico (34/34, mismo orden) |
| J2 «salud mental estudiantes universitarios» [latam] | 34,4 s, 50 | 61,1 s, 50 (1.º en correr) | – | **No: 1 título común de 50** |
| J3 «climate change coffee production» [global] | 15,0 s, 50 | 10,2 s, 50 | 38,9 s, 50 (1.º en correr) | Script: idéntico. MCP: 42/50 comunes |

\* El tiempo de la vía MCP incluye la latencia del agente.

Conclusiones:
- **El puente no añade costo apreciable a `search`.** Arranca, inicializa y llama a V11 en unos pocos milisegundos de diferencia. Las diferencias de tiempo vienen de las fuentes externas, no del puente.
- **Por qué J2 no coincide:** no es culpa del puente. En la llamada directa respondieron con resultados solo 4 fuentes de `latam`; la mayoría agotó su tiempo a los 40–61 s. En la llamada por el puente, 34 s después, respondieron 9. Las fuentes latinoamericanas son muy inestables entre una llamada y la siguiente, sobre todo con otros agentes cargando el servicio.
- J3 por la vía MCP (42/50 comunes) es la misma variación: otra hora, otra mezcla de fuentes.
- **V11 no guarda `search` en caché.** Repetir J1 directo tardó 4,4 s, no menos de 0,5 s. En `routes/mcp.js` solo se guarda en caché si `result.data.results` no está vacío, pero `search` devuelve `data.sources`. `batch_search` sí se guarda: repetirlo tardó 156 ms.
- **V11 ignora `maxSources: 20`:** devolvió 34 y 50 resultados.
- La respuesta MCP de J3 pesó 64 KB y el cliente la desvió a un archivo por tamaño. Pedir 20 resultados no reduce lo que llega.

## 4. `batch_search` por el puente (paso 3)

Variantes usadas:
- J1: 3 variantes sobre tuberculosis [peru_fast].
- J2: 3 sobre salud mental universitaria [latam].
- J3: 3 sobre café y clima [global].

Todas con `maxResults 20` y `fastMode true`. El puente recibe la tarea y se sondea con `gateway_poll` cada 30 s.

| Caso | task_id en | Duración real de la tarea | Sondeos | Total hasta el resultado | Resultado puente | Directo (mismos argumentos) |
|---|---|---|---|---|---|---|
| J1, puente y directo **a la vez** | 173 ms | 108,0 s | 4 | 120,3 s | 20, OK | 55,6 s, 20. Idéntico (las dos sin ALICIA, que devolvió 0) |
| J1, vía **MCP** (+`filterFalsePositives:false` para saltar la caché) | ~5 s* | 114,2 s | 4 | ~136 s* | **Error −32001: «exceeded its deadline of 114006ms»** | 117,3 s, **20, OK** |
| J2 secuencial (directo primero) | 19 ms | 114,1 s | 4 | 120,1 s | **Error −32001 a 114 s** | 220,4 s, **20, OK** |
| J3 secuencial (puente primero) | 35 ms | 114,1 s | 4 | 120,1 s | **Error −32001 a 114 s** | 228,1 s, error −32001 a 228 s (fallaron las dos) |
| J1 repetido directo | – | – | – | – | – | 156 ms (caché) |

\* Medido a mano, incluye la latencia del agente.

### Causa del corte a 114 s

Se comprobó en el código y con un experimento.

En el código:
- El script que ejecuta cada tarea, generado por `launchLetxipuLocalJob`, envía `User-Agent: opencode/1.0`.
- V11 (`dist/utils/client-detection.js`) detecta `opencode` y le da un techo de 120 s. El límite efectivo es `min(base, 120 000 × 0,95) = 114 000 ms`, aunque la base de `batch_search` es 360 s y la de `smart_search` 300 s.
- Una petición desde Node con el User-Agent por defecto cae en `unknown`, que tiene 240 s de techo y 228 s de límite efectivo.
- La llamada síncrona del puente (`invokeLetxipuLocal`) no envía User-Agent, así que también cae en `unknown`. El puente es incoherente consigo mismo.

El experimento (`ua-experimento.cjs`): la misma `batch_search`, directa y simultánea, cambiando solo el User-Agent. Con `opencode/1.0` se cortó a **114 029 ms**; con el de Node, a **228 018 ms**. En ese momento V11 estaba tan cargado que ninguna de las dos terminó, pero el límite lo fija el User-Agent y no el puente en sí.

Es decir, la tarea en segundo plano existe para escapar del corte de unos 120 s de OpenCode, pero se declara OpenCode ante V11 y recibe ese mismo corte.

### ¿Coincide el resultado con el directo?

- Solo hubo una tarea del puente que terminó bien sin venir de la caché: J1 a la vez. En ese caso los 20 títulos fueron idénticos y en el mismo orden.
- En el resto, el puente no devolvió resultados por el corte.

### Coste del sondeo

Con sondeos cada 30 s, el cliente se entera de media unos 15 s tarde, y como máximo 30 s. J1: la tarea terminó a los 108 s y el cliente lo supo a los 120 s.

Además, al correr J1 por el puente y por la vía directa a la vez, la tarea tardó el doble (108 s frente a 56 s). Parece que compitieron por el limitador de proveedores de V11.

## 5. `smart_search` por el puente (paso 4, J1)

| Vía | task_id en | Tarea | Sondeos | Total | Resultado |
|---|---|---|---|---|---|
| Puente (script) | 20 ms | 114,1 s | 4 | 120,1 s | **Error −32001 a 114 s** |
| Directo (`filterFalsePositives:false`) | – | – | – | 120,1 s | `success: true` pero **0 resultados**, sin error. Solo informa `queriesUsed` (2 variantes) |
| Puente (MCP) | ~4 s* | 114.2 s | 1 + fin leído del archivo | 118 s* | **Error: Tool smart_search exceeded its deadline of 114009ms** |

\* Medido a mano, incluye la latencia del agente.

`smart_search` no dio resultados por ninguna vía. Por el puente se corta a 114 s. La vía directa devuelve una lista vacía con `success: true` justo a los 120 s, lo que apunta a un límite interno de 120 s en V11. Es un fallo silencioso de V11, no del puente, pero el puente no lo compensa. Con la misma consulta, `search` simple dio 34 resultados en 7–9 s.

## 6. `gateway_call` (paso 5; el Desktop estaba abierto)

| Herramienta | Vía | Resultado |
|---|---|---|
| `list_sources` (rápida) | puente → gateway | 29 ms, 39 fuentes. Directo a V11: 111 ms, 39 |
| `health_check` (rápida) | MCP → gateway | OK, síncrona |
| `pdf_smart_summary` arXiv 1706.03762 (larga) | puente → tarea en el gateway | task_id en 41 ms; tarea de 37,5 s; 2 sondeos; **60,1 s hasta el resultado**. Resumen correcto: 15 páginas, 5716 palabras, secciones detectadas |
| `pdf_smart_summary` (misma URL) | directo V11 | 14,3 s, OK. Corrió después, con el PDF probablemente ya en caché |

- Funciona. Para `pdf_smart_summary` el envoltorio de tarea sobra: su límite base en V11 es de 90 s y el sondeo cada 30 s añadió 22 s.
- Las tareas de `gateway_call` van al gateway (`/api/mcp/call`) sin User-Agent, así que no tienen el problema de los 114 s.
- `gateway_call` con `search`, `smart_search` o `batch_search` no va al gateway: el puente lo desvía en silencio a V11 local. Para `smart_search` y `batch_search` eso implica el corte de 114 s.

## 7. Errores y casos raros (paso 6)

| Caso | Respuesta del puente | ¿Es claro? |
|---|---|---|
| `gateway_poll` con task_id inventado | `STATUS=NOT_FOUND` + «result_len=0 (todavia no listo, sondea en 30s)», con `isError=false` | **No.** Invita a seguir sondeando algo que no existe |
| `gateway_poll` sin task_id | «task_id requerido», `isError=true` | Sí |
| `letxipu_local_call` con herramienta inexistente | «LetXipu V11 error [-32601]: Unknown tool: …», `isError=true`, 19 ms | Sí |
| `letxipu_local_call` sin `tool` | «tool name requerido» | Sí |
| `gateway_call` con herramienta inexistente | `{"success":false,…"Unknown tool…"}` con `isError=false`, 4,1 s | A medias: el cliente no lo ve como error |
| `search` sin `query` | «[-32602] Invalid input for "search" — field query…» | Sí |
| Números y booleanos como texto (`maxSources:"5"`, `fastMode:"true"`) | El puente los convierte y funciona | Bien |
| `batch_search` con `maxResults:"muchos"` | Lanza la tarea igual. Al sondear: `STATUS=DONE` con un error JSON-RPC −32602 dentro | **No.** Se podía validar antes y «DONE» engaña |
| Tareas cortadas a 114 s (pasos 3, 4 y 7) | `STATUS=DONE` y el error −32001 dentro del JSON | **No.** El cliente tiene que analizar el sobre para saber que falló |
| Tarea que falla de verdad (simulado: V11 en un puerto cerrado, puente propio con `JOBS_DIR` y `LETXIPU_LOCAL_URL` propios) | `STATUS=ERROR` + «result_len=0 (todavia no listo, sondea en 30s)». El motivo real (`connect ECONNREFUSED`) queda en `_out.json` y **no se muestra** | **No.** Un agente seguiría sondeando para siempre |
| `gateway_poll` con task_id relativo (`..\..\…\fuera`) | Leyó `fuera_status.txt` y `fuera_out.json` fuera de la carpeta de jobs | **Fallo de seguridad (path traversal).** El task_id no se valida. Lee cualquier `*_status.txt` / `*_out.json` alcanzable |
| Método MCP desconocido (`resources/list`) | −32601 «method not found» | Sí |
| Sondear antes de que termine | `STATUS=PENDING`, en 4–9 ms, sin efectos secundarios | Bien |

## 8. Varias tareas a la vez (paso 7)

Se lanzaron dos `batch_search` por el mismo proceso del puente sin esperar entre ellas: K1 con 2 variantes de J1 y K2 con 2 de J2, ambas [peru_fast] y `maxResults 15`.
- Recibieron task_ids distintos en 39 y 41 ms, sin choques de archivos.
- Las dos pasaron a DONE en el mismo sondeo (4 rondas, 120 s).
- **Las dos se cortaron a 114 s** (−32001, 0 resultados).

Mecánicamente el puente las aguanta bien. El resultado depende del límite de 114 s y de la carga de V11, que en ese momento estaba muy alta: una `batch_search` [peru_fast] de 2 variantes no terminó ni en 228 s por la vía directa (ver el experimento del User-Agent).

## 9. `gateway_chat` (paso 8, una sola vez)

- Mensaje: «Responde solo con la palabra OK.», con el modelo por defecto `gemini-2.5-flash`.
- Respuesta tras unos 7 s, `isError=false`, con el flujo SSE crudo dentro de `{"raw": …}`.
- El flujo pasa por los nodos `start`, `guardrail` y `agent_plan` y termina en `{"type":"error","error":"API key not valid. Please pass a valid API key."}`.
- Conclusión: falla por clave no válida y el puente no lo marca como error.

## 10. Carpeta de jobs: tareas colgadas y archivos huérfanos

Revisado con `auditar-jobs.cjs` (salida en `auditoria.txt`). Estado al cierre:

- La carpeta compartida tiene **12 tareas y 59 archivos**: 2 de antes de la prueba y 10 creadas por el agente C. Nadie los borra; cada tarea deja 5 archivos, incluido un `_runner.cjs` con rutas absolutas.
- No quedaron runners colgados: todos los PID terminaron, salvo la tarea `smart_search` lanzada por MCP a las 14:12, que terminó a las 14:14:16 con el mismo error de 114 s.
- De las 10 tareas del agente C, 8 están en `DONE` aunque llevan un error dentro: 7 por el límite de 114 s y 1 por validación. A esas se suma la `smart_search` por MCP, también cortada a 114 s. Solo 2 son resultados buenos: J1 `batch_search` y `pdf_smart_summary`.
- Las pruebas de error (V11 inalcanzable simulado y el path traversal) se hicieron en una carpeta propia, `jobs-prueba-errores`, para no ensuciar la compartida.
- No se borró nada de la carpeta compartida.

## 11. Problemas encontrados (por gravedad)

1. **Corte autoimpuesto a 114 s** en `smart_search` y `batch_search` lanzadas como tarea. El runner envía `User-Agent: opencode/1.0`. Ejemplo: J2 `batch_search` falla a los 114 s por el puente y termina en 220 s, con 20 resultados, por la vía directa.
   - Arreglo sugerido: que el runner no se identifique como OpenCode. Puede omitir la cabecera, o mejor usar una propia como `letxinet-jobs/1.x` con un techo largo (p. ej. 600 s) en `CLIENT_CEILINGS_MS`.
2. **`gateway_poll` oculta los fallos:**
   - `ERROR` y `NOT_FOUND` responden «todavia no listo, sondea en 30s» y no muestran el motivo.
   - Los errores JSON-RPC (límite de tiempo, validación) quedan como `STATUS=DONE`.
   - Arreglo: que el runner marque ERROR cuando la respuesta trae `error` o `success:false`, que `gateway_poll` muestre el contenido con `isError=true`, y que `NOT_FOUND` diga «no existe».
3. **Path traversal en `gateway_poll`:** el `task_id` no se valida contra `^[\w-]+$`.
4. **Sin limpieza:** cada tarea deja 5 archivos (`_req.json`, `_out.json`, `_status.txt`, `_pid.txt` y un `_runner.cjs` con rutas absolutas). Nadie los borra y no hay herramienta para cancelar ni limpiar tareas.
5. **No se validan los argumentos antes de lanzar la tarea.** El error llega uno o varios sondeos después.
6. `gateway_call` con herramienta inexistente y `gateway_chat` con error de clave devuelven `isError=false`.
7. **Resultados pesados:** `gateway_poll` devuelve el sobre JSON-RPC completo con el resultado escapado como texto (doble codificación). Un `search` con `maxSources 20` pesa hasta 64 KB.
8. **Textos desactualizados:** «4 meta-tools» en `gateway_list_tools`; `gateway_poll` dice ser solo para `gateway_call`.

Problemas de V11 vistos de paso (no son del puente):
- `search` nunca entra en caché (`data.sources` frente a `data.results`).
- `maxSources` se ignora.
- `smart_search` devuelve 0 resultados con `success:true` a los 120 s.
- `batch_search` [global] y [peru_fast] superó los 228 s con carga.
- ALICIA devolvió 0 en algunas llamadas.
- Las fuentes `latam` varían mucho de una llamada a otra.

## 12. Conclusión: ¿cuándo usar `letxinet-jobs` y cuándo llamar directo?

- **`search`: llamar directo** (servidor `letxinet-v11`). Por el puente funciona igual y sin costo apreciable, pero no aporta nada. Solo tiene sentido si el cliente no tiene otro servidor configurado.
- **`batch_search` y `smart_search`: en la 1.1.3, llamar directo** desde clientes que esperan más de 2 minutos, como Claude Code o Claude Desktop (300 s). Así se tienen 228 s de margen en V11.
  - Por el puente se tienen solo 114 s, más hasta 30 s de retraso por el sondeo.
  - El puente solo compensa en un cliente con corte duro de unos 120 s (OpenCode). Ahí la ventaja es que el cliente no se cuelga y recibe el `task_id` al instante, pero la búsqueda tiene el mismo tiempo máximo que una llamada síncrona.
  - Si una búsqueda no cabe en 114 s, conviene partirla: menos variantes, `peru_fast` en vez de `latam` o `global`, o varias `search` sueltas.
- **`gateway_call` para PDFs** (`pdf_smart_summary` y similares): funciona y no tiene el problema del User-Agent. Para documentos que de verdad pasan de 2 minutos es una opción válida; para PDFs normales la llamada directa es más rápida.
- **Antes de recomendar el puente para tareas largas** hay que corregir el User-Agent del runner y la forma en que `gateway_poll` informa de los errores. Con esos dos cambios, el puente sí cumpliría su propósito.
