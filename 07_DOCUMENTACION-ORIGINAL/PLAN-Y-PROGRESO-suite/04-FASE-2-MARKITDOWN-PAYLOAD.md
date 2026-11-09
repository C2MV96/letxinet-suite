# Fase 2 — Build payload MarkItDown API portátil

**Fecha:** 2026-07-31 17:10 – 17:25
**Estado:** ✅ COMPLETADA

## Objetivo

Crear un payload autocontenido del MarkItDown API (FastAPI + PyMuPDF4LLM) sin depender de un Python instalado en el sistema destino. Estrategia: Python embebido (`python-3.12.10-embed-amd64.zip`) + deps instaladas en `Lib/site-packages/` local + `app.py` + adapter MCP. El launcher `start-markitdown-api.cmd` (Fase 4) invocará `python-runtime\python.exe -m uvicorn app:app ...` directamente.

## Estrategia

| Plan A (descartado) | Plan B (adoptado) |
|---------------------|-------------------|
| Requerir Python 3.12 instalado en el sistema destino + `pip install -r requirements.txt` al instalar | Empaquetar Python embebido portátil (~10 MB) dentro del Suite; deps pre-instaladas |

Ventajas del Plan B:
- **Sin dependencias externas**: el Suite no exige Python preinstalado.
- **Resultado consistente**: las versiones de `pymupdf4llm`/`fastapi`/etc son las mismas en cualquier PC.
- **No contamina el sistema destino**: nada se mete en el Python del usuario.
- **Desinstalación limpia**: borrar `{app}\MarkItDown\` lo elimina todo.

## Pasos ejecutados

### 2.1 — Descargar Python 3.12.10 embebido amd64

- **URL:** `https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip`
- **Tamaño descarga:** 10.6 MB
- **Extraído a:** `D:\OTROS\LETXINET-SUITE\build\markitdown-payload\python-runtime\`
- **Contenido base:**
  - `python.exe` (102.5 KB)
  - `pythonw.exe` (101.9 KB)
  - `python312.dll` (6.6 MB) + `python3._pth`
  - `python312.zip` (3.6 MB, stdlib embebida)
  - DLLs nativas: `libcrypto-3.dll`, `libssl-3.dll`, `sqlite3.dll`, `unicodedata.pyd`, etc.

### 2.2 — Habilitar `site-packages` en el embed

El embed de Python viene con `site` deshabilitado por defecto. Edité `python312._pth`:

**Antes:**
```
python312.zip
.

# Uncomment to run site.main() automatically
#import site
```

**Después:**
```
python312.zip
.
Lib
Lib\site-packages

# Uncomment to run site.main() automatically
import site
```

Esto activa:
- El módulo `site` (gestión de `site-packages`)
- La ruta `Lib\site-packages\` (donde pip instalará las deps)
- La ruta `Lib\` (reservada para futuros `.py` locales si hace falta)

### 2.3 — Bootstrap de pip

- **URL:** `https://bootstrap.pypa.io/get-pip.py` (2.13 MB)
- **Comando:** `python-runtime\python.exe get-pip.py --no-warn-script-location`
- **Resultado:** pip 26.2 instalado en `Lib\site-packages\pip`. Creó `Scripts\` con `pip.exe`.

### 2.4 — Instalación de dependencias

```powershell
python-runtime\python.exe -m pip install --no-cache-dir --disable-pip-version-check `
    fastapi uvicorn python-multipart pymupdf4llm pymupdf
```

**Deps instaladas (241 MB total en site-packages):**

