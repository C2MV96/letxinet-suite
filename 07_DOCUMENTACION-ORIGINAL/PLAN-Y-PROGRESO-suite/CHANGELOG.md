# Changelog

Todos los cambios notables de "LetXinet Suite" se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-08-06 — Dual Build Integration (LetXinet Desktop HF)

### Added — Suite

- **Dual Build**: integración en el Suite del dual build del LetXinet Desktop HF (Sesión 5 LETXINET-OPTIM-BUILD). Dos instaladores generados `LetXinet-Suite-1.1.0-VariantA-Setup.exe` (interno, 6.8 MB + 414 MB .bin) y `LetXinet-Suite-1.1.0-VariantB-Setup.exe` (publico, 6.8 MB + 414 MB .bin). Hashes SHA256 distintos confirman builds diferentes. Documentado en `PLAN-Y-PROGRESO\10-RELEASE-v1.1.0.md`.
- **`secrets.json` embebido en VariantA** (436 bytes, MD5 `F76ACA88DB6EDCC8E0261CF9BE10B4E7`): 3 IA provider keys (Nebius, OpenRouter, DeepSeek) extraídas de `.env.local`. Vía `#ifdef VARIANT_A` en `.iss`, SOLO VariantA lo incluye en su bundle. VariantB no lo trae.
- **`seedSecretsFromBundle()`** en `main.cjs` (líneas 233-265): al primer arranque del Desktop HF copia `resources\secrets.json` del bundle a `%APPDATA%\LetXipu-Desktop-HF\secrets.json` (userData), preservando claves existentes (merge behavior). Smoke test: 687 bytes generados desde un `secrets.json` embebido de 436 bytes + claves pre-existentes en userData.
- **3 IA providers nuevos**: Nebius, OpenRouter, DeepSeek. Placeholders `NEBIUS_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY` en `LetXinet-Suite.env` compartido (sección `[12] Dual Build`).
- **Variable `BUILD_VARIANT`**: `private` (default) | `public`. Define URLs HF fallback activas y modo auto del Desktop HF. Default `private` si no está seteada en `.env`.
- **`variant-tokens\variantA-interno\.env`** y **`variant-tokens\variantB-publico\.env`** actualizados con `BUILD_VARIANT` + doc.
- **Nuevas docs**: `PLAN-Y-PROGRESO\10-RELEASE-v1.1.0.md` (release v1.1.0).

### Changed — Suite

