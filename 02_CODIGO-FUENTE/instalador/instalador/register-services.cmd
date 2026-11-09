@echo off
REM register-services.cmd - Registra los 3 servicios Windows del LetXinet Suite via NSSM.
REM
REM Invocado por el instalador Inno en [Run] despues de copiar archivos.
REM Requiere privilegios administrativos (Inno ya pidio elevation).
REM
REM Layout produccion:
REM   %~dp0nssm.exe                       <- NSSM 2.24 win64
REM   %~dp0..\bin\start-osm-mcp.cmd    <- launcher OSM-MCP
REM   %~dp0..\bin\start-markitdown-api.cmd <- launcher MarkItDown
REM   %~dp0..\bin\start-mcp-v11-local.cmd  <- launcher MCP-V11-Local
REM
REM Logs:
REM   %PROGRAMDATA%\LetXinet Suite\Logs\osm-mcp.stdout.log
REM   %PROGRAMDATA%\LetXinet Suite\Logs\osm-mcp.stderr.log
REM   ... (uno por servicio)
REM
REM LetXinet Desktop NO es un servicio (es Electron GUI).
REM
REM Idempotente: si el servicio ya existe, lo reconfigura en lugar de fallar.

setlocal enableextensions

set "NSSM=%~dp0bin\nssm.exe"
if not exist "%NSSM%" set "NSSM=%~dp0..\bin\nssm.exe"
if not exist "%NSSM%" (
    echo [register-services] ERROR: nssm.exe no encontrado
    exit /b 1
)

set "SUITE_BIN=%~dp0bin"
if not exist "%SUITE_BIN%" set "SUITE_BIN=%~dp0..\bin"
set "SUITE_LOG=%PROGRAMDATA%\LetXinet Suite\Logs"
if not exist "%SUITE_LOG%" mkdir "%SUITE_LOG%"

REM --- Convertir SUITE_BIN a ruta corta 8.3 sin espacios (legacy, ya no usado) ---
REM La solucion actual usa wrappers run-*.cmd en raiz del Suite sin subcarpeta
REM bin para evitar paths con espacios en AppParameters de NSSM.

REM --- Apagar y eliminar servicios existentes (idempotencia) ---
REM Nota: sc query devuelve 0 si existe. nssm remove falla si no existe. Manejamos ambos casos.

echo.
echo [register-services] Limpiando servicios previos si existen...

for %%S in (LetXinetSuiteOSMMCP LetXinetSuiteMarkitDown LetXinetSuiteMCPV11) do (
    sc query %%S >nul 2>&1 && (
        "%NSSM%" stop %%S >nul 2>&1
        "%NSSM%" remove %%S confirm >nul 2>&1
    )
)

REM Timeout: dejar que el SCM libere el nombre antes de re-registrar
timeout /t 2 /nobreak >nul

REM --- 1) LetXinetSuiteOSMMCP ---
REM Servicio: binario Go que expone MCP en http://127.0.0.1:7082 (HTTP+SSE).
REM Tipo: own process, auto-start (lento), restart on failure.

echo [register-services] Registrando LetXinetSuiteOSMMCP...
"%NSSM%" install LetXinetSuiteOSMMCP "%COMSPEC%" /c run-osm.cmd
"%NSSM%" set LetXinetSuiteOSMMCP AppDirectory "%~dp0."
"%NSSM%" set LetXinetSuiteOSMMCP AppStdout "%SUITE_LOG%\osm-mcp.stdout.log"
"%NSSM%" set LetXinetSuiteOSMMCP AppStderr "%SUITE_LOG%\osm-mcp.stderr.log"
"%NSSM%" set LetXinetSuiteOSMMCP AppRotateFiles 1
"%NSSM%" set LetXinetSuiteOSMMCP AppRotateOnline 1
"%NSSM%" set LetXinetSuiteOSMMCP AppRotateBytes 5242880
"%NSSM%" set LetXinetSuiteOSMMCP AppExit Default Restart
"%NSSM%" set LetXinetSuiteOSMMCP Start SERVICE_AUTO_START
"%NSSM%" set LetXinetSuiteOSMMCP Description "LetXinet Suite - OSM-MCP (OpenStreetMap MCP en puerto 7082)"
"%NSSM%" set LetXinetSuiteOSMMCP DisplayName "LetXinet Suite - OSM-MCP"

