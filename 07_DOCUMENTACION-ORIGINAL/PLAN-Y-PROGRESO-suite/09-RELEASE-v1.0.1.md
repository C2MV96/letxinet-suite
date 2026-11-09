# Release v1.0.1 (build v4) — Release final

**Fecha:** 01/08/2026 10:30
**Tag:** v1.0.1 (bugfix release)
**Codename:** "LetXinet Suite Suite Workflow"

## Resumen

Release v1.0.1 corrige 2 bugs críticos detectados en la instalación v3:

1. **NSSM services Paused** — 3 servicios no arrancaban tras instalar v3.
2. **API keys restart-services** — el endpoint fallaba con "Acceso denegado" al usar Desktop HF (no-admin).

Ambos bugs quedan resueltos y validados con una instalación limpiar completa de la Variante B v4 + smoke tests end-to-end.

## Bug fixes

### Bug 1: NSSM AppParameters con espacios

**Síntoma**: tras instalar v3 y reiniciar, los 3 servicios NSSM quedaban `Paused` y los logs stderr mostraban:
```
"C:\Program" no se reconoce como un comando interno o externo
```

**Causa raíz**: NSSM descarta comillas dobles al serializar `AppParameters` al registro de Windows. La llamada:
```cmd
nssm install SVC cmd.exe /c ""C:\Program Files\LetXinet Suite\bin\start-osm-mcp.cmd""
```
generaba un `AppParameters` = `/c "C:\Program Files\...\start-osm-mcp.cmd"` (4 comillas en original) que al ser guardado se reducía a `/c C:\Program Files\...` (sin comillas). cmd.exe partía la ruta en el primer espacio.

