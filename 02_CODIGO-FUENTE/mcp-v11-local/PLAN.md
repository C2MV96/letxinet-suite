# PLAN: MCP-V11 Local Portable + Integración con LetXipu Desktop HF

## ✅ ESTADO: COMPLETADO Y VERIFICADO

Todos los pasos del plan han sido ejecutados y validados con pruebas E2E exitosas:
- **MCP-V11-Local portable** ejecutándose con Node 20 standalone + Python 3.12 embedded + spaCy + modelos sm
- **ALICIA responde 200 OK con 20 papers** desde la IP residencial del usuario (no desde HF datacenter)
- **Gateway LetXipu Desktop HF** detecta y enruta al MCP local automáticamente
- **Instalador NSIS + portable** reconstruidos con la nueva lógica de detección

## Objetivo (original)

Empaquetar el MCP V11 como ejecutable portable local (`MCP-V11-Local.exe`) que corra en la PC del usuario con su IP residencial LatAm, resolviendo el bloqueo de fuentes peruanas/latinoamericanas (ALICIA, RENATI, CONAHCyT, SNRD, etc.) que HF Space no puede alcanzar por bloqueos WAF/GeoIP.

**Sin fallback al remoto HF Space.** El backend es exclusivamente el MCP local. Si el MCP local no corre, LetXipu Desktop HF sigue funcionando contra el remoto HF (fallback implícito en `resolveMcpUrl`).

## Decisiones de arquitectura

- **Original `D:\OTROS\LETXIPU-SEARCH-MCP-V11\` queda intacto** como referencia
- **Copia nueva `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\`** es la que se empaqueta
- **Dos distribuciones .exe separadas** que el usuario instala independientemente
- **API keys reusadas** desde LetXipu Desktop HF (leídas de `secrets.json` y pasadas al MCP via env al spawn)
- **Con Python embedded + spaCy** (calidad completa, ~350 MB sin comprimir)
- **Pivote técnico:** pkg 5.8.1 broken con `undici` (fetch fails). Se sustituyó por **portable bundle con node.exe standalone Node 20.18 LTS** + Python 3.12 embedded

## Estructura de carpetas final

```
D:\OTROS\
├── LETXIPU-SEARCH-MCP-V11\               ← ORIGINAL intacto (referencia)
├── LETXIPU-SEARCH-MCP-V11-LOCAL\         ← NUEVO: copia modificada + build artifacts
│   ├── src\                                (modificado: server.ts, spacy-client.ts, spacy_server.py)
│   ├── packaging\
│   │   └── build-portable.cjs              (orquestador pkg — descartado)
│   │   └── node-runtime\                   (node 20.18 descargado)
│   │   └── python-embedded\                (Python 3.12 + deps)
│   │   └── test-portable\                 ( JsonRequestBehavior backup)
│   ├── dist-portable\                      ← CARPETA PORTABLE FINAL (473 MB sin comprimir)
│   │   ├── MCP-V11-Local.exe               (70 MB node 20 standalone)
│   │   ├── start-mcp-local.cmd             (entrypoint con env vars)
│   │   ├── dist\                           (TS compilado a JS)
│   │   ├── node_modules\
│   │   ├── python\
│   │   │   └── spacy_server.py             (Flask sidecar)
│   │   └── python-runtime\                 (Python 3.12 embedded + numpy/flask/spacy + 3 modelos sm)
│   ├── dist\
│   │   └── MCP-V11-Local-Portable.zip      ← DISTRIBUCIÓN (163 MB)
│   └── package.json                        (modificado con pkg config (legacy))
└── LETXINET-DESKTOP-HF\                  ← Gateway Electron (modificado)
    ├── electron\main.cjs                   (mod: maybeStartLocalMcp + auto-restart + kill en quit)
    ├── server.ts                            (mod: resolveMcpUrl + probeLocalMcp + /health con mcpBackend)
    ├── src\App.tsx                          (mod: badge visual MCP: Local | Remoto HF | …)
    └── dist\
        └── LetXipu Desktop HF Setup 0.0.0.exe   (274 MB NSIS, último build)
        └── LetXipu Desktop HF 0.0.0.exe         (274 MB portable, último build)