| Paquete | Versión | Propósito |
|---------|---------|----------|
| `fastapi` | 0.141.1 | Framework HTTP de `app.py` |
| `uvicorn` | 0.52.0 | Servidor ASGI para FastAPI |
| `python-multipart` | 0.0.32 | Parser `multipart/form-data` para upload PDF |
| `pymupdf4llm` | 1.28.0 | Motor MarkItDown (Microsoft) para PDF → Markdown |
| `pymupdf` | 1.28.0 | Bindings Python a MuPDF 1.29.0 (motor nativo) |
| `pydantic` | 2.13.4 | (transitiva de FastAPI) validación de datos |
| `starlette` | 1.3.1 | (transitiva) toolkit ASGI base |
| `anyio` | 4.14.2 | (transitiva) compat async |
| `numpy` | 2.5.1 | (transitiva) |
| `onnxruntime` | 1.28.0 | (transitiva) — pymupdf_layout lo requiere |
| `protobuf` | 7.35.1 | (transitiva onnxruntime) |
| `networkx` | 3.6.1 | (transitiva) |
| `tabulate` | 0.10.0 | (transitiva pymupdf4llm) |
| `pyyaml` | 6.0.3 | (transitiva) |

### 2.5 — Copia del código fuente MarkItDown

Copiado del repo fuente `D:\OTROS\markitdown-api\`:

| Archivo | Tamaño | Destino |
|---------|--------|---------|
| `app.py` | 3.3 KB | `markitdown-payload\app.py` |
| `mcp-adapter\markitdown-mcp.js` | 6.7 KB | `markitdown-payload\mcp-adapter\markitdown-mcp.js` |
| `requirements.txt` | 0.1 KB | `markitdown-payload\requirements.txt` (referencia) |

**NOTA:** El archivo `start-markitdown-api.cmd` NO se copia aquí — se generará en Fase 4 con paths absolutos adaptados al uninstaller Inno `/Suite`.

### 2.6 — Limpieza de residuos de build

- Borrado `__pycache__\app.cpython-312.pyc` (regenerado en runtime)
- Borrado `python-3.12.10-embed-amd64.zip` (10.6 MB)
- Borrado `get-pip.py` (2.1 MB)

### 2.7 — Verificación funcional del payload

**Test smoke** (lint load + arrancar server + healthcheck HTTP):

```powershell
# Cargar app.py desde el embed (importación OK):
python-runtime\python.exe -c "import app; print(app.app.routes)"
# Salida: ['/openapi.json','/docs','/docs/oauth2-redirect','/redoc','/convert','/']

# Arrancar uvicorn desde el embed:
python-runtime\python.exe -m uvicorn app:app --host 127.0.0.1 --port 17860 --app-dir <payload>
# Salida stderr: INFO: Uvicorn running on http://127.0.0.1:17860
#               INFO: Application startup complete.

# HTTP GET al root:
curl http://127.0.0.1:17860/
# STATUS 200 + body JSON:
# {"status":"online","engine":"PyMuPDF4LLM",
#  "message":"Envia POST /convert con form-data 'file' (PDF) y opcional 'pages'...",
#  "supported_pages_formats":"all, 1-5, first5, last3, 1,3,5, 7"}
```

✅ Todas las deps importan desde el embed, FastAPI registra rutas, uvicorn arranca y responde a HTTP.

## Layout final del payload

```
D:\OTROS\LETXINET-SUITE\build\markitdown-payload\
├── app.py                              (3.3 KB, copia del original)
├── requirements.txt                    (0.1 KB, referencia)
├── mcp-adapter\
│   └── markitdown-mcp.js               (6.7 KB, adapter stdio para opencode)
└── python-runtime\                     (263.6 MB)
    ├── python.exe
    ├── pythonw.exe
    ├── python312.dll
    ├── python312._pth                  (editado)
    ├── python312.zip                   (stdlib)
    ├── *.dll, *.pyd, libcrypto, etc.
    ├── Lib\
    │   └── site-packages\              (241 MB)
    │       ├── fastapi\
    │       ├── uvicorn\
    │       ├── pymupdf4llm\
    │       ├── pymupdf\
    │       ├── multipart\
    │       ├── pydantic\
    │       ├── starlette\
    │       ├── anyio\
    │       ├── numpy\
    │       ├── onnxruntime\
    │       ├── networkx\
    │       ├── tabulate\
    │       ├── pip\
    │       └── ... (+90 paquetes transitivos)
    └── Scripts\                        (pip.exe, uvicorn.exe, fastapi.exe, etc.)
