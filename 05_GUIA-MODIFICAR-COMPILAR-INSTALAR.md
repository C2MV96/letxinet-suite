# Guía técnica: modificar, compilar, empaquetar e instalar LetXinet Suite v1.1.0 y LetXinet Addon Bridges v1.0.0

**Versión documentada:** LetXinet Suite **v1.1.0, regenerada el 07/08/2026** (sesión 7, con las correcciones Bug 1-4) y **LetXinet Addon Bridges v1.0.0** (09/08/2026).
**Fecha de redacción:** 02/11/2026.
**Fuentes:** `LINEA-DE-TIEMPO-ARTEFACTOS.md`, `PLAN-Y-PROGRESO\*.md` (00, 06, 08, 10, CHANGELOG, README-SUITE), `src-suite\instalador\*`, `INSTRUCCIONES-RECONSTRUIR.md`, `EMPAQUETADO.md`, `package.json` de Desktop HF y V11, `LetXinet-Addon-Bridges.iss` + `scripts\`, `ZIPS-SESION-7-HASHES.md`. Donde la guía añade una conclusión propia (por ejemplo, tras leer el código), se marca como **[Análisis]**.

> **Seguridad.** Esta guía no contiene ninguna clave, token ni contraseña. Solo se nombran las variables (por ejemplo `MINERU_API_KEY`). La **Variante A** lleva claves reales embebidas y es **solo para uso personal**: no la publiques, no la subas a GitHub y no la compartas.

> **Actualización del 06/11/2026:** la forma recomendada de recompilar es `02_CODIGO-FUENTE\recompilar-todo.cmd` (ver `LEEME-RECOMPILAR.md`, en esa misma carpeta). Las rutas `D:\OTROS\…` de esta guía son las de la PC original.
>
> **⚠️ V11 ejecuta el código embebido en `MCP-V11-Local.exe`, no el de `dist\`.** Editar `dist\` en una instalación no tiene efecto: hay que cambiar `src\` y regenerar el `.exe`.
>
> **Actualización del 07/11/2026 (Suite 1.1.2):**
> - El instalador trae Node.js LTS y configura solo Claude Code, Claude Desktop y OpenCode.
> - Las secciones 6.x sobre instalar Node a mano y copiar configuraciones de `03_CONFIG…` quedan como referencia; lo vigente está en `03_CONFIG-CLAUDE-CODE-OPENCODE\LEEME-CLIENTES.md`.
> - Los servicios escuchan solo en `127.0.0.1` (`LETXINET_BIND_HOST`).
> - Detalle en `08_REPORTE…` §3.12.
>
> **Actualización del 08/11/2026 (Suite 1.1.3):**
> - V11 bloquea las URL internas en todas las herramientas (`utils\url-segura.ts`).
> - Los tiempos límite cubren todas las esperas; `convert_document` funciona con URL y `extract_tables` reconoce tablas.
> - Búsqueda peruana con filtro de pertinencia (`LETXINET_FILTRO_REPOSITORIOS=false` lo desactiva).
> - Sci-Hub y WeLib desactivados de fábrica (`SCIHUB_MIRRORS`, `WELIB_ENABLED`).
> - Ejemplo completo del `.env` en `03_CONFIG-CLAUDE-CODE-OPENCODE\LetXinet-Suite.env.ejemplo`.
> - Detalle en `08_REPORTE…` §3.13.
>
> **Actualización del 08/11/2026 (Suite 1.1.4):**
> - Los dos Python embebidos (MarkItDown y V11) llevan `msvcp140.dll` de Visual C++ (`02_CODIGO-FUENTE\runtime-extra`). Sin él, MarkItDown no arranca en laptops que no tienen Visual C++.
> - LetXinet Desktop espera hasta 10 minutos a su backend (`LETXIPU_BACKEND_TIMEOUT_MS`) y muestra una ventana de «Iniciando...».
> - Arreglo para instalaciones 1.1.3: `04_SCRIPTS-MANTENIMIENTO\arreglo-1.1.3\arreglar-letxinet.cmd`.
> - Detalle en `08_REPORTE…` §3.14.
>
> **Actualización del 09/11/2026 (Suite 1.1.5):**
> - El Python de MarkItDown lleva numpy 2.3.5 (`02_CODIGO-FUENTE\runtime-extra\numpy-2.3.5-cp312-cp312-win_amd64.whl`) en lugar de 2.5.1, que exigía SSE4.2. `recompilar-todo.ps1` lo cambia en el payload y comprueba que cargue.
> - `letxinet-jobs-bridge.cjs`: las tareas se presentan como `letxinet-jobs-bridge/1.1.5` (V11 les da 600 s en vez de 114 s); `gateway_poll` informa los errores y valida el `task_id`; se borran las tareas de más de 24 h.
> - V11: la ubicación detectada vale solo para la petición en curso (`src\utils\geo-context.ts`); `search` acepta `maxResults` y `maxSources` es un alias.
> - Skill `letxinet-investigacion-academica`: recomienda `search` y varias `search` seguidas en lugar de `batch_search`.
> - Detalle en `08_REPORTE…` §3.15 y en `06_INFORMES-Y-PRUEBAS\pruebas-busqueda-2026-11-09.md`.

> **Disco D: lleno (100 %).** Todas las rutas de origen están en `D:\OTROS\`. Antes de compilar, lee la sección 5.4: hay que mandar la salida y las copias de trabajo a otro disco (C: u otro), porque los builds escriben cientos de MB.

---

## Índice

1. [Arquitectura](#1-arquitectura)
2. [Variantes A y B](#2-variantes-a-pública-no--personal-y-b-pública)
3. [Requisitos de compilación](#3-requisitos-de-compilación-pc-de-desarrollo)
4. [Modificar y recompilar cada componente](#4-modificar-y-recompilar-cada-componente)
5. [Regenerar los instaladores (Suite y Addon)](#5-regenerar-los-instaladores)
6. [Instalar en otra laptop](#6-instalar-en-otra-laptop)
7. [Problemas conocidos y parches](#7-problemas-conocidos-y-parches)
8. [Tabla de artefactos vigentes](#8-tabla-de-artefactos-vigentes)

---

## 1. Arquitectura

### 1.1 Componentes y puertos

| # | Componente | Tecnología | Puerto(s) | Cómo corre | Nombre del servicio |
|---|---|---|---|---|---|
| 1 | **OSM-MCP** | Go (`osmmcp.exe`, fork `github.com/NERVsystems/osmmcp`, Go 1.24.1) | **7082** (HTTP+SSE, `/mcp`) + **9090** (métricas Prometheus) | Servicio NSSM, inicio automático | `LetXinetSuiteOSMMCP` |
| 2 | **MarkItDown API** | Python 3.12.10 embebido + FastAPI + uvicorn + pymupdf4llm | **7860** (`GET /`, `POST /convert`) | Servicio NSSM, inicio automático | `LetXinetSuiteMarkitDown` |
| 3 | **MCP-V11-Local** | TypeScript → Node 22 empaquetado con `pkg` (`MCP-V11-Local.exe`) + sidecar spaCy (Flask, Python 3.12 embebido) | **4003** (HTTP+SSE, `/api/mcp`, `/health`, `/api/health`) + **4002** (spaCy, `/health`) | Servicio NSSM, **inicio automático retrasado** (espera a MarkItDown) | `LetXinetSuiteMCPV11` |
| 4 | **LetXinet Desktop HF** | Electron 37 + React/Vite + backend Express (`dist/server.cjs`) | **43123** (gateway Express: `/health`, `/api/health`, `/api/mcp/*`) | **No es servicio**: es una app de escritorio lanzada desde un acceso directo | — |

Flujo resumido:

```
LetXipu Desktop HF.exe (Electron)
 └─ main.cjs ─spawn─> dist/server.cjs (Express, 127.0.0.1:43123)  ← gateway
        ├─> MCP-V11-Local   http://127.0.0.1:4003/api/mcp  (servicio NSSM)
        │       └─> sidecar spaCy  127.0.0.1:4002  (lo lanza el propio V11)
        │       └─> MarkItDown API  http://127.0.0.1:7860   (PDF → Markdown)
        ├─> OSM-MCP          http://127.0.0.1:7082/mcp     (servicio NSSM)
        └─> fallback remoto (HF Spaces / letxinet.lat) según DESKTOP_ENDPOINT_MODE / BUILD_VARIANT
```

Modos de endpoints del Desktop (`DESKTOP_ENDPOINT_MODE`): `auto` (local primero, remoto como reserva; valor por defecto), `local_only`, `remote_only`, `hf_only`.

### 1.2 Servicios NSSM (registrados por `register-services.cmd`)

| Servicio | Application | AppParameters | AppDirectory | Inicio | Logs |
|---|---|---|---|---|---|
| `LetXinetSuiteOSMMCP` | `%COMSPEC%` (cmd.exe) | `/c run-osm.cmd` | raíz del Suite | `SERVICE_AUTO_START` | `osm-mcp.stdout.log` / `.stderr.log` |
| `LetXinetSuiteMarkitDown` | `%COMSPEC%` | `/c run-md.cmd` | raíz del Suite | `SERVICE_AUTO_START` | `markitdown-api.stdout.log` / `.stderr.log` |
| `LetXinetSuiteMCPV11` | `%COMSPEC%` | `/c run-v11.cmd` | raíz del Suite | `SERVICE_DELAYED_AUTO_START` | `mcp-v11-local.stdout.log` / `.stderr.log` |

Todos los servicios usan `AppExit Default Restart` (se reinician si fallan) y rotación de logs a 5 MB (`AppRotateFiles 1`, `AppRotateOnline 1`, `AppRotateBytes 5242880`). Cadena de arranque: `run-*.cmd` (raíz) → `bin\start-*.cmd` → `bin\suite-env-loader.cmd` (carga el `.env`) → binario.

> Los envoltorios `run-*.cmd` existen porque NSSM elimina las comillas de `AppParameters` y cmd partía `C:\Program Files\...` en dos (bug de la v1.0.1, ver sección 7).

### 1.3 Rutas de instalación

```
C:\Program Files\LetXinet Suite\                 ({app}; carpeta por defecto: {commonpf}\LetXinet Suite)
├── bin\                     suite-env-loader.cmd, start-osm-mcp.cmd, start-markitdown-api.cmd,
│                            start-mcp-v11-local.cmd, start-letxinet-desktop.cmd,
│                            configure-keys.cmd, set-env-key.ps1, nssm.exe (NSSM 2.24 win64)
├── OSM-MCP\osmmcp.exe
├── MarkItDown\API\          app.py, requirements.txt, mcp-adapter\markitdown-mcp.js, python-runtime\
├── MCP-V11-Local\           MCP-V11-Local.exe, start-mcp-local.cmd, dist\, python\ (spacy_server.py + modelos sm),
│                            python-runtime\ (Python 3.12 embebido + spaCy 3.8 + numpy 1.26.4), .env (variante A o B)
├── LetXinet-Desktop\        LetXipu Desktop HF.exe, resources\app\{dist,electron,node_modules,package.json},
│                            resources\secrets.json (solo Variante A)
├── assets\icon.ico
├── register-services.cmd, uninstall-services.cmd, restart-suite.cmd
├── run-osm.cmd, run-md.cmd, run-v11.cmd
└── README-SUITE.txt, LICENSE.txt, INFO-BEFORE.txt, unins000.exe/.dat

C:\ProgramData\LetXinet Suite\                   ({commonappdata}\LetXinet Suite)
├── LetXinet-Suite.env       ← ARCHIVO .env CENTRAL (se conserva al reinstalar y al desinstalar)
└── Logs\                    ← logs de los 3 servicios + restart-suite.log (no se borran al desinstalar)

%APPDATA%\letxipu-desktop-hf\                    ← userData de Electron
├── secrets.json             ← claves de IA/académicas que usa el Desktop
└── backend.log              ← log del backend Express
%TEMP%\letxipu-desktop-main.log                  ← log del proceso principal de Electron
```

### 1.4 Archivo `.env` central

**Ruta:** `C:\ProgramData\LetXinet Suite\LetXinet-Suite.env` (plantilla en el código fuente: `D:\OTROS\LETXINET-SUITE\src-suite\shared-env\LetXinet-Suite.env`).

- El instalador lo copia con `Flags: onlyifdoesntexist uninsneveruninstall`: **solo se crea si no existe** y **no se borra** al desinstalar. Una reinstalación no pisa tu configuración.
- Lo leen todos los launchers mediante `suite-env-loader.cmd`. Las variables de este archivo **mandan** sobre el `.env` interno del V11 (`{app}\MCP-V11-Local\.env`), que sí se sobrescribe al reinstalar.
- Formato: una línea `CLAVE=VALOR`, comentarios con `#`, sin comillas.

Secciones de la plantilla v1.1.0 (solo nombres de variables):

| Sección | Variables |
|---|---|
| [1] Puertos | `OSM_MCP_PORT` (7082), `OSM_METRICS_PORT` (9090), `MCP_V11_PORT` (4003), `SPACY_PORT` (4002), `MARKITDOWN_API_PORT` (7860), `DESKTOP_PORT` (43123), `LETXIPU_DESKTOP_PORT` (43123), `LOCAL_MCP_URL`, `LOCAL_MCP_PORT` |
| [2] Modo Desktop | `DESKTOP_ENDPOINT_MODE` (`auto`) |
| [3] Remotos | `LETXIPU_MCP_URL`, `LETXIPU_OSM_MCP_URL`, `LETXINET_MCP_URL` (vacíos = valores por defecto) |
| [4] OSM | `OSM_USER_AGENT` (opcional: `NOMINATIM_URL`, `OVERPASS_URL`, `OSRM_URL_*`, `TILE_SERVER_URL`) |
| [5] V11 | `SCIHUB_MIRRORS`, `UNPAYWALL_BASE_URL`, `UNPAYWALL_EMAIL`, `DOI_RESOLVER_URL`, `DOC_EXTRACTOR_MODE`, `ALLOW_REMOTE_EXTRACTION`, `MARKITDOWN_ENABLED`, `MARKITDOWN_PYTHON`, `EXTRACTOR_TIMEOUT_MS`, `EXTRACTOR_MAX_MB`, `MAX_BATCH_CONCURRENCY`, `PROVIDER_TIMEOUT_MS`, `PROVIDER_GATE_TTL_MS`, `RENATI_ATTEMPT_TIMEOUT_MS`, `MARKITDOWN_API_URL`, `SPACY_MODEL`, `SPACY_CACHE_ROOT`, `SPACY_SCRIPT` |
| [6] MinerU | `MINERU_API_KEY`, `MINERU_API_URL`, `MINERU_TIMEOUT` |
| [7] Fuentes académicas | `CORE_API_KEY`, `SCOPUS_API_KEY`, `SEMANTIC_SCHOLAR_API_KEY`, `SERP_API_KEY`, `SERPAPI_KEY`, `HF_TOKEN`, `REDALYC_TOKEN`, `OPENALEX_MAILTO`, `OPENALEX_DAILY_CAP` |
| [8] Modelos IA | `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_TOKEN`, `OPENAI_API_KEY`, `OPENAI_TOKEN`, `GROQ_API_KEY`, `GROQ_TOKEN`, `MISTRAL_API_KEY`, `MISTRAL_BASE_URL`, `NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, `OPENCODE_API_KEY`, `OPENCODE_BASE_URL` |
| [9] Logging | `LOG_LEVEL` |
| [10]-[11] | Opciones avanzadas de MarkItDown y Electron (comentadas) |
| [12] Dual Build | `BUILD_VARIANT` (`private` por defecto), `NEBIUS_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY` |

En la plantilla del código fuente todas las variables `*_API_KEY`/`*_TOKEN` están **vacías**.

---

## 2. Variantes A (privada, solo personal) y B (pública)

| | **Variante A** (interna / personal) | **Variante B** (pública) |
|---|---|---|
| Define ISPP | `/DVARIANT_A` | `/DVARIANT_B` (es el valor por defecto si no se define nada) |
| AppId | `{7F8B9C2D-LETX-SUITE-2026-VARIANT-A-0000001}` | `{7F8B9C2D-LETX-SUITE-2026-VARIANT-B-0000001}` |
| `.env` del V11 | `D:\OTROS\LETXINET-SUITE\variant-tokens\variantA-interno\.env` (**con claves reales**: `MINERU_API_KEY`, `CORE_API_KEY`, `SCOPUS_API_KEY`, `SEMANTIC_SCHOLAR_API_KEY`, `SERP_API_KEY`, `HF_TOKEN`, `REDALYC_TOKEN`; `BUILD_VARIANT=private`) | `D:\OTROS\LETXINET-SUITE\variant-tokens\variantB-publico\.env` (mismas variables **vacías**, `BUILD_VARIANT=public`) |
| `secrets.json` del Desktop | **Sí**: `componentes-parches\letxinet-desktop\resources\secrets.json` (1 859 bytes, MD5 `BBA418C39973B34129E02C03B878ABBA`, 9 claves de IA: Gemini, Mistral, OpenAI, OpenCode, NVIDIA, Groq, Nebius, OpenRouter, DeepSeek) | No (ver advertencia más abajo) |
| Asistente de claves al terminar | No | Sí (`bin\configure-keys.cmd`, se omite en instalación silenciosa) |
| Tamaño | `.exe` 6,77 MB + `.bin` 413,34 MB | `.exe` 6,77 MB + `.bin` 202,63 MB |
| Uso | **SOLO personal.** No distribuir. | Distribución pública. El operador pone sus claves. |

A y B tienen AppId distinto, así que **pueden coexistir** en la misma máquina (en la práctica conviene instalar solo una: comparten carpeta por defecto, nombres de servicio y puertos).

### 2.1 Cómo se generan

1. **`variant-tokens`**: la carpeta real que usa el `.iss` es `D:\OTROS\LETXINET-SUITE\variant-tokens\` (rutas relativas `..\..\variant-tokens\...` desde `src-suite\instalador\`). Las carpetas `src-suite\variant-tokens\variantA-publicar-interno\` y `variantB-publicar-publico\` del plan original están **vacías** y no se usan.
2. **`LetXinet-Suite.iss`** elige con `#ifdef VARIANT_A`:
   - qué `.env` copia a `{app}\MCP-V11-Local\`;
   - si añade `resources\secrets.json` (bloque `#ifdef VARIANT_A`);
   - si lanza `configure-keys.cmd` al terminar (`#ifdef VARIANT_B`);
   - el sufijo del archivo de salida (`-VariantA` / `-VariantB`) y el AppId.
3. **`build-variants.cmd`** llama dos veces a ISCC (`/DVARIANT_A` y `/DVARIANT_B`) con `/DPAYLOAD_ROOT="L:\"` y salida en `build\installer-output\variantA\` y `variantB\`.
4. **`main.cjs` (`seedSecretsFromBundle()`)**: en el primer arranque copia `resources\secrets.json` a `%APPDATA%\letxipu-desktop-hf\secrets.json`. **[Análisis]** El código del payload actual **no sobrescribe** un `secrets.json` que ya exista en userData (“user config wins”), aunque los documentos de la v1.1.0 hablan de “merge”. Si reinstalas la Variante A en un equipo que ya tenía `secrets.json`, las claves nuevas no se copian solas (ver 6.6).

> **ADVERTENCIA [Análisis] sobre la Variante B.** En el `.iss`, la línea `Source: "{#PAYLOAD_ROOT}\letxinet-desktop\*"; ... recursesubdirs` copia **toda** la carpeta `letxinet-desktop`, y el payload contiene `resources\secrets.json` con claves reales. El bloque `#ifdef VARIANT_A` solo añade el archivo una segunda vez; **no lo excluye en B**. Antes de **distribuir** una Variante B regenerada, haz una de estas dos cosas:
> - añade `Excludes: "resources\secrets.json"` a esa línea `Source` (recomendado), o
> - saca `secrets.json` del payload mientras compilas B.
>
> Después compruébalo: instala B en una máquina de pruebas y verifica que **no** existe `C:\Program Files\LetXinet Suite\LetXinet-Desktop\resources\secrets.json`. Haz también esta prueba con la Variante B ya publicada (`01_INSTALADORES\`) antes de compartirla. La diferencia de tamaño del `.bin` (B 202 MB frente a A 413 MB) no basta para saber si el archivo está dentro.

> **Nota sobre `BUILD_VARIANT` [Análisis].** Las dos variantes copian **el mismo** `shared-env\LetXinet-Suite.env`, que trae `BUILD_VARIANT=private`. El `.env` público del V11 trae `public`, pero el Desktop lee el de ProgramData. Si quieres que una instalación B se comporte como “public” (sin reserva remota de HF, `local_only`), edita `BUILD_VARIANT=public` en `C:\ProgramData\LetXinet Suite\LetXinet-Suite.env`.

---

## 3. Requisitos de compilación (PC de desarrollo)

| Herramienta | Versión documentada | Uso | Ruta / notas |
|---|---|---|---|
| **Inno Setup 6** | **6.7.3** (`winget install JRSoftware.InnoSetup --version 6.7.3`) | Compilar `LetXinet-Suite.iss` y `LetXinet-Addon-Bridges.iss` | Instalado por usuario: `%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe` (es la ruta que usa `build-variants.cmd`). El comentario del `.iss` del Addon menciona `C:\Program Files\Inno Setup 6\ISCC.exe`: usa la ruta en la que lo tengas. Requiere 6.7+ (`{commonpf}`, `IsAdminInstallMode`). |
| Inno Setup 7 | — | Solo para los instaladores **antiguos e independientes** (V11-Setup, OSM-Setup), no para el Suite | `C:\Users\USER\AppData\Local\Programs\Inno Setup 7\ISCC.exe` |
| **Node.js** | Node 24 / npm 11 en la máquina de build (plan maestro); Desktop HF documentado con Node 22.21.1 (22+); V11 compila con `tsc` (Node 18+/20+) | Desktop HF y V11 | — |
| **@yao-pkg/pkg** | **6.21.0**, target **`node22-win-x64`** (runtime Node **22.22.3**) | Empaquetar `MCP-V11-Local.exe` | Prebuilt manual: `https://github.com/yao-pkg/pkg-fetch/releases/download/v3.6/node-v22.22.3-win-x64` → `%USERPROFILE%\.pkg-cache\v3.6\node-v22.22.3-win-x64`. **No uses** node18/node20 (dan 404 en la caché remota y pkg intenta compilar Node desde el código fuente). |
| **TypeScript** | ~5.8 (Desktop), ^5.7 (V11) | `tsc` | devDependency |
| **esbuild** | ^0.25 | Bundle `server.ts` → `dist/server.cjs` | devDependency |
| **Vite** | ^6.2.3 | Frontend React | dependency |
| **Electron** | ^37.2.5 (runtime real 37.10.3) | App de escritorio | devDependency |
| **electron-builder** | ^26.0.12 | `--win dir` → `dist\win-unpacked\` | devDependency; NSIS 3.0.4.1 se descarga solo |
| **Go** | `go.mod` pide **1.24.1** (en la máquina de build había Go 1.26) | Compilar OSM-MCP | `vendor\` ya presente (si falta: `go mod vendor`) |
| **Python 3.12.10 embed amd64** | `python-3.12.10-embed-amd64.zip` (python.org) | `python-runtime\` de MarkItDown y del sidecar spaCy | Hay que editar `python312._pth` y hacer bootstrap de pip (sección 4.4) |
| **Python 3.12 completo** | 3.12.10 en `C:\Users\USER\AppData\Local\Programs\Python\Python312\` | Scripts de icono (resvg + Pillow), `.venv` de omni-word-mcp | — |
| **NSSM** | **2.24** win64 | Servicios Windows | `src-suite\instalador\nssm\nssm.exe` (ya incluido) |
| resvg | 0.47 | Icono (opcional) | `D:\OTROS\LETXINET-SUITE\build\resvg\resvg.exe` |
| cross-env | ^7.0.3 | Scripts `desktop:dist:public/private` (no se usan en el Suite) | devDependency |

**Espacio necesario:** el payload sin comprimir pesa unos 2 GB (`componentes-parches`). Un build del Desktop genera `win-unpacked` (~1 GB). La compilación LZMA2 ultra64 tarda **17-28 min por variante** y usa archivos temporales en `%TEMP%`. Calcula **al menos 5 GB libres** en el disco donde trabajes.

---

## 4. Modificar y recompilar cada componente

### 4.0 Esquema general: código fuente → payload → instalador

| Componente | Repo fuente (editar aquí) | Artefacto compilado | Payload que empaqueta el `.iss` |
|---|---|---|---|
| Desktop HF | `D:\OTROS\LETXINET-DESKTOP-HF\` | `dist\win-unpacked\` | `D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\letxinet-desktop\` |
| MCP-V11-Local | `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\` | `dist\` + `packaging\bin\MCP-V11-Local.exe` | `...\componentes-parches\mcp-v11-local\` (`MCP-V11-Local.exe`, `dist\`, `python\`, `python-runtime\`, `start-mcp-local.cmd`) |
| OSM-MCP | `D:\OTROS\letxipu-osm-mcp\` | `osmmcp-patched.exe` | `...\componentes-parches\osm-mcp\osmmcp.exe` |
| MarkItDown | `D:\OTROS\markitdown-api\` (`app.py`, `mcp-adapter\`) | — (Python interpretado) | `...\componentes-parches\markitdown-api\markitdown-payload\` (`app.py`, `requirements.txt`, `mcp-adapter\`, `python-runtime\`) |
| Scripts del Suite | `D:\OTROS\LETXINET-SUITE\src-suite\instalador\` | — | Se empaquetan directamente |

Comprobación de integridad actual (MD5 leídos el 02/11/2026):

| Archivo | Repo | Payload | ¿Iguales? |
|---|---|---|---|
| `osmmcp-patched.exe` / `osmmcp.exe` | `09A7C633…3B43BD` | `09A7C633…3B43BD` | Sí |
| `MCP-V11-Local.exe` | `60374F6A…64725E` | `60374F6A…64725E` | Sí |
| `server.cjs` | `A64F8D74…C0E6A1` (359 904 B, 16/08/2026) | `D1818341…BF93846` (352 546 B, v1.1.0 sesión 7) | **No**: el repo del Desktop tiene cambios **posteriores** a la v1.1.0 (parches 8/10 del 15-16/08, ver sección 7.5). |

> Para **reproducir exactamente** la v1.1.0, no recompiles el Desktop desde el repo actual: usa el payload tal cual (ya lleva `server.cjs` D18183…) o el zip `fuentes-desktop-hf-v1.5.8-bugfix-v1.1.0.zip`. Si recompilas desde el repo, el resultado ya no será la v1.1.0.

### 4.1 LetXinet Desktop HF (server.ts → dist/server.cjs, frontend y Electron)

**Estructura relevante**

| Ruta | Rol |
|---|---|
| `server.ts` | Backend Express (gateway, enrutado de modelos, Bug 1-4) |
| `src\` | Frontend React (p. ej. `SystemVariablesConfig.tsx`, `App.tsx`, `AgentChat.tsx`) |
| `index.html`, `vite.config.ts` | Build del frontend |
| `electron\main.cjs`, `electron\preload.cjs` | Proceso principal: lanza `server.cjs` con `ELECTRON_RUN_AS_NODE=1`, espera `/health`, `seedSecretsFromBundle()`, `maybeStartLocalMcp()` |
| `scripts\install-deps.cjs` | Escribe `dist\package.json` y ejecuta `npm install --production` en `dist\` (**crítico**) |
| `package.json` → `build` | `asar: false`, `files: dist/**/*, electron/**/*, package.json`, `icon: build/icon.ico` |

Scripts npm útiles: `build`, `build:unified` (el que usa el Suite: **sin** `--define BUILD_VARIANT`, la variante se decide en tiempo de ejecución), `desktop:win-unpacked` (= `build:unified` + `electron-builder --win dir`), `lint` (`tsc --noEmit`).

**Paso a paso** (PowerShell; trabaja en una copia fuera de D: si D: sigue lleno, ver 5.4):

```powershell
cd D:\OTROS\LETXINET-DESKTOP-HF        # o tu copia de trabajo en C:

