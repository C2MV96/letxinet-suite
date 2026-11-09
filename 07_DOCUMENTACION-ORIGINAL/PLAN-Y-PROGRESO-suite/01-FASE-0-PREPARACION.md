# Fase 0 — Preparación del entorno

**Fecha:** 2026-07-31
**Estado:** ✅ COMPLETADA

## Objetivo

Instalar las herramientas de build y liberar espacio en disco antes de aplicar parches y generar el instalador.

## Tareas ejecutadas

### 0.1 — Instalar Inno Setup 6

- **Comando:** `winget install JRSoftware.InnoSetup --version 6.7.3 --accept-package-agreements --accept-source-agreements --silent`
- **Resultado:** ✅ Instalado en `C:\Users\USER\AppData\Local\Programs\Inno Setup 6\`
- **ISCC.exe:** `C:\Users\USER\AppData\Local\Programs\Inno Setup 6\ISCC.exe`
- **Versión:** Inno Setup 6 Command-Line Compiler (6.7.3)
- **Nota:** Instalación por usuario (no requiere admin, no alcanza Program Files). El `.iss` se compilará con ruta absoluta al ISCC.

### 0.2 — Descargar NSSM 2.24

- **Fuente:** https://nssm.cc/release/nssm-2.24.zip (343 KB)
- **Ubicación final:** `D:\OTROS\LETXINET-SUITE\src-suite\instalador\nssm\nssm.exe` (331 264 bytes, win64)
- **Comando `nssm version`:** no imprime salida por stdout (comportamiento normal de NSSM; se verifica con `nssm install DummySvcTest` en Fase 6)
- **Deepclean:** zip y subcarpetas win32/win64 eliminados tras extraer el win64.

### 0.3 — Liberar 939 MB en D:

- **Acción:** `Remove-Item D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\dist-portable\python-runtime -Recurse -Force`
- **Tamaño borrado:** 895.8 MB (python-runtime portable de V11 — se regenera en Fase 5 con `yao-pkg` que embebe Python embebido si hace falta, o se recompila desde `python-runtime-src`)
- **D: libre antes:** 3.41 GB
- **D: libre después:** 4.31 GB
- **Condición respecto al plan:** ✅ Suficiente para completar el Suite (payload final estimado 2.5–3 GB)

## Estado del espacio en disco (fin Fase 0)

| Unidad | Libre |
|--------|-------|
| D: | 4.31 GB |
| C: | 1.56 GB |

**⚠ Alerta C:** El drive C: quedó muy ajustado (1.56 GB). Esto puede dificultar:
- Instalación de paquetes pip/Python con caché en `%LOCALAPPDATA%\pip\Cache`
- Descargas temporales de winget/nuget en `%TEMP%`

**Mitigación:** Pip se invocará con `--no-cache-dir` y `--target` apuntando a D:. Cualquier build temporal se hace en `D:\OTROS\LETXINET-SUITE\build\`.

## Herramientas verificadas (entorno de build Suite)

| Herramienta | Versión | Ruta | Estado |
|-------------|---------|------|--------|
| Inno Setup (ISCC) | 6.7.3 | `%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe` | ✅ |
| NSSM | 2.24 (win64) | `D:\OTROS\LETXINET-SUITE\src-suite\instalador\nssm\nssm.exe` | ✅ |
| Go | 1.26.4 | `go` en PATH | ✅ |
| Node | 24.11.1 | `node` en PATH | ✅ |
| npm | 11.6.2 | `npm` en PATH | ✅ |
| Python | 3.12.10 | `C:\Users\USER\AppData\Local\Programs\Python\Python312\python.exe` | ✅ |
| pip | 25.0.1 | en PATH | ✅ |
| winget | — | `winget` en PATH | ✅ |

## Herramientas pendientes (Fase 0.5)

| Herramienta | Uso | Estado |
|-------------|-----|--------|
| cairosvg | SVG → PNG | ⏳ por instalar (pip) |
| pillow | PNG → ICO multi-res | ⏳ por instalar (pip) |

## Verificación de prerrequisitos para la Fase 1 (parches)

| Componente | Binario compilado | Recompilable |
|-------------|-------------------|--------------|
| OSM-MCP | `osmmcp.exe` (24.7 MB) | ✅ `go build` desde `D:\OTROS\letxipu-osm-mcp` |
| MCP-V11-Local | `dist-portable\MCP-V11-Local.exe` (69.8 MB) | ✅ `npm run build:pkg` |
| LetXinet Desktop HF | `dist\win-unpacked\` (205 MB) | ✅ `electron-builder --win dir` |
| MarkItDown API | scripts Python | ✅ no compila (Python portátil en Fase 2) |

## Verificación de espacio disponible tras liberar

- D: 4.31 GB libres
- Payload Suite estimado: 2.5–3 GB
- Margen suficiente para build + variantes A/B + logs

## Conclusión

Entorno listo para iniciar **Fase 0.5** (generación del icono `.ico` desde `D:\OTROS\LETXIPU.svg`) y luego **Fase 1** (aplicación de los 4 parches quirúrgicos y recompilación de los 3 componentes binarios).

**Decisión:** se omite `python-runtime` en el instalador V11 portable; se confirmará en Fase 5 si V11 necesita regenerar su runtime. Si lo necesita, se ejecutará el script V11 existente que crea el Python embebido (`D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\build-python-runtime.ps1` o equivalente a confirmar).

## Archivos creados / modificados en esta fase

- `D:\OTROS\LETXINET-SUITE\src-suite\instalador\nssm\nssm.exe` (nuevo, 331 KB)
- `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\dist-portable\python-runtime\` (borrado, -895 MB)
- `D:\OTROS\LETXINET-SUITE\PLAN-Y-PROGRESO\01-FASE-0-PREPARACION.md` (este log)

---
**Siguiente:** Fase 0.5 — Icono `.ico` desde `LETXIPU.svg`