**Fix**: 3 thin wrappers `run-osm.cmd` / `run-md.cmd` / `run-v11.cmd` en el raíz del Suite (sin subcarpeta `bin`):
```cmd
@echo off
setlocal enableextensions
set "INSTALL_DIR=%~dp0"
set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
call "%INSTALL_DIR%\bin\start-osm-mcp.cmd"
exit /b %ERRORLEVEL%
```
NSSM ahora se configura con `AppParameters=/c run-osm.cmd` (sin path, sin comillas) y `AppDirectory={app}\`. cmd busca el `run-osm.cmd` en AppDirectory, lo encuentra y lo ejecuta. Dentro del wrapper, los launchers originales en `bin\` se invocan con comillas dobles correctamente (cmd las maneja bien).

V11 también tenía `AppDirectory = {app}\MCP-V11-Local`  — corregido a `{app}\` (raíz) para que encuentre el wrapper.

### Bug 2: POST /api/keys/restart-services acceso denegado

**Síntoma**: desde el tab "API Keys" del Desktop HF, al hacer click en "Guardar y reiniciar":
```json
{"ok":false,"results":{"LetXinetSuiteMCPV11":"error: Command failed: ...\nCan't open service!\nOpenService(): Acceso denegado.\n"}}
```

**Causa raíz**: el proceso Electron corre como usuario estándar sin permisos para `OpenService()` con flags de START|STOP. NSSM exit code = 3 (FILE_NOT_FOUND también da código 3 pero combinado con el mensaje "Acceso denegado" es claro).

**Fix**: el handler `POST /api/keys/restart-services` en `server.cjs` detecta el error por:
- `e.code === 3` (NSSM exit code de "Can't open service")
- O regex literal sobre `e.message` (fallback)
- O decodificación `Buffer.from(msg, "utf16le").toString("utf8")` para solventar el caso donde NSSM emite el stderr en UTF-16LE con `\u0000` intercalados

Cuando confirma acceso denegado, lanza:
```powershell
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath cmd.exe -ArgumentList '/c \"restart-suite.cmd\"' -Verb RunAs -WindowStyle Hidden"
```
Esto dispara el **UAC prompt** al operador. Al aceptar, `restart-suite.cmd` (helper elevado) reinicia los 3 servicios. La response del Desktop HF indica `elevated:true`.

## Nuevos archivos

- `src-suite\instalador\restart-suite.cmd` (1267 bytes) — helper elevado_UAC_para reiniciar los 3 servicios
- `src-suite\instalador\run-osm.cmd` (397 bytes) — wrapper NSSM para OSM-MCP
- `src-suite\instalador\run-md.cmd` (380 bytes) — wrapper NSSM MarkitDown
- `src-suite\instalador\run-v11.cmd` (403 bytes) — wrapper para MCP-V11

## Archivos patcheados

- `src-suite\instalador\register-services.cmd` — AppParameters=`/c run-{osm|md|v11}.cmd` + AppDirectory=`%~dp0.` (MCP-V11 también, antes era `%~dp0MCP-V11-Local`)
- `src-suite\instalador\LetXinet-Suite.iss` — `[Files]` añade `restart-suite.cmd` + `run-*.cmd` al raiz del Suite; `[Icons]` añade atajo "Reiniciar servicios del Suite"
- `src-suite\instalador\build-variants.cmd` — refactor flujo `call :build_a && call :build_b` con `enabledelayedexpansion` (elimina falso "Build FALLIDO" de ISCC con warnings benignos)
- `src-suite\componentes-parches\letxinet-desktop\resources\app.asar.unpacked\dist\server.cjs` (304748 bytes v4.1) — handler restart-services con auto-elevación

## Smoke tests v4 — todos OK

Realizados el 2026-08-01 10:28-10:30 sobre instalación limpia v4 Variant B:

| Test | Resultado |
|------|-----------|
| Desinstalar v3 via unins000.exe /SILENT | OK |
| Instalar v4 Variant B silent (~3 min) | OK Exit 0 |
| 3 servicios NSSM registros automáticos en el `[Run]` del installer | OK sin fixes manuales |
| Estado post-install OSM-MCP (7082) | Running HTTP 200 |
| Estado post-install MarkitDown (7860) | Running HTTP 200 |
| Estado post-install MCP-V11 (4003) | Running HTTP 200 |
| Sidecar spaCy (4002) | Running HTTP 200 |
| Lanzar Desktop HF (Express en 43123) | HTTP 200 en /api/keys |
| `GET /api/keys` — 18 claves con mascarado + flags `*Configured` | OK |
| Env propagation .env → secrets.json (UNPAYWALL_EMAIL, OSM_USER_AGENT) | OK |
| `POST /api/keys` (guardar `geminiApiKey="test_install_v4_OK"`) | `ok:true, persistedAt:"..."` |
| `POST /api/keys/restart-services` | `ok:true, elevated:true, message:"Reinicio elevado lanzado (UAC)..."` |
| Estado post-UAC restart de los 3 servicios | Los 3 Restart log Väliselt exit=0 |
| spasifier post-restart (4002) | Retomido pronto con "spaCy sidecar ready" |

## Artefactos del release

### Installer VariantA (interno, con tokens)
- `LetXinet-Suite-1.0.0-VariantA-Setup.exe` — 4,972,208 bytes
  - SHA256: `3DDDF8E1B53EE011FDC62D96E7DFA20A5C24BA608EEBBDC42E7FEE32381DCC1C`
- `LetXinet-Suite-1.0.0-VariantA-Setup-1.bin` — 528,329,653 bytes (503.83 MB)
  - SHA256: `194564C4B6EB07F9EAE64A79B85B75F7B97EC9B8BC3C1B93E102DD4827F7841A`

### Installer VariantB (pública, sin tokens)
- `LetXinet-Suite-1.0.0-VariantB-Setup.exe` — 4,972,196 bytes
  - SHA256: `7137ABFE147CDCD1967D3BAE90C89C93AEADA94D4A08DED98FE6E5011BBFD46D`
- `LetXinet-Suite-1.0.0-VariantB-Setup-1.bin` — 528,305,778 bytes (503.83 MB)
  - SHA256: `A5CC2EDB7478B38F0812592D75C38E4CC19D4FF4F17B20ED911F3B7DAAD3FAE9`

### Documentación
- `PLAN-Y-PROGRESO\08-FASE-7-POSTINSTALL-BUGFIX.md` — análisis técnico de los bug fixes
- `PLAN-Y-PROGRESO\09-RELEASE-v1.0.1.md` — este archivo (log release)
- `PLAN-Y-PROGRESO\CHANGELOG.md` — seccion v1.0.1 añadida
- `build\installer-output\HASHES-SHA256.txt` — tabla de hashes v4

## Estado final del entorno de pruebas

Tras la instalación v4 en la laptop:
- Suite instalada en `C:\Program Files\LetXinet Suite\` — todos componentes a nivel `bin\` y otros carpetas.
- 3 servicios Windows registrados como Automatic via NSSM:
  - `LetXinetSuiteOSMMCP` (7082) - OSM-MCP (Go binario)
  - `LetXinetSuiteMarkitDown` (7860) - MarkItDown API (Python)
  - `LetXinetSuiteMCPV11` (4003 + sidecar spaCy 4002) - MCP-V11-Local (Node pkg)
- `LetXinet-Suite.env` en `C:\ProgramData\LetXinet Suite\` (258 lineas, 11 seccón, NO se sobreescribe al reinstalar).
- Atajos en Menu Inicio (LetXinet Suite\):
  - LetXipu Desktop HF
  - Configurar API keys (asistente cmd interactivo fallback)
  - Editar LetXinet-Suite.env (Notepad elevado)
  - Ver logs centralizados
  - Detener servicios del Suite (cmd as admin)
  - **Reiniciar servicios del Suite** (cmd as admin, NUEVO v4)
  - Desinstalar LetXinet Suite (Unins000)

## Pendiente

Ninguno. Release v1.0.1 listo para distribución:

- Variante A: lista para distribución interna C2MV (con tokens en el `.exe`).
- Variante B: lista para distribución pública (operador rellena claves vía tab "API Keys" en Desktop HF).