# 0) Solo la primera vez o si cambió package.json
npm install

# 1) Edita server.ts, src\*, electron\main.cjs ...

# 2) Comprobar tipos
npm run lint                            # tsc --noEmit (sin errores)

# 3) Matar procesos y limpiar artefactos (electron-builder no sobrescribe bien)
Get-Process "LetXipu Desktop HF","node","electron" -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item .\dist\win-unpacked, .\dist\win-unpacked.tmp -Recurse -Force -ErrorAction SilentlyContinue

# 4) Build unificado + carpeta portable (lo que usa el Suite)
npm run desktop:win-unpacked
#   = vite build                              -> dist\index.html + dist\assets\
#   + esbuild server.ts ... -> dist\server.cjs (sin --define BUILD_VARIANT)
#   + node scripts\install-deps.cjs           -> dist\node_modules\ (~151 paquetes, ~40 s)
#   + electron-builder --win dir              -> dist\win-unpacked\LetXipu Desktop HF.exe (~3 min)
```

Reglas de `EMPAQUETADO.md` que no hay que romper:

- Toda dependencia que `server.cjs` haga `require()` al arrancar debe estar **también** en `prodDeps` de `scripts\install-deps.cjs`; si no, no llega al empaquetado (`Cannot find module ...`).
- Los imports que solo se usan en desarrollo (por ejemplo `vite`) van como `import()` dinámico.
- No pases flags de Chromium (`--no-sandbox`, `--disable-gpu`) al lanzar el backend con `ELECTRON_RUN_AS_NODE=1`, y no uses `utilityProcess.fork` con Electron 37.
- No bajes el timeout de 30 s de `waitForBackend`.
- Si cambias `productName`, cambia la carpeta userData y se pierden los `secrets.json` guardados.

**Verificar el build antes de copiarlo:**

```powershell
$exe = ".\dist\win-unpacked\LetXipu Desktop HF.exe"
Start-Process $exe; Start-Sleep 25
Get-Content "$env:TEMP\letxipu-desktop-main.log" -Tail 20      # debe decir "Backend healthy"
Invoke-WebRequest http://127.0.0.1:43123/health -UseBasicParsing # 200
Get-Content "$env:APPDATA\letxipu-desktop-hf\backend.log" -Tail 20
```

**Copiar al payload del Suite** (procedimiento de la sesión 6):

```powershell
$src = "D:\OTROS\LETXINET-DESKTOP-HF\dist\win-unpacked"
$dst = "D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\letxinet-desktop"

