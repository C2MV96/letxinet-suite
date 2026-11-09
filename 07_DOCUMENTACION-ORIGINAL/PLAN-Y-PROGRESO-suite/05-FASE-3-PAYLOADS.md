# Fase 3 — Recolección de los 4 payloads en `componentes-parches\`

**Fecha:** 2026-07-31 18:30 – 18:55
**Estado:** ✅ COMPLETADA

## Objetivo

Recolectar en `D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\` los 4 payloads finales que el instalador Inno Setup empaquetará. Cada subcarpeta refleja la estructura exacta que irá a `{app}\<Componente>\` en la máquina destino.

Se añadió un quinto payload **no binario** durante esta fase: **`python-runtime` para el sidecar spaCy de V11**, que NO existía en el `dist-portable\` original porque se borró en Fase 0 para liberar espacio. Se reconstruyó aquí.

## Layout final

```
D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\
├── osm-mcp\                              (23.6 MB)
│   └── osmmcp.exe                        ← go build desde ../letxipu-osm-mcp (Fase 1)
│
├── markitdown-api\                       (263.6 MB)
│   ├── app.py                            ← copia de D:\OTROS\markitdown-api\app.py
│   ├── requirements.txt                  ← (referencia)
│   ├── mcp-adapter\
│   │   └── markitdown-mcp.js             ← adapter MCP stdio para opencode
│   └── python-runtime\                   ← Python 3.12.10 embed + 5 deps MarkItDown
│       ├── python.exe
│       ├── python312.dll
│       ├── python312._pth                (editado: import site + Lib + Lib\site-packages)
│       ├── *.dll, *.pyd                  (libcrypto, libssl, sqlite3, unicodedata, etc.)
│       └── Lib\
│           └── site-packages\            (241 MB)
│               ├── fastapi\              (0.141.1)
│               ├── uvicorn\              (0.52.0)
│               ├── pymupdf4llm\          (1.28.0)
│               ├── pymupdf\              (1.28.0)
│               ├── multipart\
│               ├── pydantic\, starlette\, anyio\, numpy\ (2.5.1), onnxruntime\, etc.
│               └── ...
│
├── mcp-v11-local\                        (631 MB)
│   ├── MCP-V11-Local.exe                 ← pkg build node22-win-x64 (Fase 1)
│   ├── start-mcp-local.cmd               ← launcher existente, copiado
│   ├── .env                              ← .env existente, copiado (variante a cambiar / build-variants.cmd)
│   ├── dist\
│   │   └── server.js                     ← tsc build (Fase 1)
│   ├── python\
│   │   ├── spacy_server.py                ← sidecar Flask de spaCy
│   │   └── requirements.txt              (referencia)
│   └── python-runtime\                   ← **REGENERADO** en Fase 3
│       ├── python.exe, python312.dll, *.pyd, *.dll ...
│       ├── python312._pth                 (editado)
│       └── Lib\
│           └── site-packages\            (~480 MB)
│               ├── spacy\                (3.8.14) + 30 deps transitivas
│               ├── flask\                (3.1.3)
│               ├── numpy\                (1.26.4, **no 2.x** — spaCy 3.8 exige <2.0)
│               ├── thinc\, blis\, murmurhash\, preshed\, cymem\
│               ├── click\, jinja2\, werkzeug\, itsdangerous\
│               ├── pymupdf4llm\, pymupdf\, onnxruntime\
│               ├── en_core_web_sm\       (14.5 MB, modelos spaCy)
│               ├── es_core_news_sm\      (15.5 MB)
│               └── pt_core_news_sm\      (15.4 MB)
│
└── letxinet-desktop\                     (1097.1 MB)
    ├── LetXipu Desktop HF.exe           ← electron-builder --win dir con icono incrustado (Fase 1)
    ├── chrome_100_percent.pak, chrome_200_percent.pak
    ├── d3dcompiler_47.dll, dxcompiler.dll, dxil.dll, ffmpeg.dll
    ├── icudtl.dat, libEGL.dll, libGLES2.dll, snapshot_blob.bin
    ├── vk_swiftshader.dll, vk_swiftshader_icd.json, vulkan-1.dll
    ├── resources.pak, v8_context_snapshot.bin
    ├── locales\                          (50+ idiomas Chromium)
    └── resources\
        ├── app.asar                      ← bundle Electron con server.cjs + dist/
        └── app.asar.unpacked\            ← deps nativas que no se pueden empaquetar en asar
