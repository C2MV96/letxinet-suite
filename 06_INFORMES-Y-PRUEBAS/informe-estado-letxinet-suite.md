# Informe de estado — LetXinet Suite

**Fecha:** domingo 01/11/2026, 13:56 (hora de Lima)
**Equipo:** DESKTOP-TUI78FL · Windows 10 Pro
**Instalación:** `C:\Program Files\LetXinet Suite` · Logs: `C:\ProgramData\LetXinet Suite\Logs`

## 1. Resumen

| Componente | Estado | Comentario |
|---|---|---|
| MCP-V11-Local (búsqueda académica / PDF) | 🟢 OK | 28 herramientas; health en 170 ms; 0 circuitos abiertos |
| OSM-MCP (mapas / rutas) | 🟡 Degradado | Nominatim OK; **OSRM y Overpass caídos** (servicios externos) |
| MarkItDown API (conversión a Markdown) | 🟢 OK | PyMuPDF4LLM en línea |
| Sidecar spaCy (interno de V11) | 🟡 Con errores | Excepciones en `/concept_match` hoy a las 08:43 |
| LetXinet Desktop HF (gateway) | 🟢 OK | v12.0.0, backend local listo, 39 fuentes |
| Integración con Claude Code | 🟢 OK | 3 servidores MCP conectados |
| Logs | 🔴 Atención | **877 MB** acumulados; 181 archivos rotados de V11 |

Hoy la suite funcionó y dio soporte al trabajo de la tesis: el subagente de referencias descargó 17 PDFs de acceso abierto. En los logs de hoy, V11 registra 44 `search`, 23 `resolve_pdf`, 5 `batch_search`, 2 `download_pdf` y 2 `pdf_metadata`.

## 2. Servicios de Windows (NSSM)

```
Name                     Status  StartType
LetXinetSuiteMarkitDown  Running Automatic
LetXinetSuiteMCPV11      Running Automatic
LetXinetSuiteOSMMCP      Running Automatic
```

Uptime de V11 y OSM: unas 21,3 h (arrancaron el 31/10 a las ~16:36).

## 3. Puertos

| Puerto | Proceso | Función |
|---|---|---|
| 4003 | MCP-V11-Local | MCP V11 (`/api/mcp`) |
| 4002 | python (spaCy) | Sidecar NLP de V11, solo local |
| 7082 | osmmcp | MCP OSM (`/mcp`) |
| 9090 | osmmcp | Métricas Prometheus |
| 7860 | python (uvicorn) | MarkItDown API, solo local |
| 43123 | LetXipu Desktop HF | Gateway y app de escritorio |

⚠️ **4003 y 43123 escuchan en `0.0.0.0`**: son accesibles desde la red local, no solo desde este equipo. 9090 escucha en todas las interfaces (`::`).

## 4. Pruebas de salud (en vivo)

```
GET  :4003/health        -> 200 (3070 ms, 1.ª llamada; luego ~170 ms)
     {"status":"ok","service":"letxipu-search-mcp","version":"11.0.0","tools":28,
      "engines":{"mineru":"available (precision API)","markitdown":"available","pdfParse":"available"}}
GET  :4003/health/gate   -> 200  {"status":"ok","criticalDomains":9,"openCircuits":0}
     (alicia.concytec.gob.pe con 1 fallo consecutivo, sin cortar)
MCP  V11 health_check    -> success, status ok (172 ms)
GET  :7860/              -> 200  {"status":"online","engine":"PyMuPDF4LLM"}
GET  :7860/health        -> 404  (no existe esa ruta; no es un fallo)
GET  :43123/health       -> 200  {"service":"letxinet-agent-gateway","version":"12.0.0",
                                   "mcpBackend":"local","mcpBackendReady":true,"activeSourcesCount":39}
MCP  OSM osm_health      -> {"status":"degraded",
                             "nominatim":{"status":"ok","latency_ms":532},
                             "osrm":{"status":"down","latency_ms":938},
                             "overpass":{"status":"down","latency_ms":3000}}
```

`claude mcp list`:

```
letxinet-v11:        http://127.0.0.1:4003/api/mcp (HTTP)  - √ Connected
letxinet-osm:        http://127.0.0.1:7082/mcp (HTTP)      - √ Connected
letxinet-markitdown: node .../markitdown-mcp.js            - √ Connected
```

## 5. Hallazgos en los logs

### 5.1 Logs sin control de tamaño — 🔴
- La carpeta de logs ocupa **877 MB**.
- V11 tiene 181 archivos rotados `mcp-v11-local.stdout-*.log` de unos 5 MB cada uno, desde el 01/08/2026.
- Hay picos de un archivo nuevo cada 1–2 minutos (01/08, 04/09, 08/09), lo que indica un nivel de log demasiado detallado.
- Además hay 28 copias `LetXinet-Suite.env.backup-*.txt`. Algunas son `backup-keys` y pueden contener claves de API en texto plano.

### 5.2 Conflictos de puerto en V11 (`EADDRINUSE :4003`) — 🟡
`mcp-v11-local.stderr.log` registra **450** errores `EADDRINUSE` en el puerto 4003:

```
code: 'EADDRINUSE', errno: -4091, syscall: 'listen', address: '0.0.0.0', port: 4003
Node.js v22.23.1
```

Son de arranques en los que otra instancia ya ocupaba el puerto: NSSM y la app de escritorio levantan V11 a la vez, o hay reinicios encadenados. Ahora mismo hay una sola instancia y responde bien. Existe un `parche-0-liberar-puertos.log` del 13/08, señal de que el problema ya era conocido.

### 5.3 Sidecar spaCy: excepciones en `/concept_match` — 🟡
Hoy, 01/11 a las 08:43:01, hubo 5 excepciones seguidas: `ERROR in app: Exception on /concept_match [POST]`. Antes hubo otra serie igual (08/09) y un `[spaCy] Timeout esperando al microservicio HTTP`.
- **Efecto:** falla la expansión semántica de las consultas, y `search` sigue funcionando con menor calidad de coincidencia.
- **Ruido:** los accesos normales del sidecar (`GET /health 200`) se registran como `level 50 [spaCy-Server ERR]` porque Flask escribe en stderr. Inflan el conteo de errores y el tamaño de los logs.

### 5.4 OSM: servicios externos caídos — 🟡
`osm_health` informa que OSRM (rutas) y Overpass (búsqueda de lugares por área) están caídos.
- **Herramientas afectadas:** `get_route_directions`, `route_fetch`, `analyze_commute`, `find_nearby_*` y `osm_query_bbox`.
- **Siguen funcionando:** la geocodificación y la geocodificación inversa (Nominatim).
- El OSM-MCP en sí no tiene errores: solo `level=INFO`, con respuestas 200.

### 5.5 `restart-suite.log` desactualizado
La última ejecución (30/08/2026) dice «no registrado, skip» para los 3 servicios: se lanzó con los servicios dados de baja. Ahora están registrados; no es un problema actual.

### 5.6 Resolución de PDFs (uso de hoy)
Cowork hizo muchas llamadas a `resolve_pdf` a través del gateway, que se percibieron lentas. Por eso el subagente de referencias pasó a Unpaywall, Crossref y PMC con tiempos de espera cortos.
- **Resultado:** 17 de 39 referencias descargadas.
- **Bloqueos:** 7 fueron bloqueadas por los sitios de origen (Elsevier, OUP, AHA, OPS, SciELO); no es un fallo de la suite.

## 6. Recomendaciones (de mayor a menor prioridad)

1. **Liberar espacio y limitar los logs.** Hay que borrar o comprimir los `mcp-v11-local.stdout-*.log` antiguos (unos 870 MB). Después, bajar el nivel de log de V11 a `info`/`warn` y fijar una rotación con límite de archivos (NSSM `AppRotateFiles`, `AppRotateBytes`, más una retención).
2. **Proteger los `.env.backup-keys-*`.** Hay que moverlos o borrarlos, porque pueden contener claves de API, y dejar uno solo cifrado o fuera de `ProgramData`.
3. **Evitar el doble arranque de V11.** La app de escritorio no debería lanzar su propio V11 cuando el servicio NSSM está activo; conviene usar `DESKTOP_ENDPOINT_MODE=local_only` y apuntar al 4003 existente.
4. **Cerrar puertos a la red.** Hay que hacer que 4003, 43123 y 9090 escuchen en `127.0.0.1`, o bloquearlos en el Firewall de Windows si no se usan desde otros equipos.
5. **Sidecar spaCy.** Hay que revisar la traza completa de `/concept_match`; en el log aparece truncada, así que conviene ejecutarlo en primer plano para verla. También conviene redirigir el log de acceso de Flask a `INFO` para que no cuente como error.
6. **OSM.** Si se usan rutas, conviene definir `OSRM_URL` y `OVERPASS_URL` alternativos en `LetXinet-Suite.env` (por ejemplo, `https://overpass.kumi.systems/api/interpreter`), o reintentar más tarde porque suelen ser caídas temporales.

## 7. Configuración en Claude Code (realizada hoy)

Se agregó a `~/.claude.json` (alcance de usuario), con respaldo en `~/.claude.json.bak-letxinet`:

```json
"letxinet-v11":        { "type": "http",  "url": "http://127.0.0.1:4003/api/mcp" },
"letxinet-osm":        { "type": "http",  "url": "http://127.0.0.1:7082/mcp" },
"letxinet-markitdown": { "type": "stdio", "command": "node",
                         "args": ["C:/Program Files/LetXinet Suite/MarkItDown/API/mcp-adapter/markitdown-mcp.js"],
                         "env": { "MARKITDOWN_API_URL": "http://127.0.0.1:7860" } }
```

Claude Desktop sigue usando `letxinet-gateway` (puerto 43123, a través del Addon) y `markitdown-api`, por lo que en la pestaña Code algunas herramientas aparecen duplicadas con otro prefijo.

*No se modificó nada de la suite durante este diagnóstico: solo se hicieron lecturas y llamadas de salud.*