# (a) GUARDA ANTES secrets.json: robocopy /MIR lo borraría porque win-unpacked no lo trae
Copy-Item "$dst\resources\secrets.json" "$env:TEMP\secrets.json.bak" -ErrorAction SilentlyContinue

# (b) Espejo
robocopy $src $dst /MIR /R:1 /W:1

# (c) Limpia restos: un win-unpacked antiguo dentro de dist\ acaba metido en resources\app\dist\ (en la sesión 6 se liberaron 317 MB)
Remove-Item "$dst\resources\app\dist\win-unpacked" -Recurse -Force -ErrorAction SilentlyContinue

# (d) Solo para compilar la Variante A: devolver secrets.json
Copy-Item "$env:TEMP\secrets.json.bak" "$dst\resources\secrets.json"
```

**Parche en caliente (solo `server.cjs`)**, como se hizo con los Bug 1-4:

```powershell
npm run build:unified    # solo regenera dist\ (no hace falta electron-builder)
Copy-Item .\dist\server.cjs "D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\letxinet-desktop\resources\app\dist\server.cjs" -Force
# En una máquina ya instalada (como admin, con el Desktop cerrado):
Copy-Item .\dist\server.cjs "C:\Program Files\LetXinet Suite\LetXinet-Desktop\resources\app\dist\server.cjs" -Force
Get-FileHash -Algorithm MD5 "C:\Program Files\LetXinet Suite\LetXinet-Desktop\resources\app\dist\server.cjs"
```

**`secrets.json` de la Variante A:** se genera aparte (en la v1.1.0, desde `D:\OTROS\LETXINET-DESKTOP-HF\build\secrets.json` y después actualizado con las claves verificadas) y se coloca en `componentes-parches\letxinet-desktop\resources\secrets.json`. Es un JSON con claves del estilo `geminiApiKey`, `mistralApiKey`, `nvidiaApiKey`, `opencodeApiKey`, `openaiApiKey`, `groqApiKey`, `anthropicApiKey`, `mineruApiKey`, `hfToken`, etc. **Nunca lo subas a un repositorio.**

### 4.2 MCP-V11-Local (TS → dist → MCP-V11-Local.exe con pkg)

**Estructura relevante:** `src\routes\mcp.ts`, `search.ts`, `pdf.ts`, `src\providers\*.ts` (28 providers), `src\utils\*` (spacy-client, osm-geocoder, tool-timeouts, reranking), `src\python\spacy_server.py`, `src\config\*.json`, `src\data\*.json` (assets de pkg).

```powershell
cd D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL

# 0) Primera vez
npm install

# 1) Edita src\*.ts (o src\python\spacy_server.py)

# 2) Typecheck + compilación TS -> dist\
npx tsc --noEmit
npm run build                                   # tsc -> dist\server.js, dist\routes\*.js, ...

# 3) Empaquetar con pkg en node22 (NO uses "npm run pkg": ese script apunta a node18)
#    Requiere el prebuilt de node-v22.22.3-win-x64 en %USERPROFILE%\.pkg-cache\v3.6\
& .\node_modules\.bin\pkg . --targets node22-win-x64 --output packaging\bin\MCP-V11-Local.exe
#    Salida: packaging\bin\MCP-V11-Local.exe (~93,75 MB, ~2 min)
```

**Copiar al payload del Suite:**

```powershell
$p = "D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\mcp-v11-local"
Copy-Item .\packaging\bin\MCP-V11-Local.exe "$p\MCP-V11-Local.exe" -Force
robocopy .\dist "$p\dist" /E /R:1 /W:1               # el launcher ejecuta MCP-V11-Local.exe dist\server.js
# Solo si cambiaste el sidecar:
Copy-Item .\src\python\spacy_server.py "$p\python\spacy_server.py" -Force
```

Notas:

- El launcher de producción (`bin\start-mcp-v11-local.cmd`) hace `cd /d {app}\MCP-V11-Local` (para que `dotenv` encuentre `.env`) y ejecuta `MCP-V11-Local.exe "{app}\MCP-V11-Local\dist\server.js"` con `PORT`, `SPACY_PORT`, `SPACY_PYTHON`, `SPACY_SCRIPT`, `SPACY_CACHE_ROOT`, `MARKITDOWN_API_URL` y `LETXIPU_DESKTOP_GATEWAY=true`.
- Bug B de la v1.0.0: un `MCP-V11-Local.exe` de 66,57 MB (solo runtime, sin bytecode) hacía que el servicio muriera con el código 1066. El exe correcto es el de pkg de **~93,75 MB** (`packaging\bin\`).
- `packaging\build-portable.cjs` (`npm run package`) es del instalador antiguo con electron-builder: **no** forma parte del flujo del Suite.
- `install.ps1`, en la raíz del repo V11, **no pertenece al V11**: es el instalador de `codebase-memory-mcp`. No lo uses para el Suite.
- Parches documentados en el código: P-2 (`SCIHUB_MIRRORS`, `UNPAYWALL_*`, `DOI_RESOLVER_URL` en `pdf.ts`), P-3 (`OSM_MCP_URL` por defecto `127.0.0.1:7082`), C1-C11 (timeouts, ALICIA/RENATI, `MARKITDOWN_API_URL`).

**`python-runtime` del sidecar spaCy** (solo si hay que regenerarlo; está en el payload):

```powershell
# 1) Python embed
Invoke-WebRequest https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip -OutFile py.zip
Expand-Archive py.zip -DestinationPath .\python-runtime
# 2) Editar python-runtime\python312._pth -> añadir "Lib" y "Lib\site-packages" y descomentar "import site"
# 3) pip
Invoke-WebRequest https://bootstrap.pypa.io/get-pip.py -OutFile get-pip.py
.\python-runtime\python.exe get-pip.py --no-warn-script-location
# 4) Dependencias (numpy < 2 es obligatorio para spaCy 3.8/thinc)
.\python-runtime\python.exe -m pip install "spacy>=3.8,<3.9" "flask>=3.0.0" "click>=8.0"
.\python-runtime\python.exe -m pip install "numpy>=1.24,<2.0"
.\python-runtime\python.exe -m pip install "pymupdf4llm>=0.0.17" "pymupdf>=1.24.0"
# 5) Modelos sm (en_core_web_sm, es_core_news_sm, pt_core_news_sm): copiar el contenido de
#    <modelo>\<modelo>-3.8.0\ al nivel <modelo>\ (flatten) para que exista <modelo>\config.cfg
```

### 4.3 OSM-MCP (go build)

```powershell
cd D:\OTROS\letxipu-osm-mcp
# go mod vendor                      # solo si falta vendor\ o cambió go.mod
# Edita cmd\osmmcp\main.go, pkg\osm\util.go, pkg\tools\*.go ...
go build -o osmmcp-patched.exe ./cmd/osmmcp
#  (opcional, binario más pequeño)  go build -o osmmcp-patched.exe -ldflags="-s -w" ./cmd/osmmcp

# Prueba rápida en un puerto libre
.\osmmcp-patched.exe -enable-http -http-only -http-addr 127.0.0.1:17082 -user-agent "Suite-Test/1.0"

# Copiar al payload (el .iss espera el nombre osmmcp.exe)
Copy-Item .\osmmcp-patched.exe "D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\osm-mcp\osmmcp.exe" -Force
```

El launcher lo arranca con `-enable-http -http-only -http-addr ":%OSM_MCP_PORT%" -monitoring-addr ":%OSM_METRICS_PORT%" -user-agent "%OSM_USER_AGENT%"`. Parche P-4: `UserAgentEnv()` y health tool con `NominatimBaseURLEnv()`, `OverpassBaseURLEnv()` y `ProfileBaseURL("car")`.

### 4.4 MarkItDown API (app.py y runtime)

- Código fuente: `D:\OTROS\markitdown-api\app.py` (FastAPI: `GET /` y `POST /convert`) y `mcp-adapter\markitdown-mcp.js` (adaptador stdio para opencode, lee `MARKITDOWN_API_URL`).
- Copia que se empaqueta: `D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\markitdown-api\markitdown-payload\` (la línea de tiempo indica que es la copia vigente para editar).

```powershell
# Tras editar app.py en el repo:
$m = "D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\markitdown-api\markitdown-payload"
Copy-Item D:\OTROS\markitdown-api\app.py "$m\app.py" -Force
Copy-Item D:\OTROS\markitdown-api\mcp-adapter\* "$m\mcp-adapter\" -Recurse -Force

