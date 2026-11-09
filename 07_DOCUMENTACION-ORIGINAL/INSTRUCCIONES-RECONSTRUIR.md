# Instrucciones para reconstruir los instaladores (.exe) desde el código fuente

Este documento explica cómo modificar el código y volver a generar los instaladores
de `LetXipu Desktop HF` (gateway) y `MCP-V11-Local` (backend MCP + spaCy lg).

Las carpetas de código fuente activo están en:

- `D:\OTROS\LETXINET-DESKTOP-HF\` (gateway Electron + TypeScript)
- `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\` (MCP backend Node + Python + Inno Setup)
- `D:\OTROS\letxipu-osm-mcp\` (OSM MCP server Go, 28 tools geoespaciales)

Los ZIPs en `CODIGO-FUENTE\` son snapshots de respaldo — para modificar el programa
trabaja SIEMPRE sobre las carpetas activas arriba.

---

## Requisitos previos (instalar una sola vez por PC de desarrollo)

| Herramienta | Versión | Verificación | Dónde obtener |
|---|---|---|---|
| Node.js | 18+ | `node --version` | https://nodejs.org |
| npm | incluido con Node | `npm --version` | — |
| Inno Setup 7 | ISCC.exe | `"C:\Users\USER\AppData\Local\Programs\Inno Setup 7\ISCC.exe" /?` | https://jrsoftware.org/isdl.php |
| NSIS 3.0.4+ | makensis.exe | electron-builder lo descarga y cachea automáticamente | (no necesita instalación manual) |
| Python 3.12+ | (para dev MCP local) | `python --version` | https://www.python.org |
| pip + spaCy | (para dev MCP local) | `python -c "import spacy"` | `pip install spacy` |
| Go | 1.24+ | `go version` | https://go.dev/dl/ (solo necesario si modificas OSM-MCP) |

NSIS lo descarga `electron-builder` la primera vez que corres `npm run desktop:dist`
del gateway. El cacheado está en:
`C:\Users\<USER>\AppData\Local\electron-builder\cache\nsis-3.0.4.1\nsis-3.0.4.1-1mx3n\makensis.exe`

No necesitas tocarlo — electron-builder resuelve solo la ruta.

---

## Productos

### 1) LetXipu Desktop HF (gateway)
**Fuente**: `D:\OTROS\LETXINET-DESKTOP-HF\`

Arquitectura:
- `server.ts`         (backend gateway, TypeScript)
- `src/`              (UI React + trabajos de UI)
- `electron/`         (main process Electron)
- `package.json`      (defines `dev`, `build`, `desktop:dist`)
- `skills/`           (skills para LLM,SKILL.md)
- `vite.config.ts`    (configuración del build del front)

Flujo de modificación:
```powershell
cd D:\OTROS\LETXINET-DESKTOP-HF
# 1. Instala dependencias (solo primera vez)
npm install

# 2. Edita server.ts o src/* con tu editor

# 3. Verifica que compila (sin generar .exe)
npm run lint                  # tsc --noEmit     → debe salir sin errores
npm run build                 # vite+esbuild → dist/server.cjs + dist/assets/*

# 4. Genera el installer completo
npm run desktop:dist          # equivale a: npm run build && electron-builder --win nsis
                              # Output: dist\LetXipu Desktop HF Setup 0.0.0.exe
                              #         dist\LetXipu Desktop HF 0.0.0.exe (portable .exe)
                              # Duración: ~10 min (descarga Electron 37 + NSIS + bundle)
```

Resultados:
- `dist\LetXipu Desktop HF Setup 0.0.0.exe` (instalador NSIS, ~274 MB)
- `dist\LetXipu Desktop HF 0.0.0.exe` (portable one-click, ~274 MB)
- `dist\win-unpacked\` (carpeta portable descomprimida, ~1.1 GB)

Instalar de forma silenciosa en la máquina destino:
```powershell
Start-Process -FilePath ".\LetXipu Desktop HF Setup 0.0.0.exe" `
  -ArgumentList "/S","--current-user" -Wait
# Se instala en: C:\Users\<USER>\AppData\Local\Programs\LetXipu Desktop HF\
```

---

