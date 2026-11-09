# LetXinet Suite v1.0

Instalador Windows unificado que empaqueta 4 componentes del ecosistema LetXipu/OpenStreetMap MCP en una sola distribucion administrable.

> **Variante A (interno)**: incluye tokens IA reales — distribucion interna autorizada.
> **Variante B (publica)**: plantilla sin tokens — el operador pega sus propias claves.

---

## Que instala

| # | Componente | Tipo | Puerto | Funcion |
|---|---|---|---|---|
| 1 | OSM-MCP | Servicio NSSM (auto-start) | 7082 (HTTP+SSE) | Geocoding + routing OpenStreetMap con 28 MCP tools |
| 2 | MarkItDown API | Servicio NSSM (auto-start) | 7860 (HTTP) | Motor PyMuPDF4LLM para PDF -> Markdown estructurado |
| 3 | MCP-V11-Local | Servicio NSSM (delayed auto-start) | 4003 (HTTP+SSE) + 4002 (spaCy sidecar) | Buscador academico con 28 MCP tools (gent scholar, semantic scholar, minerU, ...) |
| 4 | LetXipu Desktop HF | Electron app (sin servicio NSSM) | 43123 (Express interno) | GUI de escritorio, se invoca via shortcut del menu inicio o escritorio |

| Total tamano instalado | RAM aprox | Disco aprox |
|---|---|---|
| 2.02 GB sin comprimir -> 508 MB instalador LZMA2 | 100-500 MB por servicio activo (V11 + spaCy) | 2.5 GB libres recomendados |

---

## Requisitos

- Windows 10/11 x64 (Electron 37 + Python 3.12 amd64)
- 3 GB libres en disco (2 GB instalacion + 0.5 GB cache temporal Inno)
- Privilegios de administrador (necesario para NSSM Service Control Manager)
- Connectivity HTTPS a internet (los servicios son locales, pero sus upstreams salida a internet: OSM Nominatim, MinerU, Semantic Scholar, etc.)

---

## Instalacion

### Distribucion basica (variante B publica)

Copia en una carpeta los 2 archivos del .zip descargado:
```
LetXinet-Suite-1.0.0-VariantB-Setup.exe       4.74 MB
LetXinet-Suite-1.0.0-VariantB-Setup-1.bin    503.80 MB
```

