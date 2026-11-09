@echo off
REM ============================================================
REM  start-osm-mcp.cmd  -  Launcher OSM MCP Server (HTTP+SSE)
REM ------------------------------------------------------------
REM  Inicia osmmcp.exe en modo HTTP-only, escuchando en
REM  127.0.0.1:7082/mcp  (compatible con LetXipu Desktop HF).
REM
REM  Endpoint expuesto:    http://127.0.0.1:7082/mcp
REM  Monitoring (Prometheus): http://127.0.0.1:9090/metrics
REM
REM  Si LetXipu Desktop HF esta corriendo con la variable de
REM  entorno LETXIPU_OSM_MCP_URL=http://127.0.0.1:7082/mcp,
REM  el gateway usara OSM local en vez del HF Space remoto.
REM
REM  Presiona Ctrl+C para detener el servidor.
REM ============================================================

setlocal

REM --- Ruta absoluta al ejecutable (junto a este .cmd) ---
set "OSM_EXE=%~dp0osmmcp.exe"

if not exist "%OSM_EXE%" (
  echo [ERROR] No se encuentra: %OSM_EXE%
  echo         Reinstala OSM-MCP o copia osmmcp.exe junto a este launcher.
  timeout /t 5 /nobreak >nul
  exit /b 1
)

echo.
echo === OSM MCP Server (local) ===
echo Binario:      %OSM_EXE%
echo Endpoint:     http://127.0.0.1:7082/mcp
echo Monitoring:   http://127.0.0.1:9090/metrics
echo.
echo Iniciando servidor...
echo (Logs de OSM API: Nominatim, Overpass, OSRM)
echo.
echo ----------------------------------------------------------
echo IMPORTANTE - Para que LetXipu Desktop HF use este OSM local:
echo ----------------------------------------------------------
echo Antes de abrir LetXipu Desktop, define esta variable de
echo entorno a nivel de usuario (solo una vez, persistente):
echo.
echo   setx LETXIPU_OSM_MCP_URL "http://127.0.0.1:7082/mcp"
echo.
echo Pasos:
echo   1. Win+R -^> cmd
echo   2. Pega:  setx LETXIPU_OSM_MCP_URL "http://127.0.0.1:7082/mcp"
echo   3. Cierra y reabre LetXipu Desktop HF
echo.
echo Si prefieres seguir usando el OSM remoto (HF Space),
echo NO definas esta variable. LetXipu Desktop usara el remoto.
echo ----------------------------------------------------------
echo.

"%OSM_EXE%" ^
  -enable-http ^
  -http-only ^
  -http-addr 127.0.0.1:7082 ^
  -enable-monitoring ^
  -monitoring-addr 127.0.0.1:9090

endlocal