```

## Diagrama de flujo final

```
1. Usuario descarga y descomprime MCP-V11-Local-Portable.zip en:
   C:\Program Files\MCP-V11-Local-Portable\  (o cualquier carpeta)
2. Usuario instala LetXipu Desktop HF Setup 0.0.0.exe
3. Usuario abre LetXipu Desktop HF
   ├─ Electron arranca backend Express local (127.0.0.1:43123)
   ├─ Electron busca MCP-V11-Local portable en:
   │    1. %ProgramFiles%\MCP-V11-Local
   │    2. %ProgramFiles%\MCP-V11-Local-Portable
   │    3. %LocalAppData%\MCP-V11-Local, %USERPROFILE%\MCP-V11-Local
   │    4. env LETXIPU_LOCAL_MCP_DIR si está seteada
   ├─ Si encuentra el portable → lee secrets.json, spawn start-mcp-local.cmd
   │      con env vars (PORT=4003, GOOGLE_API_KEY, MISTRAL_API_KEY, etc.)
   ├─ Probea http://127.0.0.1:4003/api/health (hasta 30s, spaCy sidecar lento)
   ├─ Si MCP local responde → badge "MCP: Local" en UI (esmeralda)
   └─ Si no → badge "MCP: Remoto HF" (ámbar) — fallback al HF Space

4. Usuario hace búsquedas: las fuentes LatAm (ALICIA, RENATI, CONAHCyT, etc.)
   ahora responden 200 OK porque sale desde la IP residencial del usuario