### 2) MCP-V11-Local (backend MCP + spaCy)
**Fuente**: `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\`

Arquitectura:
- `src/routes/mcp.ts`                (tool dispatcher — variantes smart_search, RERANK)
- `src/routes/search.ts`             (search tool execution)
- `src/routes/sources.ts`            (resolución de grupos de fuentes)
- `src/providers/`                   (fuentes academicas: ALICIA, RENATI, OpenAlex, Scopus, etc.)
- `src/utils/`                       (spacy-client, tool-timeouts, client-detection, reranking)
- `src/python/spacy_server.py`       (servidor spaCy Flask sidecar en :4002)
- `packaging/build-portable.cjs`     (orquestador de empaquetado)
- `packaging/installer/MCP-V11-Local-Setup.iss`  (script Inno Setup para el .exe installer)
- `packaging/package.json`           (config electron-builder — actualmente NO se usa en el flujo)

Parches aplicados (julio 2026):
- C1 en `mcp.ts`: variantes slice(0, fastMode ? 8 : 6) — más variantes generadas
- C2 en `mcp.ts`: mostSimilar threshold 0.7 → 0.50
- C5 en `mcp.ts`: wc filter 3-6 → 2-8 + adiciona 3ra variant synonym
- C6 en `tool-timeouts.ts`: smart_search 180s → 300s
- C7 en `mcp.ts`: SMART_TIMEOUT 150s → 300s
- C1b/C3/C4/C4b4/C4c en `spacy_server.py`: filtros most_similar relajados
- B6b en `gateway/server.ts`: extractItemsFromSearchResult extrae `parsed.data.sources`
- B6 en `gateway/server.ts`: dedup alicia cuando renati presente
- B5 en `gateway/server.ts`: resolveSourceGroupDynamic
- es_core_news_lg (602 MB, 500k word vectors 300-dim) incluido en python-runtime
- **C9a** en `search.ts:252`: floor `Math.max(90_000, raceMs)` global — Elimina `Provider timeout` en `search` standalone; compatible con `batch_search` (Patch B1 equivalente). Race es techo (no espera fija): providers rápidos (OpenAlex 0.25s) no se ven afectados.
- **C9b** en `latam-repositories.ts` (searchAlicia): auto-skip DME cuando `raceMs < 180s` — ALICIA devuelve 30-50 records raw (sin abstracts enriquecidos) en 10-15s en vez de timing out a 60s intentando cascada DME completa. Para DME completo usar `batch_search` con raceMs alto o `PROVIDER_TIMEOUT_MS=180000` en `.env`.
- **C9c** en `latam-repositories.ts` (searchAlicia): skip OAI-PMH fallback cuando `autoSkipDME=true` — OAI-PMH hace 5-15 fetches HTTP secuenciales a archivos.tst.edu.pe y repositorios OAI peruanos, tardando 30-60s+ extras que disparaban timeout en outer race (raceMs=90s). Mismo flag que C9b.
- **C9d** en `latam-repositories.ts` (executeAliciaSearchWithFallbacks): skip los 2 fetches secuenciales fallback (25s+20s) cuando `raceMs < 180s` — para queries topical con poca cobertura en ALICIA (e.g. "mercados Chimbote"), los 2 fallbacks no aportan y solosuman 45s al wall-clock que aborta el outer race. Mismo flag que C9b/C9c.
- **C9e** en `latam-repositories.ts` (searchAlicia): amplía C9c — el skip de OAI-PMH ahora usa `!skipTopLevelDME` (cubre `wasA2Split`, `fastMode`, `batch_skip_dme`, `__skipDME` y `autoSkipDME`) en vez de solo `!autoSkipDME`. Bug: queries A2-split (4+ keywords, e.g. "mercado de abastos Chimbote higiene salubridad vendedores") tenían `autoSkipDME=false` por diseño y el OAI-PMH corría tras el A2-split (~30-66s) → total >90s → `Provider timeout` 90005ms observado en producción. OAI-PMH solo corre en el camino full-quality (query simple + raceMs≥180s + sin fastMode/batch).
- **C9f** en `search.ts`: dedup alicia cuando renati está presente (equivalente al B6 del gateway en la ruta atomic_multisource, ahora también en el path raw del MCP). `searchRenati` llama internamente a `searchAlicia`, así que correr ambos en paralelo martillea el mismo upstream VuFind (alicia A2-split = 3 sub-queries + renati) → rate-limiting mutuo → alicia >90s → `Provider timeout` 90009ms reproducido con sources=[alicia,renati] fastMode=true. renati devuelve registros ALICIA + SUNEDU, sin pérdida significativa de cobertura.
- **C10** en `latam-repositories.ts` (searchRenati): skip los 2 fallbacks secuenciales de RENATI cuando `raceMs < 180s`. Antes: attempt 1 (ALICIA+OAI-PMH paralelo) + FALLBACK 1 (query simplificada) + FALLBACK 2 (2 palabras) = peor caso 3 × RENATI_ATTEMPT_TIMEOUT (hasta 180s) vs race externo 90s → `Provider timeout` para renati en queries de 0 resultados con VuFind lento. Con skip: devuelve lo que attempt 1 encontró (ya cubre ALICIA + OAI-PMH en paralelo). Detectado via análisis codebase-memory del grafo (transitive_loop_depth + revisión manual de callers).
- **C11** en `src/providers/markitdown-client.ts` (markitdown backend): modo HTTP API via `MARKITDOWN_API_URL`. Antes, `markitdown-client.ts` invocaba `python scripts/pdf_to_markdown.py` con `pymupdf4llm` — pero el installer **nunca empaquetaba** ni el script ni `pymupdf4llm` en el `python-runtime/` del install → en cualquier clean install el motor `markitdown` estaba registrado pero roto (caía a `pdf-parse` nativo, calidad baja, y `health_check` reportaba `available:false`). Con C11: si `MARKITDOWN_API_URL` está seteada, el MCP POSTea el PDF a la FastAPI standalone (puerto 7860, `D:\OTROS\markitdown-api\app.py` con pymupdf4llm) en vez de invocar Python local. Cero dependencias Python dentro del install. La API standalone es opcional: sin ella, el motor `markitdown` no se ofrece y el router usa `mineru-api` (remoto, requiere `MINERU_API_KEY`) o `pdf-parse` (nativo).
- **Fix `cd /d` en `start-mcp-local.cmd`**: añadido `cd /d "%INSTALL_DIR%"` antes de lanzar `MCP-V11-Local.exe`. Sin esto, `dotenv.config()` (línea 46 de `dist/server.js`) busca `.env` en `process.cwd()` (que es el directorio desde donde se llama el cmd, no el install). Como el `.env` vive en `%LOCALAPPDATA%\Programs\MCP-V11-Local\.env`, sin `cd /d` los tokens `MINERU_API_KEY` / `HF_TOKEN` / todos los demás NUNCA cargaban → en clean install `mineru.available:false` pese a que el `.env` estaba correctamente copiado. Con `cd /d` el cwd del proceso MCP es el install, dotenv carga el `.env`, y los tokens llegan a `process.env`.

Flujo de modificación:
```powershell
cd D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL

# 1. Instala dependencias (solo primera vez)
npm install                              # node_modules para el backend Node

# 2. Edita src/*.ts o src/python/spacy_server.py con tu editor

# 3. Compila TypeScript → dist/
npm run build                            # tsc → genera dist/*.js
# Verificar: dist\routes\mcp.js, dist\utils\tool-timeouts.js, etc.

# 4. Sincroniza dist\ con dist-portable\dist\  (tsc NO actualiza dist-portable)
#    Solo si modificaste archivos compilados (mcp.ts, tool-timeouts.ts, etc.)
Copy-Item -Path "dist\*" -Destination "dist-portable\dist" -Recurse -Force

# 5. Sincroniza python script si lo modificaste
Copy-Item -Path "dist\python\*" -Destination "dist-portable\python" -Recurse -Force

# 6. Genera el installer con Inno Setup
cd packaging\installer
& "C:\Users\USER\AppData\Local\Programs\Inno Setup 7\ISCC.exe" "MCP-V11-Local-Setup.iss"
# Output: packaging\installer\installer-output\MCP-V11-Local-Setup 0.0.0.exe
# Duración: ~17 min (LZMA ultra64 + 602 MB python-runtime comprimido a ~410MB)
```

### Resultados
- `packaging\installer\installer-output\MCP-V11-Local-Setup 0.0.0.exe` (~518 MB con es_core_news_lg)

Instalar de forma silenciosa en la máquina destino:
```powershell
Start-Process -FilePath ".\MCP-V11-Local-Setup 0.0.0.exe" `
  -ArgumentList "/SP-","/VERYSILENT","/SUPPRESSMSGBOXES","/NORESTART","/CURRENTUSER" -Wait
# Se instala en: C:\Users\<USER>\AppData\Local\Programs\MCP-V11-Local\
# Registra variable de entorno HKCU LETXIPU_LOCAL_MCP_DIR automáticamente
# (~1 GB instalado, incluye el modelo spaCy lg)
```

