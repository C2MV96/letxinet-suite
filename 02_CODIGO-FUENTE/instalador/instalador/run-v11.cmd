@echo off
REM run-v11.cmd - Thin wrapper en raiz del Suite (sin subcarpeta bin).
REM NSSM lo lanza con AppParameters=/c run-v11.cmd (sin path, sin espacios).
REM Invoca bin\start-mcp-v11-local.cmd que hace el setup real (env loader, defaults).

setlocal enableextensions
set "INSTALL_DIR=%~dp0"
set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
call "%INSTALL_DIR%\bin\start-mcp-v11-local.cmd"
exit /b %ERRORLEVEL%
