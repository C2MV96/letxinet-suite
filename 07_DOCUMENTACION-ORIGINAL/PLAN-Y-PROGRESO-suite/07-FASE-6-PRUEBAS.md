# Fase 6 — Pruebas funcionales (install/uninstall/reinstall)

Fecha: 2026-07-31
Duracion: ~2 horas

---

## Resumen ejecutivo

| Subfase | Estado | Detalle |
|---|---|---|
| 6.1 Instalacion variante B (silent) | ✅ OK | 344s, 2 GB copiados en D:\\LS-Test\\ |
| 6.2 Healthchecks (4 endpoints) | ✅ OK | OSM 7082, MarkItDown 7860, V11 4003, Desktop 43123 todos 200 |
| 6.3 Editar .env + reinicio | ⏸ Skip | Requiere admin interactivo UAC. Documentado como prueba manual. |
| 6.4 Desinstalacion | ✅ OK | 3 servicios gone, D:\\LS-Test gone, ProgramData preserved |
| 6.5 Reinstalacion + idempotencia | ✅ OK | .env SHA256 unchanged, servicios re-registrados OK |
| 6.6 Final v2 build con fixes | ✅ OK | Compilado variantA + variantB post-fixes. Tested clean in D:\\LS-Test3 |

---

## Bugs descubiertos y corregidos durante pruebas

### Bug A — `nssm.exe` path incorrecto en `register-services.cmd`

**Sintoma**: Tras instalar variante B en D:\\LS-Test\\, [Run] invoca `register-services.cmd` que retorna `ExitCode: 1` (en log: "Process exit code: 1"). Los 3 servicios NSSM no se registran.

**Causa raiz**: En `register-services.cmd`, la linea:
```
set "NSSM=%~dp0nssm\nssm.exe"
if not exist "%NSSM%" set "NSSM=%~dp0\nssm.exe"
```
Apuntaba a paths inexistentes — el instalador copia nssm.exe a `{app}\bin\nssm.exe` (via linea `Source: "nssm\nssm.exe"; DestDir: "{app}\bin"` del .iss).

**Fix aplicado**:
```
set "NSSM=%~dp0bin\nssm.exe"
if not exist "%NSSM%" set "NSSM=%~dp0..\bin\nssm.exe"
```
(`%~dp0bin\nssm.exe` se resuelve correcto ya que el script está en `{app}\register-services.cmd`, %~dp0={app}\ + `bin\nssm.exe` = `{app}\bin\nssm.exe`.)

Mismo fix aplicado a `uninstall-services.cmd`.

### Bug B — `MCP-V11-Local.exe` equivocado en `componentes-parches`

**Sintoma**: Tras arreglar Bug A, el servicio `LetXinetSuiteMCPV11` arrancaba y se detenía inmediatamente (NSSM status `SERVICE_STOPPED`, exit code Win32 1066, service exit code 3). El V11 fallaba al iniciar.

**Causa raiz**: En `componentes-parches\mcp-v11-local\MCP-V11-Local.exe` había un exe de 66.57 MB (solo runtime Node 20.18, sin bytecode pkg del server). Al ejecutarlo este behaviour: se iniciaba Node, intentaba `require('dotenv')` desde `dist/server.js` (no encontrado porque no hay node_modules), y crasheaba inmediatamente. Logs de NSSM no recibían stderr porque el cmd launcher invoca `"NODE_EXE" "dist/server.js"` y ese Node no encuentra dotenv.

Diagnostico clave: el exe correcto (bundle pkg completo) estaba en `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\bin\MCP-V11-Local.exe` (93.75 MB), mientras que el fillable fue copiado erroneamente de `dist-portable\MCP-V11-Local.exe` (66.57 MB) durante la Fase 3.

Verificacion con el exe de packaging:
```
$ ./MCP-V11-Local.exe --version
{"level":30,"name":"letxipu-v10","msg":"LETXIPU SEARCH MCP v11.0.0 ..."}
```
Confirmado: el exe correcto incluye Node 22 + bytecode con todos los node_modules embebidos.

**Fix aplicado**:
```
Copy-Item -LiteralPath "D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\bin\MCP-V11-Local.exe" `
          -Destination "D:\OTROS\LETXINET-SUITE\src-suite\componentes-parches\mcp-v11-local\MCP-V11-Local.exe" -Force