---

### 3) OSM-MCP (servidor OpenStreetMap, Go)
**Fuente**: `D:\OTROS\letxipu-osm-mcp\`

Arquitectura:
- `cmd/osmmcp/main.go`           (entry point, parsea flags, levanta HTTP+SSE)
- `pkg/core/`                    (auth, http, osrm, errors)
- `pkg/cache/`                   (tile cache, genérico)
- `pkg/coords/`                  (parsing/normalización de coordenadas)
- `pkg/tools/`                   (28 herramientas OSM: geocode, route, nearby…)
- `packaging/launcher/start-osm-mcp.cmd`  (launcher para el usuario final)
- `packaging/installer/OSM-MCP-Setup.iss` (script Inno Setup del installer)
- `go.mod`                       (module `github.com/NERVsystems/osmmcp`, Go 1.24.1)
- `vendor/`                      (deps Go — NO incluido en el source ZIP; regenerar con `go mod vendor`)

El installer **NO** inyecta variables de entorno. El usuario decide manualmente
si quiere que el gateway LetXipu Desktop HF use este OSM local en vez del
HF Space remoto. El launcher `start-osm-mcp.cmd` imprime en consola las
instrucciones exactas la primera vez que se ejecuta.

Flujo de modificación:
```powershell
cd D:\OTROS\letxipu-osm-mcp

# 1. Reconstituye dependencias Go (vendedor) — solo la primera vez o tras go.mod changes
go mod vendor                                            # si falta vendor/, regenera ~5 MB

# 2. Edita *.go con tu editor

# 3. Compila el binario (cross-compile Windows amd64 desde cualquier OS)
go build -o osmmcp.exe ./cmd/osmmcp                      # Output: osmmcp.exe (~24 MB)
# Verificación:  .\osmmcp.exe --help                      # Lista flags disponibles

# 4. (Opcional) Prueba local rápido en :7082
.\osmmcp.exe -enable-http -http-only -http-addr 127.0.0.1:7082 -enable-monitoring

# 5. Genera el installer con Inno Setup
cd packaging\installer
& "C:\Users\USER\AppData\Local\Programs\Inno Setup 7\ISCC.exe" "OSM-MCP-Setup.iss"
# Output: packaging\installer\installer-output\OSM-MCP-Setup 0.0.0.exe
# Duración: ~10 s (LZMA normal, binario único 24 MB → installer 12 MB)
```

### Resultados
- `packaging\installer\installer-output\OSM-MCP-Setup 0.0.0.exe` (~12 MB)

Instalar de forma silenciosa en la máquina destino:
```powershell
Start-Process -FilePath ".\OSM-MCP-Setup 0.0.0.exe" `
  -ArgumentList "/SP-","/VERYSILENT","/SUPPRESSMSGBOXES","/NORESTART" -Wait
# Se instala en: C:\Users\<USER>\AppData\Local\Programs\OSM-MCP\
# NO registra variables de entorno. El usuario las define manualmente (ver abajo).
```

### Activar OSM local en LetXipu Desktop HF (paso manual del usuario)

El gateway `server.ts:171` ya soporta override de la URL de OSM via env var:
```ts
letxipuOsmMcpUrl = HF_ONLY_MODE ? HF_LETXIPU_OSM_MCP_URL
                                : (process.env.LETXIPU_OSM_MCP_URL || HF_LETXIPU_OSM_MCP_URL);
```
Donde `HF_LETXIPU_OSM_MCP_URL = "https://c2mv-letxipu-osm-mcp.hf.space/mcp"` es el fallback remoto.