# Prueba local con el runtime del payload (puerto libre)
cd $m
.\python-runtime\python.exe -c "import fastapi, uvicorn, pymupdf4llm; print('OK')"
.\python-runtime\python.exe -m uvicorn app:app --host 127.0.0.1 --port 17860 --app-dir "$m"
```

**Regenerar `python-runtime`** (si hace falta): mismo procedimiento que en 4.2 (embed 3.12.10 + `_pth` + get-pip) e instalar:

```powershell
.\python-runtime\python.exe -m pip install --no-cache-dir --disable-pip-version-check fastapi uvicorn python-multipart pymupdf4llm pymupdf
```

Versiones que quedaron en la v1.1.0: fastapi 0.141.1, uvicorn 0.52.0, python-multipart 0.0.32, pymupdf4llm 1.28.0, pymupdf 1.28.0 (con onnxruntime 1.28.0 y numpy 2.5.1 como transitivas; ~241 MB en site-packages).

### 4.5 Scripts del Suite

Edítalos en `D:\OTROS\LETXINET-SUITE\src-suite\instalador\` (`bin\*.cmd`, `register-services.cmd`, `run-*.cmd`, `restart-suite.cmd`, `uninstall-services.cmd`, `README-SUITE.txt`, `INFO-BEFORE.txt`) y en `src-suite\shared-env\LetXinet-Suite.env`. Si cambias la versión, actualiza:

- `#define MyAppVersion "1.1.0"` en `LetXinet-Suite.iss`;
- las rutas `LetXinet-Suite-1.1.0-Variant?-Setup.exe` en `build-variants.cmd` (está escrita a mano: si no la cambias, el script dará el build por fallido).

---

## 5. Regenerar los instaladores

### 5.1 Suite (.iss → .exe + .bin) con `build-variants.cmd`

**Archivos y rutas exactas**

| Elemento | Ruta |
|---|---|
| Script Inno | `D:\OTROS\LETXINET-SUITE\src-suite\instalador\LetXinet-Suite.iss` |
| Driver | `D:\OTROS\LETXINET-SUITE\src-suite\instalador\build-variants.cmd` |
| Payload | `D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\` (se monta con `subst L:`) |
| `.env` por variante | `D:\OTROS\LETXINET-SUITE\variant-tokens\variantA-interno\.env`, `...\variantB-publico\.env` |
| Plantilla `.env` central | `D:\OTROS\LETXINET-SUITE\src-suite\shared-env\LetXinet-Suite.env` |
| Salida | `D:\OTROS\LETXINET-SUITE\build\installer-output\variantA\` y `variantB\` |

Opciones clave del `.iss`: `Compression=lzma2/ultra64`, `SolidCompression=yes`, `LZMAUseSeparateProcess=yes`, `DiskSpanning=yes`, `DiskSliceSize=700000000` (por eso sale un `.exe` de ~7 MB más un `-1.bin`), `ArchitecturesAllowed=x64compatible`, `PrivilegesRequired=admin`, `SetupIconFile=assets\icon.ico`, idiomas español e inglés.

**Pasos**

```cmd
:: 1) Comprueba que existen (ver 4.x): osm-mcp\osmmcp.exe, mcp-v11-local\..., markitdown-api\markitdown-payload\...,
::    letxinet-desktop\... y, SOLO para A, letxinet-desktop\resources\secrets.json
:: 2) La unidad L: debe estar LIBRE (si ya existe, el script no hace subst y el build falla)
:: 3) Desde una consola cmd normal:
cd /d D:\OTROS\LETXINET-SUITE\src-suite\instalador
build-variants.cmd          :: las dos variantes (A y luego B)
build-variants.cmd A        :: solo Variante A (personal)
build-variants.cmd B        :: solo Variante B (pública)
```

Qué hace `build-variants.cmd`:

1. Comprueba `%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe`.
2. `subst L: "...\componentes-parches"` para acortar las rutas largas (>260 caracteres en `node_modules`).
3. Ejecuta:

   ```cmd
   "%ISCC%" /DVARIANT_A /DPAYLOAD_ROOT="L:\" /O"%OUTROOT%\variantA" "%ISS%"
   "%ISCC%" /DVARIANT_B /DPAYLOAD_ROOT="L:\" /O"%OUTROOT%\variantB" "%ISS%"
   ```

4. Comprueba que existe `LetXinet-Suite-1.1.0-Variant?-Setup.exe` y hace `subst L: /d`.

Tiempo: unos 17-28 min por variante. Se puede guardar el log redirigiendo la salida (`build-variants.cmd B > build-B.log 2>&1`).

**Después del build: hashes**

```powershell
cd D:\OTROS\LETXINET-SUITE\build\installer-output
Get-ChildItem -Recurse -Include *.exe,*.bin | ForEach-Object {
  "{0}  {1}  ({2} bytes)" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash, $_.Name, $_.Length
} | Out-File -Encoding ascii HASHES-SHA256-nuevo.txt
```

### 5.2 Compilar a mano con ISCC (sin el driver)

```cmd
subst L: "D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches"
"%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" /DVARIANT_B /DPAYLOAD_ROOT="L:\" /O"C:\LetXinet-Build\variantB" "D:\OTROS\LETXINET-SUITE\src-suite\instalador\LetXinet-Suite.iss"
subst L: /d
```

`/O` sustituye a `OutputDir`. Las demás rutas relativas del `.iss` (`..\shared-env`, `..\..\variant-tokens`, `bin\`, `nssm\`, `assets\`) se resuelven desde la carpeta del `.iss`, así que el `.iss` debe quedarse en su sitio (o copiar el árbol `LETXINET-SUITE` completo respetando la estructura).

### 5.3 Addon Bridges v1.0.0

| Elemento | Ruta |
|---|---|
| Script | `D:\OTROS\LETXINET-ADDON-BUILD\LetXinet-Addon-Bridges.iss` |
| Fuentes (`MySourceDir`, absoluta) | `D:\OTROS\LETXINET-ADDON-BUILD\sources\` → `mcp-bridge.cjs`, `omni-word-mcp\` (incluye `.venv`), `latex-mcp-local\` (con `node_modules` y `dist\`) |
| Scripts (`MyScriptsDir`, absoluta) | `D:\OTROS\LETXINET-ADDON-BUILD\scripts\` → `check-requirements.ps1`, `patch-opencode-config.ps1`, `restore-config.ps1` |
| Salida (`OutputDir`, absoluta) | `D:\OTROS\LETXINET-ADDON-BUILD\output\LetXinet-Addon-Bridges-v1.0.0.exe` (un solo `.exe`, sin `.bin`) |

```cmd
:: Modificar: edita sources\mcp-bridge.cjs, sources\latex-mcp-local\*.ts (y recompila su dist con tsc/npm run build),
:: o scripts\*.ps1. Después:
cd /d D:\OTROS\LETXINET-ADDON-BUILD
"%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" /O"C:\LetXinet-Build\addon" LetXinet-Addon-Bridges.iss
```

Notas del `.iss` del Addon: usa `{pf}` (obsoleto en 6.7: avisa pero compila), `ArchitecturesAllowed=x64`, `PrivilegesRequired=admin`, instala en `C:\Program Files\LetXinet Addon`, solo en español. `MySourceDir`/`MyScriptsDir` son rutas absolutas de D:; si mueves el proyecto, pásalas con `/DMySourceDir=...` solo después de cambiar los `#define` por bloques `#ifndef` (hoy están fijos).

### 5.4 Compilar con D: lleno