```
(Exe de 66.57 MB reemplazado por el de 93.75 MB correcto.)

Importante: el `start-mcp-v11-local.cmd` original SI pasa `dist/server.js` como argumento al exe — eso es correcto. Al recibir arg, pkg lo ejecuta con el runtime Node embebido en el exe (NO el del sistema). El bug no era del launcher, era del exe equivocado en el payload.

### Bug C — AppDirectory incorrecto para V11

**Sintoma**: NSSM seteaba `AppDirectory = D:\LS-Test\..\MCP-V11-Local` (= `D:\MCP-V11-Local`, carpeta inexistente), con lo que cmd fallaba al hacer `cd /d "D:\LS-Test\..\MCP-V11-Local"` y crasheaba.

**Causa raiz**: En `register-services.cmd`:
```
%NSSM% set LetXinetSuiteMCPV11 AppDirectory "%~dp0.."
```
`%~dp0..` apuntaba a `D:\Otros` (dir padre de `D:\LS-Test\`). Eso funcionaba para OSM y MarkItDown porque el launcher hace su propio `cd` interno, pero V11 necesita AppDirectory exacto a su carpeta (donde está el .env que dotenv.config() busca).

**Fix aplicado**:
```
%NSSM% set LetXinetSuiteOSMMCP    AppDirectory "%~dp0."           (OSM: {app})
%NSSM% set LetXinetSuiteMarkitDown AppDirectory "%~dp0."            (MarkItDown: {app})
%NSSM% set LetXinetSuiteMCPV11     AppDirectory "%~dp0MCP-V11-Local"  (V11: {app}\MCP-V11-Local)
```

### Resultado de los 3 fixes

Tras parchear manualmente D:\\LS-Test\\ y reiniciar servicios: 3 servicios RUNNING + 3 healthchecks OK. Tras esto, recompilé los instaladores (v2) con los fixes en el `.bin`:

| Variante | exe hash | bin hash |
|---|---|---|
| A | `E1CF1F20556117E0C637C032C53981B22B20802D4461EB4AFC3E757F62AEAEF7` | `92D98A42310C36C7D319F445464F30A3612E259AE119EB515AA831B327DA1090` |
| B | `955442D5B2FA166DE3F992078C6CE8545B7B2856CB89EC82FBBE2C5CB5998DBD` | `3CF027FCFBC8D432809C94204A64771EE08CDC5BD9D4649D6DE4BB26060C0EAB` |

Verificacion final del v2 sobre D:\\LS-Test3 (instalacion limpia, SIN parches manuales):
- `[Run] register-services.cmd` exit code: **0** ✅ (en log: "Process exit code: 0")
- 3 servicios RUNNING: LetXinetSuiteOSMMCP, LetXinetSuiteMarkitDown, LetXinetSuiteMCPV11
- 3 healthchecks: `OSM 7082` OK, `MarkItDown 7860` OK, `V11 4003` OK
- Uninstaller posterior: clean ( servicios gone, dir gone, ProgramData preserved)

---

## Detalle tecnico de las pruebas

### 6.1 — Instalacion silenciosa

```
$exe = "D:\OTROS\LETXINET-SUITE\build\installer-output\variantB\LetXinet-Suite-1.0.0-VariantB-Setup.exe"
Start-Process -FilePath $exe `
   -ArgumentList "/SILENT","/SUPPRESSMSGBOXES","/NORESTART","/NOCLOSEAPPLICATIONS","/NORESTARTAPPLICATIONS","/DIR=D:\LS-Test","/LOG=install.log" `
   -PassThru -Wait -Verb RunAs
```
ExitCode: 0. Duration: 344s (~5.7 min). Log size: 10.9 MB (110k+ lineas de destfile entries).

Archivos copiados en `D:\LS-Test\`:
| Carpeta | Tamaño |
|---|---|
| bin/ (launchers + nssm) | 0.33 MB |
| OSM-MCP/ | 23.55 MB |
| MarkItDown/API/ | 263.58 MB |
| MCP-V11-Local/ | 630.99 MB |
| LetXinet-Desktop/ | 1097.07 MB |
| assets/ | 0.11 MB |
| **Total** | **2015 MB** |

`%PROGRAMDATA%\LetXinet Suite\`:
- `LetXinet-Suite.env` (6012 bytes, plantilla copiada desde `shared-env\`)
- `Logs\` (carpeta vacía, será llenada por NSSM)

### 6.2 — Healthchecks de los 4 endpoints

| Endpoint | URL | Estado | Comentario |
|---|---|---|---|
| OSM-MCP | `http://127.0.0.1:7082/` | 200 | JSON con 28 MCP tools, polaris endpoints |
| MarkItDown API | `http://127.0.0.1:7860/` | 200 | Health endpoint dice "status": "online", "engine": "PyMuPDF4LLM" |
| MCP-V11-Local | `http://127.0.0.1:4003/health` | 200 | `{"status":"ok","version":"11.0.0","tools":28, ...}` |
| Letxipu Desktop HF | `http://127.0.0.1:43123/` | 200 | Express escuchando en 0.0.0.0:43123 (PID 16864, main process Electron). Tarda ~35s en levantar Express. |