**Para usar el OSM local** (patient: solo una vez por PC, persistente a nivel usuario):
```cmd
Win+R → cmd → Enter
setx LETXIPU_OSM_MCP_URL "http://127.0.0.1:7082/mcp"
exit
```
Luego cierra y reabre LetXipu Desktop HF. El gateway releerá la env var y
canalizará las 28 tools OSM via localhost en lugar del HF Space.

**Para volver al OSM remoto**: borra la env var con:
```cmd
reg delete "HKCU\Environment" /v LETXIPU_OSM_MCP_URL /f
```
(o déjala vacía: `setx LETXIPU_OSM_MCP_URL ""` — el gateway träedice string vacío como no-set y cae al fallback remoto.)

### Smoke test OSM local (después de instalar)

```powershell
# 1. Lanzar OSM local
Start-Process -FilePath "C:\Users\USER\AppData\Local\Programs\OSM-MCP\start-osm-mcp.cmd"
Start-Sleep 3

# 2. Verificar que responde
$initBody = '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
$r = Invoke-WebRequest -Uri "http://127.0.0.1:7082/mcp" -Method POST -Body $initBody -ContentType "application/json"
$sId = $r.Headers['Mcp-Session-Id']
# Esperado: status 200, sessionId impersonado `mcp-session-*`

# 3. Listar tools (28 esperadas)
$listBody = '{"jsonrpc":"2.0","method":"tools/list","id":2,"params":{}}'
$r2 = Invoke-WebRequest -Uri "http://127.0.0.1:7082/mcp" -Method POST -Body $listBody -ContentType "application/json" -Headers @{ "Mcp-Session-Id" = $sId }
($r2.Content | ConvertFrom-Json).result.tools.Count    # Esperado: 28

# 4. Via gateway (debe verse local después de setx + restart LetXipu Desktop)
$r3 = Invoke-WebRequest "http://127.0.0.1:43123/api/mcp/tools" -UseBasicParsing
($r3.Content | ConvertFrom-Json).tools.Count            # Esperado: ~59 (28 OSM + 28 letxipu-search + extras)

# 5. Llamar geocode_address Lima via gateway
$body = '{"tool":"geocode_address","arguments":{"address":"Lima, Peru"}}'
$r4 = Invoke-WebRequest -Uri "http://127.0.0.1:43123/api/mcp/call" -Method POST -Body $body -ContentType "application/json"
# Esperado: success=true, duration ~1s, lat=-12.046 lon=-77.03
```

---

Este modelo NO está en el codigo fuente (es muy grande para git/zip).
Está pre-instalado en el `python-runtime/` del `dist-portable/`, por lo que el installer nuevo
lo incluye y no necesita download post-install.

Si pierdes `dist-portable\python-runtime\Lib\site-packages\es_core_news_lg`, lo regeneras así:
```powershell
$python = "D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\dist-portable\python-runtime\python.exe"
& $python -m spacy download es_core_news_lg
```

O copiarlo desde el install existente en la PC:
```powershell
$src = "C:\Users\USER\AppData\Local\Programs\MCP-V11-Local\python-runtime\Lib\site-packages\es_core_news_lg"
$dst = "D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\dist-portable\python-runtime\Lib\site-packages"
Copy-Item $src $dst -Recurse -Force
```

Sin este modelo, `smart_search` se cae al `es_core_news_sm` (15MB, sin word vectors)
y `most_similar` devuelve vacío — no genera variantes semánticas útiles.

---

## Archivo `.env` (API keys)

NO se incluye en codigo fuente ni installer por seguridad. Cada instalación debe tener:

Archivo `C:\Users\USER\AppData\Local\Programs\MCP-V11-Local\.env` con:
```
CORE_API_KEY=...
MINERU_API_KEY=...
SCOPUS_API_KEY=...
SEMANTIC_SCHOLAR_API_KEY=...
SERP_API_KEY=...
HF_TOKEN=...
REDALYC_API_KEY=...
```