1. **No escribas en D:.** Copia el árbol necesario a C: (u otro disco) conservando la estructura relativa:
   - `D:\OTROS\LETXINET-SUITE\src-suite\` (~2 GB por `componentes-parches`) y `D:\OTROS\LETXINET-SUITE\variant-tokens\` en, por ejemplo, `C:\LetXinet-Build\LETXINET-SUITE\`.
2. Ajusta en tu copia de `build-variants.cmd` `OUTROOT` para que apunte a C: (o usa ISCC a mano con `/O`, 5.2).
3. Comprueba que `%TEMP%` (C:) tiene varios GB libres (LZMA usa archivos temporales).
4. Para el Desktop HF, clona o copia el repo a C: antes de `npm run desktop:win-unpacked` (`win-unpacked` pesa ~1 GB).
5. Alternativa sin recompilar: usa los zips de la sesión 7 (sección 8) o los instaladores ya generados.

---

## 6. Instalar en otra laptop

### 6.1 Requisitos del equipo destino

| Requisito | Detalle |
|---|---|
| Sistema | **Windows 10 u 11 de 64 bits (x64)**. No hay versión de 32 bits ni ARM nativa. |
| Permisos | **Cuenta de administrador** (UAC). Necesario para Program Files y para registrar los servicios NSSM. |
| Disco | **≥ 3-4 GB libres** en C: (~1,8 GB instalados en v1.1.0 + temporales de Inno + logs). El destino se puede cambiar en el asistente o con `/DIR=`. |
| Red | Salida HTTPS a Internet (OSM Nominatim/Overpass/OSRM, fuentes académicas, MinerU, proveedores de IA). Los servicios escuchan solo en `127.0.0.1`. |
| Puertos libres | 7082, 9090, 4003, 4002, 7860, 43123 |
| Addon (opcional) | Node.js LTS en el PATH, opencode CLI, Microsoft Word 2016+, Python 3.12.10, distribución LaTeX con XeLaTeX + Biber (MiKTeX o TeX Live). Ver 6.8. |

No hace falta instalar Node ni Python para el **Suite**: lleva su propio runtime (pkg Node 22 y Python 3.12 embebido).

### 6.2 Qué copiar

En el paquete `C:\Users\USER\Downloads\LetXinet-Suite-v1.1.0-Paquete-Completo\01_INSTALADORES\` están la **Variante B** (pública) y el Addon. La Variante A (personal, con claves) está en `C:\Users\USER\Downloads\LetXinet-Suite-v1.1.0-PRIVADO_NO_COMPARTIR\instalador-VariantA\` (y en `D:\OTROS\LETXINET-SUITE\build\installer-output\variantA\`). Ojo: según el `.iss`, la Variante B también incluye `resources\secrets.json` (ver el reporte, §7).

```
01_INSTALADORES\
├── LetXinet-Suite-1.1.0-VariantB-Setup.exe       (7 102 005 bytes)
├── LetXinet-Suite-1.1.0-VariantB-Setup-1.bin     (212 467 732 bytes)   ← MISMA CARPETA que el .exe
├── LetXinet-Addon-Bridges-v1.0.0.exe             (104 114 150 bytes)
└── HASHES-SHA256-v1.1.0-regen-2026-08-07.txt
```

> **El `.exe` y el `.bin` deben estar en la misma carpeta y con su nombre original.** El `Setup.exe` es solo el asistente y busca `...-Setup-1.bin` a su lado. Si no lo encuentra, pedirá el “disco 2” o fallará.

Verifica la integridad en la laptop destino:

```powershell
cd "<carpeta donde copiaste los instaladores>"
Get-FileHash .\LetXinet-Suite-1.1.0-VariantB-Setup.exe, .\LetXinet-Suite-1.1.0-VariantB-Setup-1.bin -Algorithm SHA256
# Esperado (HASHES-SHA256-v1.1.0-regen-2026-08-07.txt):
#   VariantB .exe  D93753B14DB2686AAE6007BF5D7A9D4A5078673C39E2A8D4F183968AAA5DD0B3
#   VariantB .bin  7BD3FBC5272C2B489255B7E5F22B579FC799C493C56C55884D4C69D1CA3EA072
#   VariantA .exe  6F10D5797E2839F0FD613D6E0483BCDF675D33E91791CC31FACC655AF1EBEBED   (solo uso personal)
#   VariantA .bin  314CB5DDDC62BABC4C596BE5800BD344B1C024CE410FF586C5726968B7643B93   (solo uso personal)
```

### 6.3 Orden de instalación

1. **(Si existen) desinstala los productos antiguos independientes** (anteriores al Suite): “MCP-V11-Local”, “OSM-MCP”, “LetXipu Desktop HF” (NSIS). Borra la variable de usuario `LETXIPU_LOCAL_MCP_DIR` si existe. Evita el conflicto de puertos y el EADDRINUSE en 4003 (ver 6.7).
2. **Suite primero:** clic derecho en `LetXinet-Suite-1.1.0-VariantB-Setup.exe` → **Ejecutar como administrador** → acepta el UAC → idioma → licencia → info previa → carpeta (deja `C:\Program Files\LetXinet Suite`: el Addon la busca ahí) → Instalar (5-6 min).
   - Al terminar, `register-services.cmd` registra y arranca los 3 servicios (V11 arranca unos 5 s después de MarkItDown).
   - En la Variante B se ofrece **“Configurar API keys”** (`configure-keys.cmd`), opcional.
3. **Comprueba** servicios y puertos (6.4).
4. **Configura** claves y `.env` (6.5 y 6.6).
5. **Addon después:** `LetXinet-Addon-Bridges-v1.0.0.exe` como administrador (6.8).
6. Abre **“LetXinet Desktop HF”** desde el escritorio o el menú Inicio. El backend tarda ~25-35 s en responder en 43123.

Instalación silenciosa (opcional):

```cmd
LetXinet-Suite-1.1.0-VariantB-Setup.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR="C:\Program Files\LetXinet Suite" /LOG="%TEMP%\install-suite.log"
```

Desinstalación: Panel de control → **LetXinet Suite** → Desinstalar, o `"C:\Program Files\LetXinet Suite\unins000.exe" /VERYSILENT /SUPPRESSMSGBOXES`. Se conservan `C:\ProgramData\LetXinet Suite\LetXinet-Suite.env` y `Logs\`.

### 6.4 Verificación de servicios y puertos

```cmd
sc query LetXinetSuiteOSMMCP     | findstr STATE
sc query LetXinetSuiteMarkitDown | findstr STATE
sc query LetXinetSuiteMCPV11     | findstr STATE
```

```powershell
Get-Service LetXinetSuite* | Format-Table Name, Status, StartType

# ¿Quién escucha en cada puerto?
Get-NetTCPConnection -State Listen -LocalPort 7082,9090,4003,4002,7860,43123 -ErrorAction SilentlyContinue |
  Select-Object LocalPort, OwningProcess, @{n='Proceso';e={(Get-Process -Id $_.OwningProcess).ProcessName}}