Notas:
- OSM-MCP tiene tambien endpoint Prometheus en `:19090/metrics` (no probado, no bloqueante).
- V11 subendpoint spaCy en `:4002` respondio health 200 en log NSSM (`127.0.0.1 - "GET /health HTTP/1.1" 200 -`).
- Electron main process abre Express *después* de cargar el contenido del BrowserWindow (React UI). ~35s en total. Este es el proceso main como servidor HTTP para servir el MCP gateway al renderer.

### 6.3 — Skip prueba de edicion manual de .env

Comportamiento esperado: tras editar `OSM_MCP_PORT=17099` en `LetXinet-Suite.env`, `nssm restart LetXinetSuiteOSMMCP` debe arrancar el servicio en nuevo puerto.

No se pudo automatizar desde opencode porque:
- El instalador Nimno creó el `.env` en `%PROGRAMDATA%\LetXinet Suite\` con ACL administrators-only (permisos `ReadAndExecute` para `BUILTIN\\Usuarios`, sin Write).
- Modificarlo requiere `Start-Process -Verb RunAs`, y este behaviour se colgaba en cada attempt probado (UAC popup no se procesaba correctamente desde el subprocesso Spawn de opencode).

**Prueba manual recomendada para el operador final**:
- Click derecho en el atajo del menu inicio "Editar LetXinet-Suite.env" → abre Notepad en modo admin via UAC.
- Cambiar la línea `OSM_MCP_PORT=7082` a `OSM_MCP_PORT=17099`.
- Services.msc → restart LetXinetSuiteOSMMCP.
- Verificar: `Invoke-WebRequest http://127.0.0.1:17099/` debe responder 200. `Invoke-WebRequest http://127.0.0.1:7082/` debe fallar.

### 6.4 — Desinstalacion

Llamado: `D:\LS-Test\unins000.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG=...`