En el gateway (LetXipu Desktop HF) creamos:
`C:\Users\<USER>\AppData\Roaming\letxipu-desktop-hf\secrets.json`
con las mismas claves en formato JSON. Esto se hace por la UI en el primer arranque
o copiando un secrets.json en esa ruta.

---

## Checks de smoke test (verifica que todo funciona)

Después de instalar ambos productos y lanzarlos:

```powershell
# MCP backend (puerto 4003)
(Invoke-WebRequest "http://127.0.0.1:4003/api/health" -UseBasicParsing).Content
# Esperado: {"status":"ok","python":true,"gateway_mode":true,...}

# spaCy sidecar (puerto 4002)
(Invoke-WebRequest "http://127.0.0.1:4002/health" -UseBasicParsing).Content
# Esperado: {"ready":true,"status":"ok"}

# Gateway (puerto 43123)
(Invoke-WebRequest "http://127.0.0.1:43123/health" -UseBasicParsing).Content
# Esperado: {"status":"ok","mcpBackendReady":true,"groupsCount":17,...}

# Test smart_search
$body = '{"tool":"smart_search","arguments":{"query":"delito homicidio peru","fastMode":false,"maxResults":30}}'
$body | Out-File "$env:TEMP\test.json" -Encoding ASCII -NoNewline
curl.exe -s -X POST "http://127.0.0.1:43123/api/mcp/call" -H "Content-Type: application/json" -H "User-Agent: claude/1.0" --data-binary "@$env:TEMP\test.json" --max-time 360 | Out-File "$env:TEMP\out.json"
# Esperado: ~3-4 min, retorna 30+ papers con queriesUsed[] conteniendo 6 variantes dinámicas
```

---

## Snapshot y distribución

Después de recompilar y validar, generar nuevos ZIPs de respaldo:

```powershell
# Staging de fuente para distribución
$stage = "$env:TEMP\src-zip-staging"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null

# 1. Gateway: server.ts + configs + electron + scripts + skills + src + index.html + vite.config
$gw  = "$stage\LETXINET-DESKTOP-HF"
New-Item -ItemType Directory -Path $gw -Force | Out-Null
$scope = @("server.ts","tsconfig.json","package.json","package-lock.json","electron","scripts","skills","index.html","vite.config.ts","src")
foreach ($s in $scope) {
  Copy-Item "D:\OTROS\LETXINET-DESKTOP-HF\$s" "$gw\$s" -Recurse -Force -EA SilentlyContinue
}
Compress-Archive -Path "$gw\*" -DestinationPath "D:\OTROS\LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\CODIGO-FUENTE\LETXINET-DESKTOP-HF-codigo-fuente.zip" -Force

# 2. MCP: src + packaging + tests + config files (sin dist-portable, sin node_modules, sin es_core_news_lg)
$mcp = "$stage\LETXIPU-SEARCH-MCP-V11-LOCAL"
New-Item -ItemType Directory -Path $mcp -Force | Out-Null
$scope = @("package.json","package-lock.json","tsconfig.json","README.md","src","packaging","tests","start-mcp-local.cmd","start-local.cmd","requirements-python.txt","vercel.json","Dockerfile",".env.example",".gitignore","install.ps1")
foreach ($s in $scope) {
  Copy-Item "D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\$s" "$mcp\$s" -Recurse -Force -EA SilentlyContinue
}
# Quitar residuos de build考古
Remove-Item "$mcp\packaging\installer\installer-output" -Recurse -Force -EA SilentlyContinue  # installers generados
Remove-Item "$mcp\src\python\models" -Recurse -Force -EA SilentlyContinue                   # modelos sm (60 MB c/u)

Compress-Archive -Path "$mcp\*" -DestinationPath "D:\OTROS\LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\CODIGO-FUENTE\LETXIPU-SEARCH-MCP-V11-LOCAL-codigo-fuente.zip" -Force

# 3. OSM-MCP (Go): sin vendor, sin binarios, sin logs
$osm = "$stage\letxipu-osm-mcp"
New-Item -ItemType Directory -Path $osm -Force | Out-Null
robocopy "D:\OTROS\letxipu-osm-mcp" $osm /E /XD ".git" "bin" "node_modules" "vendor" "packaging\launcher" /XF "*.exe" "*.zip" "*.pdb" "*.log" /NJH /NJS /NFL /NDL | Out-Null
Compress-Archive -Path "$osm\*" -DestinationPath "D:\OTROS\LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\CODIGO-FUENTE\letxipu-osm-mcp-src.zip" -Force

Remove-Item $stage -Recurse -Force

# Copiar installers nuevos
Copy-Item "D:\OTROS\LETXINET-DESKTOP-HF\dist\LetXipu Desktop HF Setup 0.0.0.exe" "D:\OTROS\LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\EJECUTABLES\" -Force
Copy-Item "D:\OTROS\LETXINET-DESKTOP-HF\dist\LetXipu Desktop HF 0.0.0.exe" "D:\OTROS\LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\EJECUTABLES\" -Force
Copy-Item "D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\installer\installer-output\MCP-V11-Local-Setup 0.0.0.exe" "D:\OTROS\LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\EJECUTABLES\" -Force
Copy-Item "D:\OTROS\letxipu-osm-mcp\packaging\installer\installer-output\OSM-MCP-Setup 0.0.0.exe" "D:\OTROS\LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\EJECUTABLES\" -Force
```

