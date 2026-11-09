# Fase 7 — Post-install bugfix (NSSM quoting + UAC restart)

**Fecha:** 01/08/2026 08:30–08:55
**Estado:** ✅ Smoke tests completos — faltan recompilar instaladores v4

## Bug 1: NSSM AppParameters con espacios → cmd parte la ruta

### Síntoma
Tras instalar v3 (silent install), los 3 servicios NSSM (LetXinetSuiteOSMMCP, LetXinetSuiteMarkitDown, LetXinetSuiteMCPV11) quedan `Paused` después del inicio. Logs stderr:
```
"C:\Program" no se reconoce como un comando interno o externo,
programa o archivo por lotes ejecutable.
```

### Análisis
Inno Setup había parcheado `%NSSM%` con comillas dobles en `register-services.cmd` (bug previo) — fix correcto para invocar `nssm.exe`. Pero aún faltaba el bug de los launchers `start-*.cmd`.

`register-services.cmd` ejecutaba:
```cmd
"%NSSM%" install LetXinetSuiteOSMMCP "%COMSPEC%" /c ""%SUITE_BIN%\start-osm-mcp.cmd""
```
NSSM guardaba en el registro:
- `Application` = `C:\Windows\system32\cmd.exe`
- `AppParameters` = `/c ""C:\Program Files\LetXinet Suite\bin\start-osm-mcp.cmd""` (con comillas dobles dobles)

Cuando cmd arrancaba interpretaba el primer par de `""` como cierre de comando → tomaba `C:\Program Files\...` como dos argumentos → error `"C:\Program" no se reconoce`.

### Intento 1: path corto 8.3 — fallido
Convertí `SUITE_BIN` → `C:\PROGRA~1\LetXinet Suite\bin` (8.3 equivale a `Program Files`carácter), pero sigue habiendo espacio en `LetXinet Suite`. El SCM transfirió el parámetro sin comillas a cmd → cmd parte en `LetXinet` y `Suite\bin\start-osm-mcp.cmd`.

NSSM descarta comillas dobles al guardar `AppParameters` (comportamiento documentado).

### Intento 2: comillas simples en AppParameters — fallido
NSSM elimina comillas dobles al serializar → idéntico problema.

### Fix definitivo: wrappers `run-*.cmd` en raíz del Suite