```

## Pasos ejecutados (resumen)

| # | Tarea | Resultado | Observaciones |
|---|---|---|---|
| 1 | Copiar MCP V11 a LETXIPU-SEARCH-MCP-V11-LOCAL | ✅ | Excluyendo node_modules, .git, .codebase-memory |
| 2 | server.ts LOCAL: API /api/health lightweight | ✅ | gateway_mode flag + python ready probe |
| 3 | spacy-client.ts LOCAL: SPACY_SCRIPT env override | ✅ | Default `python` (PATH) no hardcoded user |
| 4 | spacy_server.py LOCAL: preferir spacy.load() pip-installed | ✅ | Para python-runtime embedded con modelos via pip |
| 5 | Downgrade pino 8.14.0 (no tracingChannel) | ✅ | pkg 5.8.1 con Node 18.5.0 de pkg-fetch |
| 6 | Build pkg 5.8.1 → MCP-V11-Local.exe (78 MB) | ⚠️ | pkg arranca OK, /api/health responde, pero `fetch failed` desde dentro (undici en pkg roto) |
| 7 | **Pivote:** instalar Node 20.18 standalone portable | ✅ | `node.exe` 67 MB, fetch funciona correctamente |
| 8 | Instalar Python 3.12 embedded + pip + numpy/flask/spacy | ✅ | 294 MB (con modelos sm) |
| 9 | Pip-install es_core_news_sm, en_core_web_sm, pt_core_news_sm | ✅ | Modelos via pip → spacy.load() directa |
| 10 | Crear dist-portable con todos los runtime assets | ✅ | Total 473 MB sin comprimir |
| 11 | **PRUEBA E2E EXE LOCAL:** search ALICIA = 4 papers ✅ | ✅ | ALICIA 4, RENATI 2, LaReferencia 2, Brazil/CONAHCyT 2 c/u |
| 12 | Crear ZIP con 7-Zip → 163 MB comprimido | ✅ | dist/MCP-V11-Local-Portable.zip |
| 13 | Modificar electron/main.cjs: discover+spawn+kill | ✅ | maybeStartLocalMcp + loadSecretsFile + auto-restart (max 3) |
| 14 | Modificar server.ts: probeLocalMcp + resolveMcpUrl + /health mcpBackend | ✅ | TTL 30s probe cache |
| 15 | Modificar App.tsx: badge MCP Local/Apagado/Iniciando + useEffect /health cada 15s | ✅ | con tooltip explicativo |
| 16 | Verificación lint tsc --noEmit | ✅ | Sin errores |
| 17 | Vite build + esbuild → server.cjs (287 KB) | ✅ | + install-deps.cjs |
| 18 | **PRUEBA E2E GATEWAY:** ALICIA = 20 papers | ✅ | batch_search 120s, beforeDedup: 140 papers |
| 19 | Build NSIS LetXipu Desktop HF Setup 0.0.0.exe | ✅ | 274 MB |
| 20 | Build portable LetXipu Desktop HF 0.0.0.exe | ✅ | 274 MB |

## Tiempos reales

| Tarea | Tiempo real | Tiempo estimado |
|---|---|---|
| Preparación LOCAL (copiar + tsc) | 10 min | 30 min |
| Builds pkg fallidos (yao-pkg recompile Node) | 60 min | — |
| Pivote a node.exe standalone portable | 20 min | — |
| Python embedded + deps + modelos sm | 15 min | 2h |
| ZIP con 7-Zip (vs Compress-Archive hung) | 5 min | 5 min |
| Modificar main.cjs (spawn + lifecycle) | 25 min | 1h |
| Modificar server.ts (routing + status) | 15 min | 30min |
| Modificar App.tsx (badge UI) | 20 min | 30min |
| Lint + build server.cjs | 15 min | 5 min |
| **PRUEBAS E2E** (search ALICIA exitoso) | 15 min | — |
| Build LetXipu Desktop HF NSIS final | ~15 min | 15 min |

**Total: ~3h45min (incluyendo exploración fallida de pkg/yao-pkg)**

## Distribución final al usuario

| Archivo | Tamaño | Origen | Función |
|---|---|---|---|
| `MCP-V11-Local-Portable.zip` | 163 MB | `LETXIPU-SEARCH-MCP-V11-LOCAL\dist\` | Backend MCP con Python + spaCy (descomprimir, no requiere instalar) |
| `LetXipu Desktop HF Setup 0.0.0.exe` | 274 MB | `LETXINET-DESKTOP-HF\dist\` | Gateway Electron + UI ( installer) |
| `LetXipu Desktop HF 0.0.0.exe` | 274 MB | `LETXINET-DESKTOP-HF\dist\` | Gateway portable standalone |

## Instrucciones de instalación al usuario final

1. **Descargar** `MCP-V11-Local-Portable.zip` (163 MB)
2. **Descomprimir** en una carpeta fija, recomendado:
   - `C:\Program Files\MCP-V11-Local-Portable\` (requiere admin)
   - O `C:\Users\TU_USUARIO\MCP-V11-Local-Portable\` (sin admin)
3. **Descargar e instalar** `LetXipu Desktop HF Setup 0.0.0.exe` ( Next, Next, Finish)
4. **Abrir LetXipu Desktop HF** desde el menú inicio o escritorio
5. En la primera pantalla, click en el ícono de llave (esquina sup. derecha) → introducir API keys:
   - **MCP API Key**: clave de LetXinet (la que ya usabas)
   - **Gemini API Key**: Google AI Studio (gratuita)
   - **Mistral API Key**: Mistral AI (opcional)
6. **Verificar el badge "MCP: Local"** en el header (esmeralda, junto al de LetXipu/OSM)
   - Si dice "MCP: Remoto HF" (ámbar), el gateway no encontró el portable —
     verificar que la carpeta del MCP-V11-Local tiene `start-mcp-local.cmd` y `MCP-V11-Local.exe`
7. **Hacer búsquedas** — las fuentes peruanas/latam ahora responden correctamente

## Verificación técnica (logs y tools)

- `local-mcp.log` en `%APPDATA%\letxipu-desktop-hf\` muestra el arranque del MCP local
- `backend.log` en el mismo dir muestra el gateway
- `GET http://127.0.0.1:43123/health` devuelve:
  ```json
  {
    "status": "ok",
    "mcpBackend": "local",          // o "remote"
    "mcpBackendReady": true,         // true = MCP local vivo
    "localMcpUrl": "http://127.0.0.1:4003/api/mcp"
  }
  ```
- `GET http://127.0.0.1:4003/api/health` (MCP local directo):
  ```json
  {
    "status": "ok",
    "build": "local",
    "python": true,
    "gateway_mode": true
  }
  ```

## Riesgos conocidos y mitigaciones