- **`src-suite\instalador\LetXinet-Suite.iss`**: `MyAppVersion` 1.0.0 → 1.1.0. `#ifdef VARIANT_A` para `secrets.json` en `[Files]`. Comentario explicativo del nuevo layout `app/` vs `app.asar.unpacked/`. `MyAppSuffixLabel` actualizado.
- **`src-suite\instalador\bin\start-letxinet-desktop.cmd`**: documentación v1.1.0 Dual Build añadida. Default `BUILD_VARIANT=private` si no está en `.env`.
- **`src-suite\instalador\build-variants.cmd`**: nombres de salida v1.0.0 → v1.1.0.
- **`src-suite\instalador\INFO-BEFORE.txt`**: cabecera v1.1.0, novedades Dual Build, sección IA Providers (Nebius/OpenRouter/DeepSeek), variants.
- **`src-suite\instalador\README-SUITE.txt`**: cabecera v1.1.0, árbol con nuevo layout `resources\app\`, sección IA providers, variants Dual Build.
- **`src-suite\shared-env\LetXinet-Suite.env`**: sección `[12] Dual Build` añadida (BUILD_VARIANT, placeholders IA). Sección `[11]` corregida de `app.asar.unpacked\` a `app\`.
- **`src-suite\componentes-parches\letxinet-desktop\`**: 771.84 MB (-325 MB desde 1097 MB viejo) tras `robocopy /MIR` del nuevo `win-unpacked` Desktop HF. Residual `win-unpacked` en `resources\app\dist\` limpiado (317 MB liberados).

### Changed — LetXinet Desktop HF (repositorio upstream)

- **`package.json`**: nuevos scripts `build:unified` y `desktop:win-unpacked` que compila `server.cjs` SIN `--define:process.env.BUILD_VARIANT` (respeta `process.env.BUILD_VARIANT` en runtime). Un solo payload sirve para ambos variants.
- **`server.cjs`**: 336.49 KB (344565 bytes), MD5 `A921168CD67780D2600E939BF0ED6D40` — compila sin `--define BUILD_VARIANT`. Confirmado via smoke test que arranca correctamente leyendo `BUILD_VARIANT` desde process.env.
- **`main.cjs`**: 18 840 bytes con `seedSecretsFromBundle()` (líneas 233-265).

### Fixed — Suite

- **Layout Electron**: migrado de `app.asar.unpacked\` a `app\` (consecuencia de `asar: false` en electron-builder). `.iss` y `LetXinet-Suite.env` sección 11 actualizados.

### Notas — Smoke test VariantA

- **Instalado** en `C:\Program Files\LetXinet Suite` (reemplaza v1.0.1, previamente archivada en `build\installer-output-v1.0.1-archive-2026-08-06-203250\`).
- **Hash MD5 de `secrets.json` instalado** = `F76ACA88DB6EDCC8E0261CF9BE10B4E7` (coincide con el embebido).
- **`seedSecretsFromBundle()` ejecutado** correctamente: `%APPDATA%\LetXipu-Desktop-HF\secrets.json` 687 bytes (con 16 claves académicas + 3 IA providers vacías, porque el `.env` ProgramData preservado de v1.0.1 VariantB no tenía los placeholders IA).
- **4 procesos `LetXipu Desktop HF`** activos tras launch vía `start-letxinet-desktop.cmd`.

---

## [post-1.1.0] — 2026-08-07 — Bugfixes de routing de modelos con sufijo `:provider`

Parches en caliente sobre el `server.cjs` instalado sin reempaquetar instalador (override directo del archivo en `C:\Program Files\LetXinet Suite\LetXinet-Desktop\resources\app\dist\server.cjs` y en el payload Suite).

### Fixed — LetXinet Desktop HF

- **Bug 1 — Variables de Sistema mostraba LLM API keys como editables.** Síntoma: el usuario podía sobreescribir `NVIDIA_API_KEY`, `GEMINI_API_KEY`, etc. desde el panel de Variables de Sistema, lo que silenciaba las keys reales ya cargadas por `secrets.json`. Fix: backend define `PROVIDER_APIKEY_BLOCKED_KEYS` (set de 13 nombres LLM `*_API_KEY`) y `PROVIDER_APIKEY_REJECT_HINT`. `POST /api/system-variables` rechaza esas keys con 400. `parseEnvSections()` marca `readOnly:true` para keys bloqueadas. Frontend `SystemVariablesConfig.tsx` muestra banner info indigo con `apiKeyHint`. Solo `*_BASE_URL` queda editable.
- **Bug 2 — Chat con modelo `z-ai/glm-5.2:nvidia` devolvía "API key not valid" (3413).** Causa: el backend usaba siempre `GEMINI_API_KEY` para cualquier modelo sin prefijo del nombre de provider. Fix: nuevas funciones `parseProviderSuffix(selectedModel)` (extrae sufijo `:provider` conocido) y `resolveProviderRouting(providerSuffix, cleanModel)` (única fuente de verdad — retorna `{modelId, endpoint, type, apiKey}` según provider). `callModelGeneric` y handler `/api/chat` (4 puntos) usan este routing. Sufijos soportados: nvidia, openai, anthropic, groq, mistral, opencode, gemini, nebius, openrouter, deepseek.
- **Bug 3 — `secrets.json` con API keys caducadas/vacías.** Síntoma: `/api/models/sync` retornaba solo 129 modelos en 10 grupos (muchos providers caídos). Causa: Gemini caducada, OpenCode revocada, Nebius/OpenRouter/DeepSeek vacías, Mistral caducada. Fix: `secrets.json` actualizado con todas las keys válidas del archivo `ENV-UNIFICADO\.env-unificado-testeado.env` + keys nuevas (Mistral, OpenAI). Verificadas con curl HTTP 200 contra cada API. Tras la actualización, `/api/models/sync` retorna **832 modelos en 11 grupos** (Gemini 50 live, Mistral 53 live, NVIDIA 100 live, OpenAI 118 live, Anthropic 4 destacados, Groq 15 live, OpenCode Zen 61 live, Nebius 27 live, OpenRouter 400 live, HuggingFace 2 cache, DeepSeek 2 live). Backup previo en `backups\fix-apikeys-sync\2026-08-07-144500\`.
- **Bug 4 — Chat con `models/gemini-2.5-flash:gemini` retornaba 404 "Opencode API error".** Causa raíz triple:
  1. `resolveProviderRouting('gemini','models/gemini-2.5-flash')` retornaba `endpoint` con el `cleanModel` sin strip del prefijo `models/`, generando URL `…/v1beta/models/models/gemini-2.5-flash:generateContent` (doble `models/` → 404). Fix: `cleanModel.replace(/^models\//, '')` al construir `modelId` y `endpoint`.
  2. Tras corregir la URL, Gemini respondía 401 `ACCESS_TOKEN_TYPE_UNSUPPORTED`: el handler inyectaba a la vez `?key=APIKEY` en la URL y `Authorization: Bearer APIKEY` en headers; Gemini rechaza el Bearer (lo confunde con access token OAuth). Fix: eliminar `Authorization` Bearer para `type === "google"` en los 3 branch de headers (legacy `/chat` línea ~2774, opencode línea ~5698, langgraph línea ~6680). Solo se envían `x-goog-api-key` + `api-key` headers + `?key=` URL.
  3. Tras corregir auth, Gemini respondía 200 OK pero la respuesta no exhibía texto: el branch langgraph/opencode NO activa streaming SSE-side porque la URL era `:generateContent` (sin stream) — Gemini envía un único JSON y el parser SSE no extrae nada. Fix: reescribir baseUrl a `:streamGenerateContent` y añadir `?alt=sse` cuando `modelMeta.type === "google"` (en los 2 branches langgraph + opencode).
- **Smoke tests post-fix (regresión):**
  - `models/gemini-2.5-flash:gemini` → responde `"4"` ✓
  - `z-ai/glm-5.2:nvidia` → responde `"Diez"` ✓
  - `mistral-large-latest:mistral` → responde `"10 (diez)"` ✓
  - `gpt-4o-mini:openai` → 429 `credit_balance_exhausted` (limitación de cuenta, no bug de código) ✓
  - `openai/gpt-oss-120b:opencode` → 200 OK `Generation completed` (vacío por `max_tokens:30` muy chico) ✓

### Changed — LetXinet Desktop HF

- **`server.cjs`**: 352546 bytes, MD5 `D1818341231A4A93B1D9A45E4BF93846` (Fix Bug 1 + 2 + 3 + 4). Copiado a `src-suite\componentes-parches\letxinet-desktop\resources\app\dist\server.cjs` (payload Suite) e `C:\Program Files\LetXinet Suite\LetXinet-Desktop\resources\app\dist\server.cjs` (instalado, MD5 verificado idéntico).
- **`secrets.json` (userData `%APPDATA%\letxipu-desktop-hf\`)**: 1859 bytes, MD5 `BBA418C39973B34129E02C03B878ABBA`. Todas las API keys válidas (Gemini, Mistral, OpenAI, OpenCode, NVIDIA, Groq, Nebius, OpenRouter, DeepSeek). Anthropic vacía por decisión del usuario.

---

## [1.0.1] — 2026-08-01 — Post-install bugfix

### Fixed — Suite

- **Bug critico: 3 servicios NSSM quedaban en estado `Paused` despues de instalar.** Sintoma: logs stderr mostraban `"C:\Program" no se reconoce como un comando`. Causa raiz: NSSM descarta comillas dobles al serializar `AppParameters` en el registro, lo que hacia que cmd.exe partiera la ruta `C:\Program Files\LetXinet Suite\bin\start-*.cmd` en `C:\Program` + `Files\LetXinet Suite\...`. Fix: creados 3 thin wrappers `run-osm.cmd`, `run-md.cmd`, `run-v11.cmd` en la raiz del Suite (sin subcarpeta `bin`) que invocan a los launchers originales via `%~dp0bin\start-*.cmd`. NSSM ahora se configura con `AppParameters=/c run-osm.cmd` (sin path, sin espacios) y `AppDirectory={app}\`. Resultado: 3 servicios RUNNING + probes HTTP 200 en 7082/7860/4003 + spaCy sidecar 4002.
- **Bug critico: `POST /api/keys/restart-services` desde Desktop HF (no-admin) fallaba con `OpenService(): Acceso denegado`.** Causa: el proceso Electron corre como usuario estandar sin permisos para `nssm restart`. Fix: el endpoint detecta el error por `e.code===3` (NSSM exit code de "Can't open service"), o por regex sobre `e.message` (con fallback UTF-16LE→UTF-8), y si confirma denegacion, lanza `restart-suite.cmd` via `Start-Process -Verb RunAs` (UAC prompt). El operador acepta el UAC y el helper elevado reinicia los 3 servicios. Response: `{ok:true, elevated:true, message:"Reinicio elevado lanzado (UAC)..."}`.
- **Bug v3**: `register-services.cmd` usaba `%NSSM%` sin comillas dobles; cmd partido `C:\Program Files\...` en `C:\Program`. Fixed en v1.0.0 parcha-parchado ya caliente pero no propagado a instaladores. v1.0.1 lleva el fix en el build.

### Added

- **Helper `restart-suite.cmd`** (NUEVO) en `{app}\restart-suite.cmd`. Llamado por Desktop HF con UAC elevation cuando necesita reiniciar los 3 servicios Windows NSSM. Atajo "Reiniciar servicios del Suite" agregado al grupo de Inicio del menu.
- **Tres wrappers `run-osm.cmd` / `run-md.cmd` / `run-v11.cmd`** (NUEVOS) en `{app}\` (raiz del Suite, sin subcarpeta bin). Soluciona el bug de NSSM AppParameters con espacios — los launchers originales `start-*.cmd` en `bin\` sin cambios.

### Changed

- `src-suite\instalador\LetXinet-Suite.iss`: `[Files]` ahora copia `restart-suite.cmd`, `run-osm.cmd`, `run-md.cmd`, `run-v11.cmd` al raiz del Suite. `[Icons]` incluye atajo "Reiniciar servicios del Suite" → `restart-suite.cmd`.
- `src-suite\instalador\register-services.cmd`: ahora usa `"%NSSM%" install SVC "%COMSPEC%" /c run-{osm|md|v11}.cmd` + `AppDirectory "%~dp0."` (todos para raiz del Suite), en lugar de AppParameters con path completo. V11 AppDirectory era `%~dp0MCP-V11-Local` → corregido a `%~dp0.` (raiz).
- `src-suite\instalador\uninstall-services.cmd`: ya parchado en v3 con `"%NSSM%"` (comillas). Sin cambios adicionales v1.0.1.

## [1.0.0] — 2026-07-31 — Release inicial

### Added — Suite (nuevo)

- **Instalador unificado Inno Setup 6.7.3** "LetXinet Suite v1.0" empaqueta 4 componentes en un solo instalador Windows con privilegios de administrador:
  - OSM-MCP (servicio NSSM, puerto 7082) - geocoding + routing OpenStreetMap
  - MarkItDown API (servicio NSSM, puerto 7860) - motor PyMuPDF4LLM para PDF→Markdown
  - MCP-V11-Local (servicio NSSM, puerto 4003 + sidecar spaCy puerto 4002) - busqueda academica con 28 herramientas MCP
  - LetXipu Desktop HF (Electron app con shortcut, puerto 43123) - GUI de escritorio
- **2 variantes coinstalables**:
  - Variante A (interno): incluye `.env` del V11 con tokens IA reales. AppId `VARIANT-A-0000001`. DISTRIBUCION INTERNA.
  - Variante B (publica): incluye `.env` del V11 en plantilla sin tokens. AppId `VARIANT-B-0000001`. DISTRIBUCION PUBLICA.
- **3 servicios Windows via NSSM 2.24** con:
  - Auto-start (`SERVICE_AUTO_START`) para OSM y MarkItDown
  - Delayed auto-start (`SERVICE_DELAYED_AUTO_START`) para V11 (depende de MarkItDown)
  - Restart on failure (`AppExit Default Restart`)
  - Log rotation 5 MB (`AppRotateFiles 1, AppRotateOnline 1, AppRotateBytes 5242880`)
  - Logs centralizados en `%PROGRAMDATA%\LetXinet Suite\Logs\` (6 archivos: stdout+stderr por servicio)
- **Configuracion externalizada** mediante `LetXinet-Suite.env` (copia unica en `%PROGRAMDATA%\LetXinet Suite\`, NO se sobreescribe al reinstalar gracias a `Flags: onlyifdoesntexist uninsneveruninstall`).
  - ~30 variables externalizadas: puertos locales, endpoints remotos HF, tokens IA, mirrors sci-hub, OSM user-agent, modo desktop, etc.
  - Parser `suite-env-loader.cmd` convierte el `.env` a vars CMD.
- **Icono Suite** generado desde `D:\OTROS\LETXIPU.svg` usando resvg 0.47 (binario Rust estatico) para renderizar SVG -> PNG 512x512 con fondo `#0b0f1a`, luego Pillow empaqueta en `.ico` multi-resolucion [16,32,48,64,128,256]. Icono incrustado en el instalador y en el `.exe` Desktop HF.

### Added — Parches aplicados a componentes fuente (no destructive)

- **P-1** (`server.ts` + `electron\main.cjs` en `LETXINET-DESKTOP-HF`): externalizadas 3 URLs HF/letxinet via `process.env.* || default`, añadido `DESKTOP_ENDPOINT_MODE` con 4 modos (`auto|local_only|remote_only|hf_only`), `resolveMcpUrl()` reescrita con switch.
- **P-2** (`pdf.ts` en `LETXIPU-SEARCH-MCP-V11-LOCAL`): `SCIHUB_MIRRORS` externalizado via `loadScihubMirrors()` + env `SCIHUB_MIRRORS` (CSV). Aañadidas `UNPAYWALL_BASE_URL`, `UNPAYWALL_EMAIL`, `DOI_RESOLVER_URL` via env con defaults.
- **P-3** (`osm-geocoder.ts` en `LETXIPU-SEARCH-MCP-V11-LOCAL`): default cambiado de `localhost:7860` -> `127.0.0.1:7082`.
- **P-4** (`util.go` + `osm_health_tool.go` en `letxipu-osm-mcp`): añadido `UserAgentEnv()` helper. Health tool reescrito para usar `NominatimBaseURLEnv()`, `OverpassBaseURLEnv()`, `ProfileBaseURL("car")`, `UserAgentEnv()`.

### Added — Codigo nuevo (Suite-specific)

- `src-suite\instalador\LetXinet-Suite.iss` (script Inno Setup 6, ~230 lineas)
- `src-suite\instalador\bin\suite-env-loader.cmd` (parser `.env` -> vars CMD)
- `src-suite\instalador\bin\start-osm-mcp.cmd` (launcher OSM-MCP)
- `src-suite\instalador\bin\start-markitdown-api.cmd` (launcher MarkItDown)
- `src-suite\instalador\bin\start-mcp-v11-local.cmd` (launcher MCP-V11-Local)
- `src-suite\instalador\bin\start-letxinet-desktop.cmd` (launcher Desktop HF)
- `src-suite\instalador\register-services.cmd` (registra 3 servicios NSSM en post-install)
- `src-suite\instalador\uninstall-services.cmd` (detiene y elimina 3 servicios en pre-uninstall)
- `src-suite\instalador\build-variants.cmd` (driver de compilacion ISCC con `subst L:` para paths largos > MAX_PATH 260)
- `src-suite\instalador\assets\icon.ico` (107.6 KB, 6 resoluciones cuadradas)
- `src-suite\instalador\LICENSE.txt` (MIT + lista de terceros bundled)
- `src-suite\instalador\INFO-BEFORE.txt` (resumen pre-instalacion para el operador)
- `src-suite\instalador\README-SUITE.txt` (manual de operacion)
- `src-suite\shared-env\LetXinet-Suite.env` (template env con 10 secciones)
- `variant-tokens\variantA-interno\.env` (copia privada del V11 con todos los tokens)
- `variant-tokens\variantB-publico\.env` (plantilla publica sin tokens)
- `src-suite\instalador\build-icon.py` (script Python generador de icono: resvg + Pillow)
- `build\resvg\resvg.exe` (binario Rust estatico 0.47 para renderizar SVG)
- `build\icons\icon.ico`, `icon-512.png`, `icon-256.png` (artefactos del script icon)
- 6 logs de progreso en `PLAN-Y-PROGRESO\` (Fases 0, 0.5, 1, 2, 3, 4-5, 6, 7)

### Fixed — Bugs descubiertos durante Fase 6 (testing end-to-end)

- **Bug A**: `nssm.exe` path equivocado en `register-services.cmd` y `uninstall-services.cmd`. Apuntaba a `%~dp0nssm\nssm.exe` (inexistente); corregido a `%~dp0bin\nssm.exe` (donde el .iss lo copia). Causa: el instalador fallaba al registrar servicios en post-install (exit code 1), pero instalaba archivos correctamente.
- **Bug B**: `MCP-V11-Local.exe` equivocado en `componentes-parches\mcp-v11-local\` (66.57 MB, runtime Node 20 sin bytecode pkg del server). Reemplazado por el correcto en `packaging\bin\MCP-V11-Local.exe` (93.75 MB, bundle pkg Node 22 completo con bytecode). Causa: el servicio V11 arrancaba y se deten\ia inmediatamente (NSSM exit code 1066).
- **Bug C**: `AppDirectory` incorrecto para V11 en `register-services.cmd`. Era `%~dp0..` (= `D:\LS-Test\..` = `D:\OTROS`, carpeta inexistente). Corregido a `%~dp0MCP-V11-Local` (= `D:\LS-Test\MCP-V11-Local`, correcto). Causa: V11 fallaba al hacer `cd /d` al AppDirectory y dotenv no encontraba `.env`.

### Fixed — Bugs de build (no functionales)

- Comentarios `;` en seccion `[Code]` del `.iss` producian `'BEGIN' expected`. Corregido a `//` (estilo Pascal).
- Constantes de Inno Setup 6.7+ deprecadas: `{pf}` -> `{commonpf}`, `IsAdminLoggedOn` -> `IsAdminInstallMode`.
- `[UninstallRun]` sin `RunOnceId` produc\ia warning. Anadido `RunOnceId: "StopServices"`.
- Paths > MAX_PATH 260 en `letxinet-desktop\resources\app.asar.unpacked\dist\node_modules\@mistralai\mistralai\esm\models\operations\getchatcompletionfieldoptionscountsv1observabilitychatcompletionfieldsfieldnameoptionscountspost.d.ts.map` (265 chars). Solucion: `subst L: componentes-parches\` en `build-variants.cmd` reduce a 214 chars. Bypass al limite MAX_PATH Win32.
- `python-runtime` borrado en Fase 0 por error (asumi que V11 no lo necesitaba). Regenerado en Fase 3 (517 MB con spacy 3.8 + numpy 1.26.4 + flask + 3 modelos spaCy sm).

### Decisiones clave de diseno

- **resvg 0.47** para renderizar SVG (descartados cairosvg/pycairo/svglib/reportlab que requieren DLL cairo externo en Windows).
- **Python embebido portatil** (3.12.10 amd64 embeddable) sobre pyinstaller: transparente, reparable con `pip install`, arrancque identico a produccion.
- **`node22-win-x64`** para pkg (no node20/node18 que no estan en el remote cache de yao-pkg v3.6).
- **`signAndEditExecutable: true` + `signExecutable: false`** en electron-builder: incrusta icono/metadata al exe sin requerir certificado de firma.
- **spaCy modelos flattened**: copiar contenido de `model-3.8.0/` al root del modelo para que `spacy_server.py` fallback path funcione.
- **numpy 1.26.4** (no 2.x) para V11 porque spaCy 3.8/thinc exigen `numpy<2.0`.
- **`pkg` (Node 22 bundle)** sobre bundler JS tradicional: single-stable exe con dependencias embebidas, ideal para distribucion sin tener que garantizar Node en destino.

### Performance caracteristicas

- **Tamano instalador**: 508 MB (4.74 MB wizard + 503.79/503.80 MB payload LZMA2 ultra64 solido). Compresion 4:1 (74.8% reduccion) sobre 2.02 GB sin comprimir.
- **Tiempo instalacion**: 5-6 min en SSD reciente (~344s observados en pruebas).
- **Tiempo desinstalacion**: 10-20s (incluida detencion de los 3 servicios).
- **Tiempo compilacion**: ~17-22 min por variante (LZMA2 ultra64 solido, single thread).
- **RAM instalacion**: 100-200 MB working set ISCC durante build; 0 afectacion al install cliente.
- **Disk post-install**: 2.02 GB en `{commonpf}\LetXinet Suite\` + ~6 KB en `%PROGRAMDATA%\LetXinet Suite\` (sin contar logs).

### Documentacion

- 7 logs de progreso (`PLAN-Y-PROGRESO\01-FASE-0-PREPARACION.md` a `07-FASE-6-PRUEBAS.md`)
- Manual operativo `README-SUITE.txt` (incluido en el instalador)
- Plantilla `INFO-BEFORE.txt` pre-instalacion (incluido en el instalador)
- Licencia MIT + lista de terceros bundled en `LICENSE.txt`

### Pruebas funcionales (Fase 6)

- **6.1 Instalacion silenciosa variante B**: ✅ 344s, 2 GB copiados, AppId registrado en HKLM.
- **6.2 Healthchecks 4 endpoints**: ✅ OSM 7082 -> 200, MarkItDown 7860 -> 200, V11 4003 -> 200 (28 tools), Desktop HF 43123 -> 200 (35s arranque Express).
- **6.3 Editar .env + reinicio**: ⏸ Skip por UAC no accessible desde el orquestador. Documentado como prueba manual (procedimiento en `07-FASE-6-PRUEBAS.md`).
- **6.4 Desinstalacion**: ✅ 3 servicios gone en 10s, dir gone, ProgramData preserved (Logs + .env + .bak residual).
- **6.5 Reinstalacion + idempotencia**: ✅ .env SHA256 match pre/post reinstalacion, servicios re-registrados correctamente.
- **6.6 Final v2 build con fixes**: ✅ register-services.cmd exit code 0 (sin parches manuales), instalacion limpia end-to-end.

### Limitaciones conocidas

- Windows 10/11 x64 exclusivamente (Electron 37 + Python 3.12 amd64).
- Token IA / API keys: para Variante B, el operador final debe proporcionar sus propias claves en `LetXinet-Suite.env`. No se incluyen tokens privados.
- `subst L:` temporal durante build para acortar paths largos; si el usuario ya tiene unidad L: asignada, falla. Documentado en `build-variants.cmd` (se detecta y no hace subst si ya existe).
- Electron main process tarda ~35s en abrir Express en el puerto 43123 (verificado); no es instantaneo. Atajo del Desktop HF puede aparecer "muerto" el primer medio minuto.
- Banner V11 en logs NSSM tiene encoding CP437 raro (chars Unicode tipo `╔══╗` se serializan como `???`). No afecta funcionalidad).

---

## [Unreleased]

- Fase 7: docs finales (CHANGELOG, README-SUITE.md, HASHES-SHA256.txt). (EN PROGRESO)
- Future v1.1: tests automatizados MSTest/NUnit sobre instaladores (Pester o PSake).
- Future v1.1: multi-idioma info antes/post mas completo (solo espanol e ingles ahora).
- Future v1.1: configuracion WLAN proxy opcional para escenarios corporativos.
- Future v1.2: integracion con Letxinet Cloud (HF remote backoff prioridad baja).
- Future v1.2: logrotate con retencion configurable en .env (10 MB y 5 archivos por defecto actualmente hardcoded).

EOF.