Creé 3 thin wrappers en `C:\Program Files\LetXinet Suite\` (sin subcarpeta `bin`):

```cmd
@echo off
REM run-osm.cmd - Thin wrapper en raiz del Suite
setlocal enableextensions
set "INSTALL_DIR=%~dp0"
set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
call "%INSTALL_DIR%\bin\start-osm-mcp.cmd"
exit /b %ERRORLEVEL%
```

NSSM se reconfigura a:
- `Application` = `cmd.exe`
- `AppParameters` = `/c run-osm.cmd`  ← **sin path, sin comillas**
- `AppDirectory` = `C:\Program Files\LetXinet Suite`

cmd busca `run-osm.cmd` en AppDirectory, lo encuentra y lo ejecuta (sin espacio en el nombre del archivo). Dentro del cmd, `%~dp0` = `C:\Program Files\LetXinet Suite\` y la invocación a `bin\start-osm-mcp.cmd` sí funciona porque **dentro del cmd** las comillas dobles funcionan correctamente (no las consume NSSM).

`register-services.cmd` parchado:
```cmd
"%NSSM%" install LetXinetSuiteOSMMCP "%COMSPEC%" /c run-osm.cmd
"%NSSM%" set LetXinetSuiteOSMMCP AppDirectory "%~dp0."
```

Resultado: 3 servicios RUNNING + probes HTTP 200 en 7082/7860/4003 + spaCy sidecar 4002.

## Bug 2: POST /api/keys/restart-services fallaba desde Desktop HF no-admin

### Síntoma
Desde el tab "API Keys" → botón "Guardar y reiniciar":
```json
{"ok":false,"results":{"LetXinetSuiteMCPV11":"error: Command failed: ...\nC\u0000a\u0000n\u0000'\u0000t\u0000..."}}
```

### Análisis
El proceso Electron corre como usuario estándar (sin admin). `nssm restart Nombre` requiere `OpenService()` con `SC_MANAGER_CONNECT|ENUMERATE_SERVICE|QUERY_STATUS|START|STOP` — la llamada falla con `ERROR_ACCESS_DENIED (5)`.

`server.ts` original sólo hacía `execFile(nssm, ["restart", svc])` y si fallaba devolvía `ok:false` — sin intentar elevación.

### Parche server.ts (handler POST /api/keys/restart-services)

1. Detecta "access denied" por:
   - `e.code === 3` (NSSM exit code 3 — el de "Can't open service")
   - O regex sobre `e.message` (limitado porque NSSM emite stderr en **UTF-16LE** con `\u0000` intercalados — regex literal no matchea)
   - O decodificación `Buffer.from(msg, "utf16le").toString("utf8")` + regex

2. Si `accessDenied=true` y existe `restart-suite.cmd` en `{ProgramFiles}\LetXinet Suite\`, lanza:
   ```powershell
   powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath cmd.exe -ArgumentList '/c \"restart-suite.cmd\"' -Verb RunAs -WindowStyle Hidden"
   ```
   Eso dispara el **UAC prompt** al operador. Al aceptar, `restart-suite.cmd` restart los 3 servicios.

3. Response: `{ok:true, elevated:true, message:"Reinicio elevado lanzado (UAC)..."}`.

### Helper `restart-suite.cmd`
```cmd
@echo off
setlocal
set "NSSM=%~dp0bin\nssm.exe"
set "LOG=%PROGRAMDATA%\LetXinet Suite\Logs\restart-suite.log"
echo === restart-suite.cmd %date% %time% === >> "%LOG%"
for %%S in (LetXinetSuiteMCPV11 LetXinetSuiteMarkitDown LetXinetSuiteOSMMCP) do (
    sc query %%S >nul 2>&1 && (
        "%NSSM%" restart %%S >> "%LOG%" 2>&1
    )
)
exit /b 0
```

### Smoke test final
```
POST /api/keys → {"ok":true,"persistedAt":"2026-08-01T13:56:54.302Z"}
POST /api/keys/restart-services → HTTP 200
  ok:True
  elevated:True
  message:"Reinicio elevado lanzado (UAC). Los servicios se reiniciaran en segundo plano."

restart-suite.log:
  [8:56:58.82] Restarting LetXinetSuiteMCPV11... STOP/START exit=0
  [8:56:58.82] Restarting LetXinetSuiteMarkitDown... STOP/START exit=0
  [8:56:58.82] Restarting LetXinetSuiteOSMMCP... STOP/START exit=0
  [8:57:11.61] Done.

Estado post-restart:
  LetXinetSuiteOSMMCP: Running
  LetXinetSuiteMarkitDown: Running
  LetXinetSuiteMCPV11: Running
Probes HTTP: 7082/7860/4003 → 200 OK
```

## Archivos tocados

### Patched
- `src-suite\instalador\register-services.cmd` → AppParameters `/c run-osm.cmd` (sin path), AppDirectory al raíz del Suite
- `src-suite\instalador\LetXinet-Suite.iss` → añade `restart-suite.cmd` y `run-*.cmd` al `[Files]` + atajo "Reiniciar servicios" en `[Icons]`
- `src-suite\componentes-parches\letxinet-desktop\` (staging Desktop HF rebuild con server.cjs v4.1)
- `\server.ts` (handler restart-services con elevación UAC + detección code===3)
- `\electron\main.cjs` (sin cambios — propagación 22 env vars ya OK desde v3)

### Nuevos
- `src-suite\instalador\run-osm.cmd` — thin wrapper para_nsec OSM
- `src-suite\instalador\run-md.cmd` — thin wrapper MarkitDown
- `src-suite\instalador\run-v11.cmd` — thin wrapper V11
- `src-suite\instalador\restart-suite.cmd` — helper elevado para UAC restart

## Pendiente

1. **Recompilar instaladores v4** (`build-variants.cmd`) con todos los fixes — ~50 min total
2. Actualizar hashes SHA256 + CHANGELOG v1.0.1 (bugfix release)
3. Instalación silent v4 en la laptop + smoke test completo final