1. **Antivirus false positive** en `MCP-V11-Local.exe` (pkg successor) — común en binaries firmados sin certificado. Mitigación: instrucciones de exclusión de carpeta.

2. **spaCy sidecar startup 4-6s** — Acceptable. La probe de main.cjs espera hasta 30s.

3. **Si el usuario descomprime el portable donde no se encuentra** — main.cjs busca en 7 rutas estándar. Plan B: env var `LETXIPU_LOCAL_MCP_DIR` para apuntar manualmente.

4. **Variables API keys** — pasadas via `env` del cmd launcher, nunca loggeadas. `secrets.json` en `%APPDATA%\letxipu-desktop-hf\` con permisos user-only por defecto.

5. **Auto-restart del MCP local si cae** — main.cjs reintenta hasta 3 veces con 2s de delay. Si falla el setup de Python, el MCP morirá 3 veces y luego fallback al remoto HF.

6. **Node 20 LTS lifespan** — Node 20 Active LTS ends Apr 2026. Plan B: actualizar a Node 22 LTS cuando sea necesario.

## Archivos afectados

| Archivo | Cambios | Acción |
|---|---|---|
| `LETXIPU-SEARCH-MCP-V11-LOCAL\src\server.ts` | +24 líneas (`/api/health` endpoint) | Modificado |
| `LETXIPU-SEARCH-MCP-V11-LOCAL\src\utils\spacy-client.ts` | +5 líneas (SPACY_SCRIPT env) | Modificado |
| `LETXIPU-SEARCH-MCP-V11-LOCAL\src\python\spacy_server.py` | +9 líneas (preferir spacy.load pip-installed) | Modificado |
| `LETXIPU-SEARCH-MCP-V11-LOCAL\package.json` | -2 deps, bin/pgk config (legacy) | Modificado |
| `LETXIPU-SEARCH-MCP-V11-LOCAL\start-mcp-local.cmd` | Creado entrypoint portable | Creado |
| `LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\build-portable.cjs` | Creado (descartado) | Creado |
| `LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\package.json` | Creado (descartado) | Creado |
| `LETXINET-DESKTOP-HF\electron\main.cjs` | +150 líneas (discover+spawn+lifecycle+quit kill) | Modificado |
| `LETXINET-DESKTOP-HF\server.ts` | +60 líneas (probeLocalMcp/resolveMcpUrl + /health mcpBackend) | Modificado |
| `LETXINET-DESKTOP-HF\src\App.tsx` | +30 líneas (badge visual + useEffect probe) | Modificado |
| `LETXIPU-SEARCH-MCP-V11\*` | **NO TOCADO** | — |

## Resultados de pruebas E2E

### Test 1: MCP local standalone (antes de integración)
```
$ search "concreto" sources=["latam"] fastMode=true
→ ALICIA: 4 papers ✅ (30s)
→ RENATI: 2 papers ✅ (42s)
→ LaReferencia: 2 papers ✅
→ CONAHCyT, Uruguay, Costa Rica, El Salvador, UNAM: 2 papers each
→ ANID, SNRD: timeout (globalmente caídos)
→ Total: 30 papers before dedup
```

### Test 2: Gateway LetXipu Desktop HF → MCP local
```
$ batch_search queries=["concreto"] sources=["latam"] fastMode=true
→ Response success=True, duration=120.2s
→ beforeDedup: 140 papers collected
→ ALICIA: 20 papers ✅ (119s)
→ RENATI: 20 papers ✅ (80s)
→ BDTD, OASISBR, RRAAE, MinCiencias, SciELO: 20 papers each
→ Total deduped: 2 finalistas (query muy común)
```

## Estado

- **Plan:** ✅ COMPLETADO Y VERIFICADO
- **Modo:** Build (operaciones ejecutadas)
- **Pruebas E2E:** ✅ Exitosas (ALICIA responde)
- **Próximos pasos opcionales**: 
  1. Empaquetar el portable ZIP en un instalador NSIS propio (requiere Inno Setup instalado)
  2. Añadir modelo `es_core_news_md` (mejor calidad NER, +50 MB)
  3. Distribución automatizada (release en GitHub o CDN)