REM --- 2) LetXinetSuiteMarkitDown ---
REM Servicio: FastAPI + uvicorn en http://127.0.0.1:7860.
REM Tipo: own process, auto-start, restart on failure.

echo [register-services] Registrando LetXinetSuiteMarkitDown...
"%NSSM%" install LetXinetSuiteMarkitDown "%COMSPEC%" /c run-md.cmd
"%NSSM%" set LetXinetSuiteMarkitDown AppDirectory "%~dp0."
"%NSSM%" set LetXinetSuiteMarkitDown AppStdout "%SUITE_LOG%\markitdown-api.stdout.log"
"%NSSM%" set LetXinetSuiteMarkitDown AppStderr "%SUITE_LOG%\markitdown-api.stderr.log"
"%NSSM%" set LetXinetSuiteMarkitDown AppRotateFiles 1
"%NSSM%" set LetXinetSuiteMarkitDown AppRotateOnline 1
"%NSSM%" set LetXinetSuiteMarkitDown AppRotateBytes 5242880
"%NSSM%" set LetXinetSuiteMarkitDown AppExit Default Restart
"%NSSM%" set LetXinetSuiteMarkitDown Start SERVICE_AUTO_START
"%NSSM%" set LetXinetSuiteMarkitDown Description "LetXinet Suite - MarkItDown API (motor PyMuPDF4LLM en puerto 7860)"
"%NSSM%" set LetXinetSuiteMarkitDown DisplayName "LetXinet Suite - MarkItDown API"

REM --- 3) LetXinetSuiteMCPV11 ---
REM Servicio: MCP-V11-Local (Node pkg) en http://127.0.0.1:4003.
REM El sidecar spaCy lo lanza internamente el binario via child_process cuando
REM llega el primer request; NSSM no lo gestiona.
REM Tipo: own process, auto-start con delay (necesita MarkItDown API arriba para
REM       probe sin bloqueo), restart on failure.

echo [register-services] Registrando LetXinetSuiteMCPV11...
"%NSSM%" install LetXinetSuiteMCPV11 "%COMSPEC%" /c run-v11.cmd
"%NSSM%" set LetXinetSuiteMCPV11 AppDirectory "%~dp0."
"%NSSM%" set LetXinetSuiteMCPV11 AppStdout "%SUITE_LOG%\mcp-v11-local.stdout.log"
"%NSSM%" set LetXinetSuiteMCPV11 AppStderr "%SUITE_LOG%\mcp-v11-local.stderr.log"
"%NSSM%" set LetXinetSuiteMCPV11 AppRotateFiles 1
"%NSSM%" set LetXinetSuiteMCPV11 AppRotateOnline 1
"%NSSM%" set LetXinetSuiteMCPV11 AppRotateBytes 5242880
"%NSSM%" set LetXinetSuiteMCPV11 AppExit Default Restart
REM Delayed auto-start: arranque cuando otros servicios esten estables. Quiero
REM que MarkItDown este listo cuando V11 levante (V11 probe lista en bootstrap).
"%NSSM%" set LetXinetSuiteMCPV11 Start SERVICE_DELAYED_AUTO_START
"%NSSM%" set LetXinetSuiteMCPV11 Description "LetXinet Suite - MCP-V11-Local (busqueda academica + spaCy sidecar en puerto 4003)"
"%NSSM%" set LetXinetSuiteMCPV11 DisplayName "LetXinet Suite - MCP-V11-Local"

REM --- Iniciar los 3 servicios ---
echo.
echo [register-services] Iniciando servicios...
"%NSSM%" start LetXinetSuiteOSMMCP
"%NSSM%" start LetXinetSuiteMarkitDown
REM Delay 5s antes de iniciar V11 para que MarkItDown este disponible
timeout /t 5 /nobreak >nul
"%NSSM%" start LetXinetSuiteMCPV11

echo.
echo [register-services] OK - 3 servicios registrados e iniciados.
exit /b 0