```

## Tamaño final payload

- **Total:** 263.6 MB
- **Desglose:** Python embed 10 MB + site-packages 241 MB + app code 10 KB

## Variable nueva externalizada a `LetXinet-Suite.env`

| Variable | Default | Propósito |
|----------|---------|----------|
| `MARKITDOWN_API_PORT` | `7860` | Puerto donde uvicorn escucha (ya estaba en `start-markitdown-api.cmd`) |
| `MARKITDOWN_API_URL` | `http://127.0.0.1:7860` | Lo usa el adapter stdio `markitdown-mcp.js` para conectarse (ya externalizado en V11 en P-2) |

**No nuevas** en esta fase: MarkItDown ya externalizaba todo lo configurable vía env. Solo estructuramos el runtime portátil.

## Decisiones de diseño

### ¿Por qué Python embebido y no `pyinstaller`?

`pyinstaller` crearía un único `.exe` con todo embebido pero:
- **Tamaño ≥ 350 MB** (todos los deps de scipy/numpy/onnxruntime más sistemas adicionales)
- **Binario monolítico**: si una sola dep falla (p.ej. PDF con encoding raro), hay que recompilar todo el exe
- **Tiempos de build lentos**: cada rebuild de `pyinstaller` es ~3 min para deps científicas

El embed + `site-packages/` es:
- **Transparente**: el operador puede abrir `Lib\site-packages\` y ver qué versión está
- **Reparable**: `pip install --upgrade pymupdf4llm` desde `python-runtime\python.exe` actualiza una sola dep
- **Tamaño similar** (241 MB site-packages vs ~350 MB pyinstaller)
- **Arranque idéntico a production**: `python -m uvicorn` es lo que ya usaba el repo original

### ¿Por qué `app.py` suelto y no `.pyz`?

`app.py` son 96 líneas y una sola ruta. No justifica un zip.

### ¿Por qué `mcp-adapter/markitdown-mcp.js` se copia como archivo suelto?

El adapter es para que **opencode** (u otro cliente MCP stdio) lo invoque como comando. **No es un servicio NSSM** — el Suite registra 4 servicios:
1. OSM-MCP
2. MCP-V11-Local
3. MarkItDown API (Python uvicorn)
4. LetXinet Desktop HF

El adapter MCP stdio queda como archivo en `{app}\MarkItDown\mcp-adapter\markitdown-mcp.js` para que el usuario lo configure en su `opencode.json` con `"command": "node"` y `"args": ["{app}\\MarkItDown\\mcp-adapter\\markitdown-mcp.js"]` si quiere exponer la API MarkItDown como MCP stdio a su editor. Lo documentaremos en el README.

## Estado de disco (fin Fase 2)

| Unidad | Libre | Notas |
|--------|-------|-------|
| D: | 11.10 GB | -0.7 GB tras MarkItDown payload |
| C: | 2.59 GB | pip-cache en `%LOCALAPPDATA%\pip\Cache` (puede limpiarse) |

## Próximos pasos

**Fase 3 — Recolección de los 5 payloads** en `componentes-parches\`:
1. `OSM-MCP\` — copia de `osmmcp-patched.exe` (32 MB)
2. `MCP-V11-Local\` — copia de `packaging\bin\MCP-V11-Local.exe` (94 MB) + `dist-portable\` auxiliares
3. `MarkItDown-API\` — copia del payload que acabamos de generar (264 MB)
4. `LetXinet-Desktop-HF\` — copia de `dist\win-unpacked\` (205 MB)
5. `mcp-adapter\` — adapter MarkItDown stdio (ya incluido en MarkItDown-API\)

Cada uno irá a su subcarpeta definitiva para que el `.iss` los empaquete con `Source:`.

---
**Siguiente:** Fase 3 — Recolección de payloads
