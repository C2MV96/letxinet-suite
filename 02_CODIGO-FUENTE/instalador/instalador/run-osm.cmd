@echo off
REM run-osm.cmd - Thin wrapper en raiz del Suite (sin subcarpeta bin).
REM NSSM lo lanza con AppParameters=/c run-osm.cmd (sin path, sin espacios).
REM Invoca bin\start-osm-mcp.cmd que hace el setup real (env loader, defaults, etc.).

setlocal enableextensions
set "INSTALL_DIR=%~dp0"
set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
call "%INSTALL_DIR%\bin\start-osm-mcp.cmd"
exit /b %ERRORLEVEL%