| Item | Estado post-uninstall |
|---|---|
| 3 servicios NSSM (OSMMCP, MarkitDown, MCPV11) | GONE |
| Carpeta `D:\LS-Test\` | GONE (completamente) |
| Carpeta `%PROGRAMDATA%\LetXinet Suite\` | PRESERVADA |
| └── `Logs\` | PRESERVADA (con logs de todos los servicios) |
| └── `LetXinet-Suite.env` | PRESERVADO (no se sobreescribe en reinstall) |
| Atajos menu inicio `Letxipu Desktop HF` | GONE |
| Atajo escritorio `Letxipu Desktop HF.lnk` | GONE |
| Registry uninstall key `HKLM\...\{7F8B9C2D-LETX-SUITE-2026-VARIANT-B-...}_is1` | GONE |

Log clave (uninstall-test.log):
```
20: Running Exec filename: D:\LS-Test\uninstall-services.cmd
21: Process exit code: 0   (10 segundos - detuvo y removio 3 servicios con NSSM)
22: Deleting registry key: HKEY_LOCAL_MACHINE\Software\...\{...VARIANT-B-...}_is1
23+: Deleting file: C:\Users\Public\Desktop\LetXinet Desktop HF.lnk
```

`uninstall-services.cmd` ejecutado por [UninstallRun] con flag `RunOnceId: "StopServices"`:
- `taskkill /F /IM "Letxipu Desktop HF.exe"` (matar Electron)
- Por cada servicio (en orden: V11 → MarkItDown → OSM, dependencias inversas):
  - `nssm stop` → `nssm remove confirm`
- 3 servicios removidos OK.

### 6.5 — Reinstalacion + idempotencia

Reinstalar sobre un `.env` existente no debe sobrescribirlo.

**Snapshot pre-reinstall**:
```
Size: 6012
LastWriteTime: 07/31/2026 19:01:36
SHA256: D54721408494D97067D8F306CAAA680932D4B9C68FF2E13EA12D3342B4870A10
```

Tras reinstall el instalador a D:\\LS-Test2\\, el log muestra (linea 82):
```
Dest filename: C:\ProgramData\LetXinet Suite\LetXinet-Suite.env
```
Pero NO se sobreescribe porque el `.iss` tiene `Flags: onlyifdoesntexist uninsneveruninstall` para este archivo.

**Snapshot post-reinstall**:
```
Size: 6012
LastWriteTime: 07/31/2026 19:01:36   (igual)
SHA256: D54721408494D97067D8F306CAAA680932D4B9C68FF2E13EA12D3342B4870A10
MATCH: True
```

✅ El `.env` del operador se preserva tras reinstalacion/upgrade.

### 6.6 — Final v2 build + prueba limpia

Tras descubrir los bugs A, B, C durante Fase 6, se corrigieron en `src-suite\instalador\`. Se recompilaron ambos instaladores con los fixes:

- variantA: 22.2 min build, exit code ISCC = 0, exe + bin totales 508.5 MB
- variantB: 17.4 min build, exit code ISCC = 0, exe + bin totales 508.5 MB

Prueba final en `D:\LS-Test3` (instalacion limpia del v2):
- `[Run] register-services.cmd` returnó `exit code: 0` ✅ (no hay parches manuales)
- 3 servicios RUNNING ✅
- 3 healthchecks OK 200 ✅
- Uninstall posterior limpio ✅

---

## Resumen final de la Fase 6

- **2 bugs mayores descubiertos y corregidos** durante pruebas funcionales (nssm path + V11 exe equivocado). El descubrimiento fue justificado por hacer el proceso end-to-end.
- **3 bugs totales** (A, B, C) corregidos en `register-services.cmd` y `uninstall-services.cmd` + en el payload `componentes-parches\mcp-v11-local\.`
- **Recompilado release v2** con todos los fixes, probado sin parches manuales → OK.
- **Instaladores finales release-ready**:
  - variantA/interno: 508.5 MB total (4.74 MB wizard + 503.79 MB payload LZMA2)
  - variantB/publico: 508.5 MB total (4.74 MB wizard + 503.80 MB payload LZMA2)
  - Hashes documentados para verificacion integridad.

---

## Issue conocido (no bloqueante)

- **Banner V11 en logs con encoding raro**: el banner ASCII del V11 se ve con chars `?` en los logs syslog (JSON `pino` con `console` destination). Es porque el banner usa chars Unicode (`╔══╗ ║ ╠║`) y stdout del cmd está en CP437 (no UTF-8). El runtime V11 NPkg pino logger serializa el console output en CP437. No afecta funcionalidad — el banner solo es decorativo al inicio.

## Pruebas pendientes de hacer (manual, por el operador final)

- **6.3 Cambiar puerto del .env y verificar que se aplica**: requiere editor elevado para abrir `%PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env` y modificar. Procedimiento:
  1. Menu inicio → "Editar Letxipu-Suite.env" (Notepad elevado via UAC)
  2. Cambiar `OSM_MCP_PORT=7082` a `OSM_MCP_PORT=17099`
  3. Services.msc → restart `LetXinetSuiteOSMMCP`
  4. `Invoke-WebRequest http://127.0.0.1:17099/` deberia responder 200.

- **Pruebas de resilience**: para accidentes de procesos:
  - `taskkill /F /PID <v11-pid>`manuel → NSSM must reiniciar servicio tras 5-10s
  - `nssm stop` y `nssm start` no debe perder estado

- **Smoke test funcional V11**: hacer un MCP `tools/list` request real:
  ```
  POST http://127.0.0.1:4003/api/mcp
  Content-Type: application/json
  {"jsonrpc":"2.0","id":1,"method":"tools/list"}
  ```
  Deberia devolver JSON-RPC con lista de 28 tools.

- **Prueba integración Desktop HF + V11**: lanzar Desktop HF via shortcut, abrir la GUI, hacer una busqueda academica real. Verificar que el renderer invoca `/api/search` al endpoint V11 LOCAL (con `LETXIPU_DESKTOP_GATEWAY=true`). Esa prueba requiere interaccion humana.

EOF.