```

**Total payloads:** 2015.2 MB (~2 GB)

## Reconstrucción del `python-runtime` V11

### Contexto

En Fase 0 se eliminó `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\dist-portable\python-runtime\` (895.8 MB) para liberar espacio en D: y poder seguir con los demás builds. La asunción era que el EXE MCP-V11-Local empaquetado por `pkg` era **self-contained** y no necesitaba runtime externo.

### Descubrimiento

Tras aplicar los parches de Fase 1 y construir el EXE, durante la Fase 3 al inspeccionar `dist-portable\start-mcp-local.cmd` se revela que:

> **El launcher V11 invoca un sidecar Python (`spacy_server.py`) que sí requiere un `python-runtime` externo.** El exe Node por sí solo NO es suficiente: spaCy no se puede empaquetar en `pkg` (depende de `numpy` con ABI nativo y modelos de lenguaje de 15 MB c/u).

El sidecar `spacy_server.py` (`dist-portable\python\spacy_server.py`) hace `import spacy, numpy, flask` y carga el modelo `es_core_news_sm` en RAM. Esto requiere:
- Un Python 3.12 embed
- spaCy 3.8.x (con `thinc`, `blis`, `murmurhash`, etc.)
- numpy < 2.0 (compatibilidad con thinc 8.3 — numpy 2.x rompe)
- flask >= 3.0
- click >= 8.0
- 3 modelos spaCy (`en_core_web_sm`, `es_core_news_sm`, `pt_core_news_sm`) ~45 MB
- pymupdf4llm + pymupdf (también en `requirements.txt` del sidecar)

### Regeneración

Construido desde cero siguiendo el mismo patrón que MarkItDown payload:

```powershell
# 1. Python embed nuevo
Invoke-WebRequest "https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip"
Expand-Archive -> build/mcp-v11-python-runtime/
# Editar python312._pth para habilitar site-packages

# 2. Bootstrap pip
Invoke-WebRequest "https://bootstrap.pypa.io/get-pip.py"
python.exe get-pip.py
# pip 26.2 OK

# 3. Instalar deps (numpy < 2.0 crítico)
pip install "spacy>=3.8,<3.9" "flask>=3.0.0" "click>=8.0"
pip install "numpy>=1.24,<2.0"        # downgrade porque spaCy/thinc exigen numpy<2
pip install "pymupdf4llm>=0.0.17" "pymupdf>=1.24.0"
# Resultado: spacy 3.8.14, flask 3.1.3, numpy 1.26.4 (no 2.5.1)

# 4. Copiar modelos spaCy desde src\python\models\
# But there were subdir nested (es_core_news_sm/es_core_news_sm-3.8.0/) que
# impedía spacy.load('es_core_news_sm'). Flatten inner content to parent:
foreach subdir/*.pyd,*.cfg,*.json,*/ -> copy to site-packages/<model_name>/
```

### Q&A del flatten

**¿Por qué los modelos venían `model-3.8.0/` dentro de `model/`?**
Eso es el layout natural de los paquetes spaCy cuando pip los instala desde `.whl`. El `.whl` original `es_core_news_sm-3.8.0-py3-none-any.whl` desempaqueta como `es_core_news_sm/es_core_news_sm-3.8.0/` (con `__init__.py` + `meta.json` en el nivel superior).

**¿Por qué flatten?**
`spacy_server.py` línea 14 tiene `sm = os.path.join(cache_root, 'es_core_news_sm')` y busca `os.path.exists(os.path.join(sm,'config.cfg'))`. `config.cfg` está en `es_core_news_sm/es_core_news_sm-3.8.0/config.cfg`. Tras flatten, `config.cfg` está en `es_core_news_sm/config.cfg` ✓.

**¿Y el primer intento de `spacy.load('es_core_news_sm')` como paquete?**
Falla porque spaCy 3.8 requiere `entry_points` metadata (registro en el `entry_points.txt` del paquete) — nuestros modelos copiados no tienen `.dist-info`. spaCy emite E050. **Pero el fallback `spacy.load(<path>)` funciona perfectamente**, y eso es lo que `spacy_server.py` hace en su segunda rama de código (cuando SPACY_CACHE_ROOT set y `config.cfg` existe). Log dice "Cargando modelo sm (fallback)".

### Verificación funcional

**Smoke test completo: arrancar sidecar + healthcheck HTTP:**

```powershell
$env:SPACY_CACHE_ROOT = "build/mcp-v11-python-runtime/Lib/site-packages"
$env:SPACY_SCRIPT = "dist-portable/python/spacy_server.py"
$env:SPACY_PORT = 14002
python.exe $env:SPACY_SCRIPT
```

**Output stdout:**
```
Iniciando microservicio spaCy...
Cargando modelo sm (fallback)...
spaCy cargado exitosamente en RAM. vectors=(0, 0)
spacy_server listening on port 14002
 * Serving Flask app 'spacy_server'
 * Debug mode: off
 * Running on http://127.0.0.1:14002