---

## Atajos típicos

### Solo cambie server.ts (gateway) y quiero reemplazarlo en el install sin reinstalar todo:
```powershell
# 1. Recompila
cd D:\OTROS\LETXINET-DESKTOP-HF
npm run build                                # actualiza dist\server.cjs
# 2. Copia directo al install (asar.unpacked\dist\server.cjs)
Copy-Item ".\dist\server.cjs" "C:\Users\USER\AppData\Local\Programs\LetXipu Desktop HF\resources\app.asar.unpacked\dist\server.cjs" -Force
# 3. Reinicia el Electron (cierrallo y vuelve a abrir)
```

### Solo cambie mcp.ts/spacy_server.py (MCP) y quiero parchar en hot:
```powershell
# 1. Compila TypeScript
cd D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL
npm run build
# 2. Parcha los 2-3 archivos críticos en el install activo
$mcp = "C:\Users\USER\AppData\Local\Programs\MCP-V11-Local"
Copy-Item "dist\routes\mcp.js"           "$mcp\dist\routes\mcp.js" -Force
Copy-Item "dist\utils\tool-timeouts.js"   "$mcp\dist\utils\tool-timeouts.js" -Force
Copy-Item "dist\python\spacy_server.py"   "$mcp\python\spacy_server.py" -Force
# 3. Reinicia MCP-V11-Local.exe (mata el proceso y vuelve a lanzar start-mcp-local.cmd)
Get-Process MCP-V11-Local | Stop-Process -Force
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$mcp\start-mcp-local.cmd`"" -WindowStyle Hidden
```

### Instalación rápida en otra PC (sin compilar):

1. Copia la carpeta `LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP` a la PC destino.
2. Ejecuta `EJECUTABLES\MCP-V11-Local-Setup 0.0.0.exe` (instala el backend+spaCy+lg).
3. Crea el archivo `C:\Users\<USER>\AppData\Local\Programs\MCP-V11-Local\.env` con las 7 API keys.
4. Ejecuta `EJECUTABLES\LetXipu Desktop HF Setup 0.0.0.exe` (instala el gateway).
5. Crea `C:\Users\<USER>\AppData\Roaming\letxipu-desktop-hf\secrets.json` (las mismas 7 keys en JSON).
6. **(Opcional)** Ejecuta `EJECUTABLES\OSM-MCP-Setup 0.0.0.exe` y, si quieres OSM local en vez del remoto HF Space, abre cmd y pega:
   ```
   setx LETXIPU_OSM_MCP_URL "http://127.0.0.1:7082/mcp"
   ```
7. Lanza `start-mcp-local.cmd` desde el menú inicio (MCP-V11-Local).
8. **(Opcional)** Lanza `Start OSM-MCP (local)` desde el menú inicio (OSM-MCP) si activaste el paso 6.
9. Lanza `LetXipu Desktop HF.exe` desde el menú inicio.

Smoke test al final con los 3 endpoints del bloque anterior (más los 5 OSM si activaste paso 6).

---

## Estado actual (31/07/2026)

- [x] Parches B5/B6/B6b en gateway (server.ts: group resolution dynamic, alicia dedup, extractItemsFromSearchResult extrae `parsed.data.sources`)
- [x] Parches C1–C7 en MCP backend (mcp.ts, tool-timeouts.ts, spacy_server.py)
- [x] **Patches C9a + C9b + C9c + C9d + C9e + C9f + C10** (search.ts + latam-repositories.ts): eliminan `Provider timeout` en `search` standalone probeado via gateway. C9a floor 90s race; C9b auto-skip DME; C9c skip OAI-PMH fallback 30-60s; C9d skip 2 fetches secuenciales fallback 25s+20s; C9e amplía skip OAI-PMH a queries A2-split (era el hueco que dejó C9c); C9f dedup alicia cuando renati presente en path raw (evita rate-limit mutuo VuFind); C10 skip fallbacks secuenciales RENATI cuando raceMs<180s (detectado via codebase-memory graph analysis). Validado con query de producción `mercado de abastos Chimbote higiene salubridad vendedores`: antes `Provider timeout` 90005ms / 0 resultados; ahora alicia sola 22 found en 65-70s, alicia+renati 40s sin timeout, renati vía gateway 11.6s con 10 resultados.
- [x] **Patch C11** (markitdown-client.ts): modo HTTP API via `MARKITDOWN_API_URL`. Arregla motor markitdown roto en clean installs (antes siempre caía a `pdf-parse` porque el installer nunca empaquetó `pymupdf4llm` ni `scripts/pdf_to_markdown.py`). Ahora delega a API FastAPI standalone (puerto 7860, `D:\OTROS\markitdown-api\app.py`) vía env var. Markitdown verificado `available:true` en clean install A. La API standalone es opcional; sin ella, router usa `mineru-api` (remoto) o `pdf-parse` (nativo).
- [x] **Fix `cd /d` en start-mcp-local.cmd**: necesario para que `dotenv.config()` encuentre el `.env` en el install. Sin esto, tokens (`MINERU_API_KEY`, `HF_TOKEN`, etc.) no cargaban en clean install → `mineru.available:false` pese a `.env` copiado correctamente. Verificado: con `cd /d`, los 3 backends (`mineru-api`, `markitdown`, `pdf-parse`) quedan `available:true` en clean install desde 0.
- [x] spaCy es_core_news_lg (602 MB, 500k word vectors 300-dim) instalado en el python-runtime del installer
- [x] Test final: smart_search('delito homicidio peru') retorna 53 papers (30 RENATI + 23 global, atomic_multisource_success) en 192s, dentro del timeout 300s
- [x] Installer MCP-V11-Local y LetXipu Desktop HF instalados y funcionales en LocalAppData/Programs
- [x] OSM-MCP: installer local funcional (~12 MB, sin inyección de env vars). `osmmcp.exe` Go 1.24.1 expone 28 tools OSM via HTTP+SSE en `127.0.0.1:7082/mcp`
- [x] Activación OSM local en gateway verificada: geocode_address("Lima, Peru") via `http://127.0.0.1:43123/api/mcp/call` → 1.074s, lat=-12.046 lon=-77.03
- [x] Degradación verificada: si OSM local cae, gateway sigue vivo (`status=ok, mcpBackendReady=true`); tool académicas siguen funcionales
- [x] **Dos variantes de installer MCP-V11-Local**:
  - `MCP-V11-Local-Setup-A 0.0.0.exe` (518.68 MB): `.env` con tokens válidos incluidos (`MINERU_API_KEY`, `HF_TOKEN`, etc.). Funciona de 0 en cualquier PC con internet. **NO distribuir públicamente** — los tokens son personales.
  - `MCP-V11-Local-Setup-B 0.0.0.exe` (518.68 MB): `.env` plantilla vacía (sin tokens). El usuario pega sus propios tokens siguiendo `INSTRUCCIONES-TOKENS.md` instalado en `%LOCALAPPDATA%\Programs\MCP-V11-Local\INSTRUCCIONES-TOKENS.md`. Apto para distribución pública.
- [x] Carpeta distribución limpia con 5 installers (EJECUTABLES/ incluyendo 2 variants MCP A y B) + 3 source ZIPs (CODIGO-FUENTE/) + este documento
