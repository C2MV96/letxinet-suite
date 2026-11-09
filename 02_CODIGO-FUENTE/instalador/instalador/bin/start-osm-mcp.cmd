@echo off
REM start-osm-mcp.cmd - Launcher del servicio OSM-MCP (Go binario, FastMCP en puerto 7082).
REM
REM Ejecutado por NSSM (LetXinetSuiteOSMMCP service) o a mano para tests.
REM
REM Layout produccion:
REM   {app}\OSM-MCP\osmmcp.exe          <- binario
REM   {app}\bin\suite-env-loader.cmd     <- carga LetXinet-Suite.env
REM   %PROGRAMDATA%\LetXinet Suite\Logs\ <- log centralizado
REM
REM Las variables OSM_MCP_PORT, OSM_USER_AGENT, NOMINATIM_URL, OVERPASS_URL,
REM OSRM_URL, OSRM_URL_CAR/BIKE/FOOT, TILE_SERVER_URL vienen del .env cargado.

setlocal enableextensions

REM --- Fijar INSTALL_DIR relativo al launcher ---
set "INSTALL_DIR=%~dp0.."
pushd "%INSTALL_DIR%" >nul 2>&1
set "INSTALL_DIR=%CD%"
popd >nul 2>&1

REM --- Log dir centralizado ---
if not defined SUITE_LOG_DIR set "SUITE_LOG_DIR=%PROGRAMDATA%\LetXinet Suite\Logs"
if not exist "%SUITE_LOG_DIR%" mkdir "%SUITE_LOG_DIR%"

REM --- Load .env (setea OSM_MCP_PORT, etc.) ---
set "SUITE_ENV_PATH=%PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env"
if not exist "%SUITE_ENV_PATH%" set "SUITE_ENV_PATH=%INSTALL_DIR%\shared-env\LetXinet-Suite.env"
call "%INSTALL_DIR%\bin\suite-env-loader.cmd"

REM --- Defaults si el .env no las define ---
if not defined OSM_MCP_PORT set "OSM_MCP_PORT=7082"
if not defined OSM_METRICS_PORT set "OSM_METRICS_PORT=9090"
if not defined OSM_USER_AGENT set "OSM_USER_AGENT=LetXinet-Suite/1.1.4"
REM LetXinet Suite 1.1.2: solo escucha en este equipo (para la red local: LETXINET_BIND_HOST=0.0.0.0)
if not defined LETXINET_BIND_HOST set "LETXINET_BIND_HOST=127.0.0.1"

REM --- Ejecutar el binario ---
REM El osmmcp.exe lee las vars NOMINATIM_URL, OVERPASS_URL, etc. del entorno
REM (heredado del proceso). El binario expone el servicio MCP sobre HTTP+SSE en
REM -http-addr (necesario para que NSSM mantenga el proceso) y Prometheus en
REM -monitoring-addr. El modo stdio nativo no funciona como servicio Windows
REM porque NSSM requiere un proceso "estable" que escuche en un socket.
REM Por defecto osmmcp habilita monitoring (:9090) y el MCP cliente stdio.
REM Activamos HTTP+SSE en :{OSM_MCP_PORT} y lo corremos en -http-only (sin leer
REM stdin, que NSSM inutiliza).

cd /d "%INSTALL_DIR%\OSM-MCP"
"%INSTALL_DIR%\OSM-MCP\osmmcp.exe" ^
    -enable-http ^
    -http-only ^
    -http-addr "%LETXINET_BIND_HOST%:%OSM_MCP_PORT%" ^
    -monitoring-addr "%LETXINET_BIND_HOST%:%OSM_METRICS_PORT%" ^
    -user-agent "%OSM_USER_AGENT%"

REM Si NSSM reinicia: el exit code se pasa a NSSM que decide.
exit /b %ERRORLEVEL%