```

**HTTP GET `/health`:**
```json
{"ready": true, "status": "ok"}
```

✅ Sidecar funcional.

## Diferencias con el plan original

| Plan | Realidad | Acción |
|------|---------|--------|
| Reutilizar `python-runtime` V11 existente en Fase 5 | Borrado en Fase 0 para liberar espacio | Regenerado en Fase 3 con las versiones correctas |
| HF Desktop: 205 MB | Real: 1097 MB (incluye todos los DLLs de Chromium/Vulkan/DX) | Ajustado el estimado. Inno comprimirá LZMA → ~420 MB |
| V11 portable: 1.12 GB con python-runtime existente | V11 reconstruido: 631 MB (deps optimizadas, vaciado caches) | Reducción de ~490 MB |
| Total suite ~3 GB | Total suite ~2 GB (tras LZMA quizás 1.4 GB final exe) | Mejor de lo planeado |

## Tamaños finales por payload

| Payload | Tamaño | Función en el Suite |
|---------|--------|-------|
| `osm-mcp\` | 23.6 MB | Servicio NSSM en puerto 7082 (MCP OSM para V11 y Desktop HF) |
| `markitdown-api\` | 263.6 MB | Servicio NSSM en puerto 7860 (API MarkItDown para conversiones PDF) |
| `mcp-v11-local\` | 631 MB | Servicio NSSM en puerto 4003 (MCP búsqueda) + sidecar spaCy 4002 |
| `letxinet-desktop\` | 1097 MB | Electron app (lanzada a mano o por shortcut, NO NSSM) |
| **TOTAL** | **2015 MB** | — |

## Estado del disco (fin Fase 3)

| Unidad | Libre |
|--------|-------|
| D: | 8.54 GB |
| C: | 2.54 GB |

Margen suficiente para:
- Fase 4: scripts + `.iss` (~50 KB)
- Fase 5: build Inno LZMA, payload final estimado 700-900 MB (compresión 50-65%)
- Borrar intermediarios `build\` al final (liberará ~1.8 GB)

## Archivos regenerados en esta fase

- `D:\OTROS\LETXINET-SUITE\build\mcp-v11-python-runtime\` (nuevo, 517 MB)
- `D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\osm-mcp\osmmcp.exe` (23.6 MB)
- `D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\markitdown-api\` ( árbol 264 MB)
- `D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\mcp-v11-local\` (árbol 631 MB)
- `D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\letxinet-desktop\` (árbol 1097 MB)
- `D:\OTROS\LETXINET-SUITE\PLAN-Y-PROGRESO\05-FASE-3-PAYLOADS.md` (este log)

## Próximos pasos

**Fase 4 — Generación de código fuente del instalador:**
1. `LetXinet-Suite.env` template con 10 variables externalizadas (en `src-suite\shared-env\`)
2. `LetXinet-Suite.iss` (instalador Inno Setup 6)
3. Launchers `.cmd` por servicio: `start-osm-mcp.cmd`, `start-markitdown-api.cmd`, `start-mcp-v11.local.cmd`, `start-letxinet-desktop.cmd`
4. Scripts NSSM postinstall (`register-services.cmd`) + preuninstall (`uninstall-services.cmd`)
5. `suite-env-loader.cmd` — carga variables de `LetXinet-Suite.env` al inicio de cada launcher
6. `build-variants.cmd` — genera dos installer exe (variante A interno con tokens, variante B público sin tokens)
7. `variant-tokens\variantA-publicar-interno\.env` — tokens reales (gitignored)

---
**Siguiente:** Fase 4 — Generación de código fuente Suite