# Healthchecks (todos deben devolver 200)
Invoke-WebRequest http://127.0.0.1:7082/          -UseBasicParsing | Select StatusCode   # OSM-MCP
Invoke-WebRequest http://127.0.0.1:7860/          -UseBasicParsing | Select StatusCode   # MarkItDown
Invoke-WebRequest http://127.0.0.1:4003/health    -UseBasicParsing | Select StatusCode   # MCP-V11
(Invoke-WebRequest http://127.0.0.1:4003/api/health -UseBasicParsing).Content             # {"status":"ok","python":true,...}
(Invoke-WebRequest http://127.0.0.1:4002/health   -UseBasicParsing).Content               # spaCy {"ready":true,...} (tras la 1.ª petición)
Invoke-WebRequest http://127.0.0.1:43123/health   -UseBasicParsing | Select StatusCode   # Desktop HF (abre antes la app)

# Smoke test MCP V11: tools/list (28 herramientas)
$body = '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
(Invoke-WebRequest -Uri http://127.0.0.1:4003/api/mcp -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing).Content
```

Logs: `C:\ProgramData\LetXinet Suite\Logs\` (`osm-mcp.*.log`, `markitdown-api.*.log`, `mcp-v11-local.*.log`, `restart-suite.log`), `%APPDATA%\letxipu-desktop-hf\backend.log` y `%TEMP%\letxipu-desktop-main.log`.

### 6.5 Configurar `LetXinet-Suite.env`

- Menú Inicio → **LetXinet Suite → Configurar API keys** (asistente con UAC: Enter = mantener, `borrar` = vaciar, `salir` = abortar; al final reinicia los servicios y hace los healthchecks). Cubre MinerU, HF, SERP, CORE, Semantic Scholar, Scopus, Redalyc, email de Unpaywall, User-Agent de OSM, Gemini, Anthropic, OpenAI y Groq.
- O bien Menú Inicio → **Editar LetXinet-Suite.env** (Bloc de notas elevado) y rellena las variables de las secciones [6], [7], [8] y [12] (sección 1.4).
- Variables que conviene revisar siempre: `UNPAYWALL_EMAIL` y `OPENALEX_MAILTO` (un correo de contacto real), `OSM_USER_AGENT` (identificación con contacto), `BUILD_VARIANT` (ver sección 2) y `DESKTOP_ENDPOINT_MODE`.
- **Después de editar**, reinicia los servicios (como administrador):

```powershell
$n = "C:\Program Files\LetXinet Suite\bin\nssm.exe"
& $n restart LetXinetSuiteOSMMCP
& $n restart LetXinetSuiteMarkitDown
& $n restart LetXinetSuiteMCPV11
# o: Menú Inicio -> "Reiniciar servicios del Suite"  (restart-suite.cmd)
```

y cierra y vuelve a abrir el Desktop HF (hereda el `.env` al arrancar con `start-letxinet-desktop.cmd`).

> No edites `C:\Program Files\LetXinet Suite\MCP-V11-Local\.env`: se sobrescribe al reinstalar. Lo persistente va en ProgramData.

### 6.6 Claves del Desktop HF (`secrets.json`)

- Ruta: `%APPDATA%\letxipu-desktop-hf\secrets.json`.
- **Variante B:** configura las claves desde la GUI (pestaña “API Keys” / ProvidersSyncPanel). El botón “Guardar y reiniciar” llama a `POST /api/keys/restart-services` y, como Electron corre sin privilegios, lanza `restart-suite.cmd` con UAC: acepta el aviso.
- **Variante A (solo personal):** en el primer arranque `seedSecretsFromBundle()` copia `resources\secrets.json` a userData. Si ya existía un `secrets.json` en userData, **no se reemplaza**. Para forzar el del bundle: cierra el Desktop, renombra el archivo de userData (por ejemplo a `secrets.json.bak`) y vuelve a abrir.
- Desde el Bug 1, las variables LLM `*_API_KEY` aparecen como **solo lectura** en “Variables de Sistema” (`POST /api/system-variables` responde 400): las claves de IA se gestionan en `secrets.json`/GUI. Solo los `*_BASE_URL` siguen siendo editables.

### 6.7 Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| **Puerto ocupado** (7082/7860/4003/4002/43123) | Otra app u otra copia del componente | `Get-NetTCPConnection -LocalPort <p> -State Listen` → `Get-Process -Id <PID>` → ciérrala o cambia el puerto en el `.env`: `OSM_MCP_PORT`, `MARKITDOWN_API_PORT`, `SPACY_PORT`; para el V11 define **`PORT=`** (el launcher lee `PORT`, no `MCP_V11_PORT`) y ajusta `LOCAL_MCP_URL`/`MARKITDOWN_API_URL`. Para el Desktop, `LETXIPU_DESKTOP_PORT` (`main.cjs` lee esta, **no** `DESKTOP_PORT`). Reinicia los servicios. |
| **EADDRINUSE en 4003** (en `mcp-v11-local.stderr.log` o en `backend.log`) | Dos procesos V11 a la vez. **[Análisis]** `main.cjs` (`maybeStartLocalMcp()`) comprueba la salud en `http://127.0.0.1:${LOCAL_MCP_PORT}/api/health` y, si no responde, busca un V11 **independiente** en `LETXIPU_LOCAL_MCP_DIR`, `%ProgramFiles%\MCP-V11-Local`, `%LOCALAPPDATA%\MCP-V11-Local`, etc. y lo lanza en 4003. Si el servicio NSSM (inicio retrasado) aún está arrancando, o abres el exe sin el `.env` (sin `start-letxinet-desktop.cmd`, con lo que `LOCAL_MCP_PORT` vuelve a 4003), los dos chocan. También pasa si lanzas `start-mcp-local.cmd`/`start-mcp-v11-local.cmd` a mano con el servicio activo. | 1) Desinstala el MCP-V11-Local antiguo y borra la variable: `reg delete "HKCU\Environment" /v LETXIPU_LOCAL_MCP_DIR /f`. 2) Abre el Desktop **siempre** con el acceso directo (usa `start-letxinet-desktop.cmd`). 3) Espera a que `http://127.0.0.1:4003/health` dé 200 antes de abrir el Desktop. 4) Mata los duplicados: `Get-Process MCP-V11-Local | Stop-Process -Force` y `nssm restart LetXinetSuiteMCPV11`. 5) No cambies `LOCAL_MCP_PORT` en el `.env` sin revisar este comportamiento. |
| **Servicios no registrados** (`sc query` → “no existe”) | Falló `register-services.cmd` (instalación sin admin, antivirus, `nssm.exe` ausente) | Como admin: `cd /d "C:\Program Files\LetXinet Suite"` y `register-services.cmd`. Comprueba que existe `bin\nssm.exe` (Bug A). Revisa `%TEMP%\Setup Log*.txt` o el `/LOG=`. |
| Servicio en **Paused** con `"C:\Program" no se reconoce` | Bug de comillas de NSSM (v1.0.0) | Corregido desde v1.0.1 con `run-*.cmd`. Si reaparece: `nssm get LetXinetSuiteOSMMCP AppParameters` debe ser `/c run-osm.cmd` y `AppDirectory` la raíz del Suite. Vuelve a ejecutar `register-services.cmd`. |
| V11 **STOPPED / exit 1066** | Exe equivocado, `AppDirectory` erróneo o `.env` ausente | Comprueba que `MCP-V11-Local.exe` pesa ~93,75 MB y que existe `MCP-V11-Local\.env`. Lánzalo a mano para ver el error: `cd /d "C:\Program Files\LetXinet Suite"` y `bin\start-mcp-v11-local.cmd` (con el servicio detenido). |
| **spaCy** no responde en 4002 / `python:false` en `/api/health` | `python-runtime` incompleto, numpy ≥ 2, modelos sin aplanar o bloqueados por el antivirus | `"C:\Program Files\LetXinet Suite\MCP-V11-Local\python-runtime\python.exe" -c "import spacy, numpy, flask; print(spacy.__version__, numpy.__version__)"` → spaCy 3.8.x, numpy 1.26.x. Comprueba que existe `...\python\models\es_core_news_sm\` (o el `config.cfg` aplanado en `python-runtime\Lib\site-packages\es_core_news_sm\`). El sidecar se lanza con la **primera petición**: haz una búsqueda y vuelve a comprobar 4002. Para trabajar sin spaCy hay scripts en `04_SCRIPTS-MANTENIMIENTO\` (`desactivar-spacy.cmd` / `reactivar-spacy.cmd`). |
| MarkItDown no arranca | Runtime o dependencias | `"...\MarkItDown\API\python-runtime\python.exe" --version` (3.12.10) e `import fastapi, uvicorn, pymupdf4llm`. Log: `markitdown-api.stderr.log`. |
| Desktop HF “muerto” al abrir | El backend tarda 25-35 s | Espera. Si no: `taskkill /F /IM "LetXipu Desktop HF.exe"`, revisa `%TEMP%\letxipu-desktop-main.log` y `backend.log` (Error 1-7 de `EMPAQUETADO.md`). |
| “Guardar y reiniciar” falla con acceso denegado | Electron sin privilegios | Acepta el UAC (v1.0.1) o usa el atajo “Reiniciar servicios del Suite” como admin. |
| Chat con modelo `:provider` responde “API key not valid” o 404 | Versión anterior a los Bug 2/4 | Asegúrate de tener `server.cjs` con MD5 `D1818341231A4A93B1D9A45E4BF93846` en `LetXinet-Desktop\resources\app\dist\`. |
| OSM-MCP bloqueado | Firewall corporativo | Añade una excepción para `{app}\OSM-MCP\osmmcp.exe`. |

### 6.8 Instalar el Addon Bridges v1.0.0

**Qué instala** (en `C:\Program Files\LetXinet Addon\`):

| Componente | Función | Requiere |
|---|---|---|
| `mcp-bridge\mcp-bridge.cjs` | Puente MCP stdio → REST hacia el gateway del Suite (`LETXINET_SUITE_URL=http://127.0.0.1:43123`) | Node.js en el PATH, Suite + Desktop abiertos |
| `omni-word-mcp\` | Automatización de Word por COM (`word_mcp_server.py`) | Microsoft Word 2016+, Python 3.12 |
| `latex-mcp-local\` | Compilador LaTeX local v4 (`dist\index.js`) | Node.js, XeLaTeX + Biber |
| `bin\*.ps1` | Comprobaciones y parche de `opencode.json` | PowerShell |

**Pasos**

1. Suite instalado en `C:\Program Files\LetXinet Suite` (el script de parcheo lo usa **fijo**).
2. Instala Node.js LTS, opencode CLI (o crea `~\.config\opencode\`), Word y una distribución LaTeX.
3. Ejecuta `LetXinet-Addon-Bridges-v1.0.0.exe` como administrador.
4. Durante `[Run]` se ejecutan `check-requirements.ps1` (informa de Suite, Word, opencode y Node; su resultado no bloquea la instalación) y `patch-opencode-config.ps1`.
5. **Importante:** `patch-opencode-config.ps1` **reescribe** `%USERPROFILE%\.config\opencode\opencode.json` con `letxinet-gateway`, `omni-word-mcp`, `markitdown-api` (usa el adaptador del Suite en `...\MarkItDown\API\mcp-adapter\markitdown-mcp.js`), `latex-mcp-local` y `codebase-memory` (si existe), además de `skills.paths`. Antes hace copia de seguridad en `opencode.json.bak-<fecha>`. Si tenías otros MCP en opencode, **vuelve a añadirlos** a mano desde esa copia. Al desinstalar, `restore-config.ps1` restaura la copia más reciente.
6. **[Análisis] `omni-word-mcp\.venv`**: el entorno virtual se creó con `home = C:\Users\USER\AppData\Local\Programs\Python\Python312` (Python 3.12.10). En otra laptop solo funciona si Python 3.12 está **en esa misma ruta**, es decir, con el mismo nombre de usuario. Si no, recréalo como admin:

   ```powershell
   cd "C:\Program Files\LetXinet Addon\omni-word-mcp"
   Remove-Item .\.venv -Recurse -Force
   py -3.12 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt   # mcp[cli], python-docx, msoffcrypto-tool, docx2pdf
   ```

7. Reinicia opencode. Con el Desktop HF abierto, `letxinet-gateway` debería listar las herramientas.

Las configuraciones de Claude Code y opencode y el instalador de configuración están en `03_CONFIG-CLAUDE-CODE-OPENCODE\` del paquete.

---

## 7. Problemas conocidos y parches

### 7.1 Sesión 7 (post-1.1.0, 07/08/2026): Bug 1-4 en Desktop HF, ya incluidos en la regeneración

| Bug | Síntoma | Corrección |
|---|---|---|
| **Bug 1** | En “Variables de Sistema” se podían editar las `*_API_KEY` de LLM y anular las de `secrets.json` | `PROVIDER_APIKEY_BLOCKED_KEYS` (13 claves) y `PROVIDER_APIKEY_REJECT_HINT`. `POST /api/system-variables` responde 400. `parseEnvSections()` marca `readOnly:true`. Aviso en `SystemVariablesConfig.tsx`. Solo `*_BASE_URL` editable. |
| **Bug 2** | `z-ai/glm-5.2:nvidia` respondía “API key not valid” (se usaba siempre `GEMINI_API_KEY`) | `parseProviderSuffix()` y `resolveProviderRouting()` (única fuente de verdad: `{modelId, endpoint, type, apiKey}`). Sufijos: nvidia, openai, anthropic, groq, mistral, opencode, gemini, nebius, openrouter, deepseek. |
| **Bug 3** | `secrets.json` con claves caducadas o vacías: `/api/models/sync` daba 129 modelos en 10 grupos | `secrets.json` actualizado con claves verificadas (1 859 B, MD5 `BBA418C3…`): **832 modelos en 11 grupos**. |
| **Bug 4** | `models/gemini-2.5-flash:gemini` daba 404/401 o una respuesta vacía | (1) se quita el prefijo `models/` (antes salía `models/models/` duplicado), (2) sin `Authorization: Bearer` para Google (solo `x-goog-api-key`/`?key=`), (3) `:streamGenerateContent?alt=sse` en las ramas langgraph y opencode. |

Resultado: `server.cjs` de 352 546 B con MD5 `D1818341231A4A93B1D9A45E4BF93846` en el payload y en los instaladores regenerados (07/08/2026 21:00). Pruebas de humo: Gemini, NVIDIA y Mistral responden. OpenAI da 429 por falta de saldo (limitación de la cuenta, no del código). Copias de seguridad previas a cada fix: `D:\OTROS\LETXINET-OPTIM-BUILD\backups\fix-*\`.

### 7.2 v1.1.0 (06/08/2026): Dual Build

`server.cjs` unificado (sin `--define BUILD_VARIANT`), nueva estructura `resources\app\` (`asar:false`; antes `app.asar.unpacked\`), `secrets.json` solo en A, `seedSecretsFromBundle()`, sección [12] del `.env`.

### 7.3 v1.0.1 (01/08/2026): post-instalación

- Servicios en **Paused** (`"C:\Program" no se reconoce`): NSSM quita las comillas de `AppParameters`. Corregido con `run-osm.cmd`, `run-md.cmd` y `run-v11.cmd` en la raíz y `AppParameters=/c run-*.cmd` + `AppDirectory` en la raíz.
- `POST /api/keys/restart-services` daba acceso denegado sin admin. Se detecta (`e.code===3`, o mensaje UTF-16LE) y se eleva con `restart-suite.cmd` (UAC).
- `%NSSM%` sin comillas en `register-services.cmd`.

### 7.4 v1.0.0 (31/07/2026): pruebas de la fase 6 y del build

- **Bug A**: ruta de `nssm.exe` (`%~dp0nssm\` → `%~dp0bin\`).
- **Bug B**: exe V11 equivocado (66,57 MB) → el de pkg de 93,75 MB.
- **Bug C**: `AppDirectory` del V11.
- Build: rutas >260 caracteres (`subst L:`), comentarios `;` en `[Code]` (se usa `//`), falso “Build FALLIDO” por `errorlevel`, `{pf}`→`{commonpf}`, `IsAdminLoggedOn`→`IsAdminInstallMode`, `RunOnceId` en `[UninstallRun]`, `python-runtime` borrado por error y regenerado.

### 7.5 Observaciones de esta revisión ([Análisis], pendientes de decidir)

1. **`secrets.json` podría entrar en la Variante B** por el comodín `letxinet-desktop\*` (sección 2). Añade `Excludes` y verifica antes de distribuir.
2. **`BUILD_VARIANT=private`** en el `.env` compartido para ambas variantes (sección 2).
3. **Repo del Desktop por delante de la v1.1.0**: `server.ts` y `dist\server.cjs` del 16/08/2026 (hay `server.ts.bak-pre-parche10-20260816-1348` y `dist\parche8-slider.js`). El MD5 ya no coincide con el payload. Decide si esos cambios entran en una futura v1.1.1 y documéntalo.
4. **Puertos con documentación incoherente**: el Desktop lee `LETXIPU_DESKTOP_PORT` (no `DESKTOP_PORT`), el V11 lee `PORT` (no `MCP_V11_PORT`), y el puerto de métricas de OSM es 9090 en el `.env` aunque el README menciona 19090.
5. **Rutas de la línea de tiempo**: `MCP-V11-Local.exe` está en `packaging\bin\` (no en `packaging\`) y `MCP-V11-Local-Portable.zip` en `packaging\installer\installer-output\`.
6. **`install.ps1` del repo V11** es de codebase-memory-mcp, no del V11.
7. **`.venv` del Addon** ligado a la ruta de Python del usuario `USER` (6.8).
8. Pool de fuentes (07/08/2026): 30 operativas, 8 vacías, 1 caída (`alicia`, infraestructura de Minedu).
9. Banner del V11 con caracteres raros en los logs de NSSM (CP437). Es cosmético.

---

## 8. Tabla de artefactos vigentes

Tamaños leídos en disco el 02/11/2026 (bytes exactos; MB = bytes/1 048 576).

### 8.1 Instaladores

| Artefacto | Ruta en D:\OTROS | Tamaño | SHA256 (inicio) |
|---|---|---|---|
| Suite v1.1.0 Variante A `.exe` (**solo personal**) | `D:\OTROS\LETXINET-SUITE\build\installer-output\variantA\LetXinet-Suite-1.1.0-VariantA-Setup.exe` | 7 101 954 B (6,77 MB) | `6F10D579…` |
| Suite v1.1.0 Variante A `.bin` (**solo personal**) | `...\variantA\LetXinet-Suite-1.1.0-VariantA-Setup-1.bin` | 433 421 365 B (413,34 MB) | `314CB5DD…` |
| Suite v1.1.0 Variante B `.exe` | `D:\OTROS\LETXINET-SUITE\build\installer-output\variantB\LetXinet-Suite-1.1.0-VariantB-Setup.exe` | 7 102 005 B (6,77 MB) | `D93753B1…` |
| Suite v1.1.0 Variante B `.bin` | `...\variantB\LetXinet-Suite-1.1.0-VariantB-Setup-1.bin` | 212 467 732 B (202,63 MB) | `7BD3FBC5…` |
| Hashes | `D:\OTROS\LETXINET-SUITE\build\installer-output\HASHES-SHA256-v1.1.0-regen-2026-08-07.txt` | 1 037 B | — |
| Addon Bridges v1.0.0 | `D:\OTROS\LETXINET-ADDON-BUILD\output\LetXinet-Addon-Bridges-v1.0.0.exe` | 104 114 150 B (99,29 MB) | — |
| Addon: fuentes | `D:\OTROS\LETXINET-ADDON-BUILD\output\LetXinet-Addon-Bridges-source-v1.0.0.zip` | 156 156 047 B (148,92 MB) | — |

### 8.2 Zips de la sesión 7 (`D:\OTROS\LETXINET-OPTIM-BUILD\zips\sesion-7-regen-v1.1.0-bugfix\`)

| Archivo | Tamaño | SHA256 (inicio) | Contenido |
|---|---|---|---|
| `instaladores-v1.1.0-regen-bugfix-2026-08-07.zip` | 652 458 887 B (622,23 MB) | `EC4AFC4D…` | 2 `.exe` + 2 `.bin` + HASHES + CHANGELOG + RELEASE + README-REGEN (**incluye la Variante A: no compartir**) |
| `fuentes-desktop-hf-v1.5.8-bugfix-v1.1.0.zip` | 552 791 B (539,83 KB) | `04FA14CB…` | 98 archivos del Desktop HF (server.ts con Bug 1-4, src, electron, mcp-bridge, skills) |
| `fuentes-suite-v1.1.0-regen-bugfix.zip` | 347 581 B (339,43 KB) | `0ECEFD86…` | 38 archivos del Suite (ISS, build-variants, READMEs, tokens A/B) (**contiene `variantA-interno\.env`: no compartir**) |
| `fuentes-mcps-3-osm-v11-markitdown.zip` | 39 367 744 B (37,54 MB) | `78E3E1E2…` | Código fuente Go (OSM), TS (V11, 28 providers) y Python (MarkItDown); sin `python-runtime` |
| `ZIPS-SESION-7-HASHES.md` | 5 063 B | — | Manifiesto |

Las versiones **sin claves** de estas fuentes están en `02_CODIGO-FUENTE\` del paquete (`*-SIN-CLAVES.zip`).

### 8.3 Binarios, payload y archivos clave

| Artefacto | Ruta | Tamaño | Notas |
|---|---|---|---|
| `server.ts` (fuente actual, posterior a v1.1.0) | `D:\OTROS\LETXINET-DESKTOP-HF\server.ts` | 374 407 B | 16/08/2026 |
| `server.cjs` del repo (posterior a v1.1.0) | `D:\OTROS\LETXINET-DESKTOP-HF\dist\server.cjs` | 359 904 B | MD5 `A64F8D74…` |
| `server.cjs` **v1.1.0** (payload) | `D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\letxinet-desktop\resources\app\dist\server.cjs` | 352 546 B | MD5 `D1818341231A4A93B1D9A45E4BF93846` |
| `main.cjs` (payload) | `...\letxinet-desktop\resources\app\electron\main.cjs` | 18 840 B | con `seedSecretsFromBundle()` |
| `secrets.json` (payload, **claves reales**) | `...\letxinet-desktop\resources\secrets.json` | 1 859 B | MD5 `BBA418C3…`, solo para la Variante A |
| OSM-MCP vigente | `D:\OTROS\letxipu-osm-mcp\osmmcp-patched.exe` = `...\componentes-parches\osm-mcp\osmmcp.exe` | 24 696 832 B (23,55 MB) | 31/07/2026, MD5 `09A7C633…` |
| OSM-MCP sin parche | `D:\OTROS\letxipu-osm-mcp\osmmcp.exe` | 24 695 296 B | 23/07/2026 (no usar) |
| MCP-V11-Local (pkg node22) | `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\bin\MCP-V11-Local.exe` = `...\componentes-parches\mcp-v11-local\MCP-V11-Local.exe` | 98 299 367 B (93,75 MB) | 31/07/2026, MD5 `60374F6A…` |
| MCP-V11-Local portable (alternativa) | `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\installer\installer-output\MCP-V11-Local-Portable.zip` | 173 255 783 B (165,23 MB) | 29/07/2026 |
| MarkItDown `app.py` (payload) | `D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\markitdown-api\markitdown-payload\app.py` | 3 386 B | + `python-runtime\` (~223-251 MB) |
| Plantilla `.env` central | `D:\OTROS\LETXINET-SUITE\src-suite\shared-env\LetXinet-Suite.env` | 11 958 B | claves vacías |
| `.env` V11 Variante A (**claves reales**) | `D:\OTROS\LETXINET-SUITE\variant-tokens\variantA-interno\.env` | 2 627 B | solo personal |
| `.env` V11 Variante B | `D:\OTROS\LETXINET-SUITE\variant-tokens\variantB-publico\.env` | 3 231 B | plantilla vacía |
| NSSM 2.24 | `D:\OTROS\LETXINET-SUITE\src-suite\instalador\nssm\nssm.exe` | 331 264 B | — |
| Icono | `D:\OTROS\LETXINET-SUITE\src-suite\instalador\assets\icon.ico` | 110 159 B | — |

### 8.4 Obsoletos (no usar para instalar)

Suite v1.0.0/v1.0.1 y v1.1.0 anterior a los fixes (en `LETXINET-OPTIM-BUILD\backups\regen-suite-v1.1.0\...\installer-output-prev\` y `zips\sesion-6-suite-v1.1.0\`), instaladores independientes de `LETXINET-EJECUTABLES+CODIGO-FUENTE ZIP\EJECUTABLES\` (Desktop HF 0.0.0, MCP-V11-Local-Setup-A/B, OSM-MCP-Setup), electron-builder público/privado de `LETXINET-OPTIM-BUILD\installers\` y la línea paralela `LETXINET-SUITE-VARIANTE-C` (v1.5.2-v1.5.8). **La línea vigente es la Suite con Inno Setup v1.1.0 regenerada el 07/08/2026.**

---

*Fin de la guía.*