Despues:
1. Click derecho en `Setup.exe` -> **Ejecutar como administrador**.
2. Aceptar el popup UAC.
3. Wizard en espanol (seleccionableIngles tambien): Lee la licencia MIT, info pre-instalacion.
4. Confirmar carpeta destino (`C:\Program Files\LetXinet Suite\` por defecto; recomendado cambiar a otro disco si C: tiene poco espacio).
5. Click Instalar -> se copian 2 GB de archivos y se registran los 3 servicios NSSM (~5-6 min).
6. Al final, los 3 servicios arrancan automaticamente. V11 lleva ~5s extra por la inicializacion de spaCy.
7. Click Finalizar. Aparecera un atajo en el escritorio "LetXinet Desktop HF".

### Instalacion silenciosa (para IT ops)

```cmd
LetXinet-Suite-1.0.0-VariantB-Setup.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR="D:\LetXinet Suite" /LOG="C:\tmp\install-suite.log"
```

- `/VERYSILENT`: sin wizard visible.
- `/SUPPRESSMSGBOXES`: sin popups interactivos.
- `/NORESTART`: no reiniciar al final.
- `/DIR=`: carpeta destino (default `{commonpf}\LetXinet Suite`).
- `/LOG=`: ruta del log (debug post-install).

Requiere admin (UAC popup automatico).

---

## Configuracion post-instalacion

Archivo unico: `%PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env` (~10 KB, formato `KEY=VALUE`, comentarios con `#`).

Las variables AQUI sobreescriben las del `.env` interno del V11 (`{app}\MCP-V11-Local\.env`) en runtime: si una key esta en ambos, gana el Suite.env. Esto permite actualizar el Suite sin perder tus claves (el Suite.env tiene `Flags: onlyifdoesntexist uninsneveruninstall` en el instalador).

### Variante B: asistente interactivo `configure-keys.cmd`

Para configurar las API keys mas usadas sin tocar el archivo a mano:

1. Menu Inicio -> **LetXinet Suite -> Configurar API keys**
2. Se abrira un cmd elevado (UAC) con un asistente interactivo
3. Para cada key preguntara `[Enter=mantener]`. Respuestas validas:
   - **Enter vacio**: mantiene el valor actual del `.env`
   - **`borrar`**: vacia la key (deja `KEY=`)
   - **`salir`**: aborta el asistente (lo guardado hasta ahi se mantiene)
   - cualquier otro texto: ese valor se guardara
4. Al finalizar reinicia los 3 servicios NSSM y hace healthchecks de los 4 endpoints

El asistente cubre las claves mas usadas (MinerU, HF, SERP, CORE, Semantic Scholar, Scopus, Redalyc, Unpaywall email, OSM User-Agent, Gemini, Anthropic, OpenAI, Groq). Para claves avanzadas (Mistral, NVIDIA, OpenAlex, OpenReview) edita el `.env` a mano via el atajo "Editar LetXinet-Suite.env".

### Variables mas relevantes

```ini
# === [1] Puertos locales (no tocar salvo conflicto) ===
OSM_MCP_PORT=7082
OSM_METRICS_PORT=9090
MARKITDOWN_API_PORT=7860
MCP_V11_PORT=4003
SPACY_PORT=4002
DESKTOP_PORT=43123
LETXIPU_DESKTOP_PORT=43123

# === [2] Modo de endpoints Desktop ===
DESKTOP_ENDPOINT_MODE=auto    # auto | local_only | remote_only | hf_only
                                # auto:        local primero, fallback remoto (default)
                                # local_only:  solo servicios locales
                                # remote_only: solo endpoints HF remotos
                                # hf_only:     forzar HF (debug/back-compat)

# === [3] Endpoints remotos Letxipu/HF ===
LETXIPU_MCP_URL=https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp
LETXIPU_OSM_MCP_URL=https://c2mv-letxipu-osm-mcp.hf.space/mcp
LETXINET_MCP_URL=https://www.letxinet.lat/api/v1/mcp

# === [4] OSM upstream ===
OSM_USER_AGENT=LetXinet-Suite/1.0 (contacto: admin@tudominio.com)
# Opcional override (si tienes self-hosted):
# NOMINATIM_URL=https://nominatim.openstreetmap.org
# OVERPASS_URL=https://overpass-api.de

# === [5] V11 PDF resolver + extraction ===
SCIHUB_MIRRORS=https://sci-hub.al,https://sci-hub.mk,https://sci-hub.ru
UNPAYWALL_BASE_URL=https://api.unpaywall.org/v2
UNPAYWALL_EMAIL=letxipu@search.mcp   # REQUERIDO contacto real
DOI_RESOLVER_URL=https://doi.org
DOC_EXTRACTOR_MODE=auto              # auto | mineru_only | markitdown_only | pdfparse_only
MARKITDOWN_ENABLED=true
MARKITDOWN_PYTHON=python-runtime\python.exe
EXTRACTOR_TIMEOUT_MS=300000
EXTRACTOR_MAX_MB=200

# === [6] MinerU API (PDF precision mode) ===
MINERU_API_KEY=                       # vacio = Flash (20 pag); relleno = Precision (200pag)
MINERU_API_URL=https://mineru.net/api/v4

# === [7] Sources academicas (variante B: RELLENAR con tus claves) ===
CORE_API_KEY=
SCOPUS_API_KEY=
SEMANTIC_SCHOLAR_API_KEY=
SERP_API_KEY=                         # alias SERPAPI_KEY tambien
SERPAPI_KEY=
HF_TOKEN=
REDALYC_TOKEN=
OPENALEX_MAILTO=letxipu@search.mcp

# === [8] LLM IA (OPCIONALES, solo paper-summarization) ===
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_TOKEN=
OPENAI_API_KEY=
OPENAI_TOKEN=
GROQ_API_KEY=
GROQ_TOKEN=
MISTRAL_API_KEY=

# === [9] Logging ===
LOG_LEVEL=info   # trace | debug | info | warn | error
```

### Editar el `.env`

**Flujo recomendado para variante B (configurar claves)**:

1. Menu Inicio -> **LetXinet Suite -> Configurar API keys**
2. Sigue el asistente interactivo (pregunta cada clave con `[Enter=mantener]`)
3. Reinicia los servicios y hace healthchecks automaticamente al final

**Flujo manual** (avanzado):

Click derecho en el atajo del menu inicio **"Editar LetXinet-Suite.env"** -> Notepad elevado (UAC popup).

Tras editar, reinicia los 3 servicios:
- `services.msc` -> Localizar `LetXinet Suite - *` -> boton derecho -> Restart
- O PowerShell elevado:
  ```powershell
  & "C:\Program Files\LetXinet Suite\bin\nssm.exe" restart LetXinetSuiteOSMMCP
  & "C:\Program Files\LetXinet Suite\bin\nssm.exe" restart LetXinetSuiteMarkitDown
  & "C:\Program Files\LetXinet Suite\bin\nssm.exe" restart LetXinetSuiteMCPV11
  ```

NOTA: El `.env` interno del V11 (`C:\Program Files\LetXinet Suite\MCP-V11-Local\.env`) existe y lee dotenv, pero se **sobreescribe** al reinstalar el Suite. Para persistentes, edita SOLO `%PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env` (ese se preserva al reinstalar).

---

## Verificar instalacion

### Estado de 3 servicios

```cmd
sc query LetXinetSuiteOSMMCP | findstr STATE
sc query LetXinetSuiteMarkitDown | findstr STATE
sc query LetXinetSuiteMCPV11 | findstr STATE
```
Todos deben decir `RUNNING`.

### Healthchecks HTTP

```powershell
Invoke-WebRequest http://127.0.0.1:7082/         # OSM-MCP
Invoke-WebRequest http://127.0.0.1:7860/         # MarkItDown
Invoke-WebRequest http://127.0.0.1:4003/health    # MCP-V11
Invoke-WebRequest http://127.0.0.1:43123/         # Desktop HF (Express, tarde 35s)
```
Todos deben responder `StatusCode : 200`.

### Smoke test V11 (MCP `tools/list`)

```powershell
$body = '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
Invoke-WebRequest -Uri http://127.0.0.1:4003/api/mcp -Method POST -ContentType 'application/json' -Body $body
```
Debe devolver JSON-RPC con `result: { tools: [...] }` listando 28 tools.

---

## Logs centralizados

`%PROGRAMDATA%\LetXinet Suite\Logs\` (no se borran al desinstalar):

```
osm-mcp.stdout.log          <- log Go structured (slog INFO)
osm-mcp.stderr.log          <- stack traces y warnings
markitdown-api.stdout.log   <- uvicorn access logs
markitdown-api.stderr.log   <- stack traces Python
mcp-v11-local.stdout.log    <- log pino JSON (letxipu-search-mcp) + spaCy
mcp-v11-local.stderr.log    <- stack traces Node + child_process stderr
```

Tamano max: 5 MB por archivo, rotation automatica (NSSM `AppRotateBytes 5242880`).

---

## Desinstalacion

Panel de control -> Programas y caracteristicas -> **LetXinet Suite** -> Desinstalar.

O via CLI:
```cmd
"C:\Program Files\LetXinet Suite\unins000.exe" /VERYSILENT /SUPPRESSMSGBOXES
```

Lo que se elimina:
- 3 servicios Windows (vía `uninstall-services.cmd` en `[UninstallRun]`)
- Carpeta `{app}\LetXinet Suite\` con todos sus componentes (2 GB)
- Atajos del menu inicio y escritorio
- Entrada de registro uninstall en `HKLM\...\Uninstall\{AppId}_is1`

Lo que **NO** se elimina (intencional):
- `%PROGRAMDATA%\LetXinet Suite\Logs\` (para diagnostico post-mortem)
- `%PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env` (preserva configuracion del operador si reinstala)

---

## Estructura de la instalacion

```
{app}\LetXinet Suite\                       (10 carpetas)
|-- bin\
|   |-- suite-env-loader.cmd                (parser .env )
|   |-- start-osm-mcp.cmd                   (launcher OSM-MCP)
|   |-- start-markitdown-api.cmd            (launcher MarkItDown)
|   |-- start-mcp-v11-local.cmd             (launcher MCP-V11-Local)
|   |-- start-letxinet-desktop.cmd          (launcher Desktop HF)
|   |-- nssm.exe                            (NSSM 2.24 win64)
|-- OSM-MCP\
|   |-- osmmcp.exe                          (Go binario, 23.6 MB)
|-- MarkItDown\API\
|   |-- app.py                               (FastAPI server)
|   |-- mcp-adapter\                         (JS adapter MCP)
|   |-- python-runtime\                      (Python 3.12 embed + deps)
|-- MCP-V11-Local\
|   |-- MCP-V11-Local.exe                    (Node pkg bundle, 93.75 MB)
|   |-- start-mcp-local.cmd                  (launcher original V11, retained)
|   |-- dist\                                (TS compiled, para dotenv lookup)
|   |-- python\                              (spacy_server.py + spaCy models)
|   |-- python-runtime\                     (Python 3.12 embed + spaCy + numpy)
|   |-- .env                                  (variante A o B)
|-- LetXinet-Desktop\                        (Electron app, 1097 MB)
|   |-- Letxipu Desktop HF.exe               (main + icono incrustado)
|   |-- resourses\app.asar.unpacked\          (React UI compiled + node_modules)
|-- assets\
|   |-- icon.ico                              (Suite icon, copia para consistency en atajos)
|-- register-services.cmd                    (registra 3 servicios NSSM en [Run])
|-- uninstall-services.cmd                   (detiene y elimina en [UninstallRun])
|-- README-SUITE.txt                          (manual de operacion)
|-- LICENSE.txt                               (MIT + terceros)
|-- INFO-BEFORE.txt                          (resumen pre-instalacion)
|-- unins000.exe                              (uninstaller, generado por Inno)
|-- unins000.dat                              (datos uninstall, generado por Inno)

%PROGRAMDATA%\LetXinet Suite\
|-- LetXinet-Suite.env                        (configuracion del operador, ~6 KB)
|-- Logs\
|   |-- osm-mcp.stdout.log, stderr
|   |-- markitdown-api.stdout.log, stderr
|   |-- mcp-v11-local.stdout.log, stderr
```

---

## Resolucion de problemas

### El servicio V11 no arranca (PESTPPE STOPPED, exit 1066)

1. Verificar el log: `%PROGRAMDATA%\LetXinet Suite\Logs\mcp-v11-local.stderr.log`.
2. Lo mas comun: paths no existen (si se movio el instalador), o Python embed no funciona.
3. Lanzar V11 manualmente para ver el error:
   ```cmd
   cd "C:\Program Files\LetXinet Suite\MCP-V11-Local"
   ..\bin\start-mcp-v11-local.cmd
   ```
4. Si dotenv falla: el `.env` del V11 (`{app}\MCP-V11-Local\.env`) debe estar presente (es el de variante A/B copiado por instalador).
5. Forzar restart:
   ```cmd
   ..\bin\nssm.exe restart LetXinetSuiteMCPV11
   ```

### MarkItDown no responde (puerto 7860 ocupado)

1. Verificar que Python 3.12 embed se descomprimio correctamente:
   ```cmd
   "C:\Program Files\LetXinet Suite\MarkItDown\API\python-runtime\python.exe" --version
   ```
   Debe decir `Python 3.12.10` (o similar).
2. Verificar deps:
   ```cmd
   cd /d "C:\Program Files\LetXinet Suite\MarkItDown\API"
   python-runtime\python.exe -c "import fastapi, uvicorn, pymupdf4llm; print('OK')"
   ```
3. Logs:
   `%PROGRAMDATA%\LetXinet Suite\Logs\markitdown-api.stderr.log`

### OSM-MCP no responde en 7082 (probabilidad baja)

1. Verificar flags: el launcher pasa `-enable-http -http-only -http-addr ":7082" -monitoring-addr ":19090" -user-agent "..."`.
2. Firewall: NSSM registra cmd.exe + osmmcp.exe, si el firewall corporativo los bloquea, anadir excepciones para `{app}\OSM-MCP\osmmcp.exe`.
3. Ejecutar manualmente para ver error:
   ```cmd
   cd /d "C:\Program Files\LetXinet Suite"
   bin\start-osm-mcp.cmd
   ```

### Electron Desktop HF no abre

1. Verificar atajo: click derecho en "Letxipu Desktop HF" del menu inicio -> propiedades. Target debe ser `{app}\bin\start-letxinet-desktop.cmd`.
2. Taskkill y relanzar:
   ```cmd
   taskkill /F /IM "Letxipu Desktop HF.exe"
   "C:\Program Files\LetXinet Suite\bin\start-letxinet-desktop.cmd"
   ```
3. Tarda ~35s en abrir Express en 43123. La ventana GUI debe aparecer rapido; la API pueden demorar.
4. Si hay conflictos de puerto (43123 ocupado), cambiar `DESKTOP_PORT=43124` (o el libre) en `.env`. **Nota**: el main.cjs busca `LETXIPU_DESKTOP_PORT`, no `DESKTOP_PORT`. Documentar y reportar como issue.

### Puerto en conflicto (incluido por defecto)

| Puerto | Default | Modificable via .env |
|---|---|---|
| 43123 | Desktop HF | DESKTOP_PORT (ver nota arriba) |
| 4003  | V11 HTTP+SSE | MCP_V11_PORT |
| 4002  | spaCy sidecar | SPACY_PORT |
| 7082  | OSM-MCP | OSM_MCP_PORT |
| 19090 | OSM Prometheus | OSM_METRICS_PORT |
| 7860  | MarkItDown | MARKITDOWN_API_PORT |

---

## Notas deLicenciamiento

El Suite se distribuye bajo **MIT License** (ver `LICENSE.txt` incluido en el instalador).

Componentes bundled (todos bajo sus respectivas licencias, MIT o equivalentes permisivas):

- OSM-MCP                                — MIT
- MCP-V11-Local                          — MIT
- MarkItDown API (FastAPI + PyMuPDF4LLM) — MIT (FastAPI), AGPL (PyMuPDF/PyMuPDF4LLM)
- LetXipu Desktop HF (Electron + Vite)   — MIT
- NSSM 2.24                              — public domain / BSD-2 (compatible)
- Python 3.12.10 embed                   — PSF License (Python Software Foundation)
- spaCy 3.8 + modelos sm                 — MIT (spaCy); CC BY-SA (modelos de spaCy)
- Node.js 22.22.3 (pkg-cooked)           — MIT (Node.js)
- Electron 37                            — MIT
- resvg 0.47 (Rust)                      — MPL-2.0 (usado solo en build de icono, no bundled)
- Pillow (build de icono)                — MIT-CMU (no bundled)
- MinerU                                 — Cloud API (no bundle; externo)
- spaCy                                  — MIT
- numpy                                  — BSD-3
- Flask                                  — BSD-3

### Tokens privados (Variante A)

La Variante A incluye tokens IA reales en el `.env` del V11 (HF_TOKEN, MINERU_API_KEY, CORE_API_KEY, etc.). **Distribucion interna autorizada solamente**. La Variante B no contiene ningun token privado.

---

## Contacto / Issues / Codigo fuente

Codigo fuente disponible en: https://github.com/C2MV/letxinet-suite (o repositorio privado autorizado).

Issues: reportes en https://github.com/C2MV/letxinet-suite/issues o directo al maintainer autorizado.

---

## Agradecimientos

- Equipo LetXipu / C2MV por la herramienta.
- OpenStreetMap Foundation por Nominatim y datos OSM.
- Jordan Russell y Martijn Laan por Inno Setup.
- Iain Patterson por NSSM.
- RazrFalcon por resvg.
- Equipo de spaCy + Explosion.
- Equipo de HuggingFace por los endpoints publicos.

EOF.
