@echo off
REM run-md.cmd - Thin wrapper en raiz del Suite (sin subcarpeta bin).
REM NSSM lo lanza con AppParameters=/c run-md.cmd (sin path, sin espacios).
REM Invoca bin\start-markitdown-api.cmd que hace el setup real.

setlocal enableextensions
set "INSTALL_DIR=%~dp0"
set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
call "%INSTALL_DIR%\bin\start-markitdown-api.cmd"
exit /b %ERRORLEVEL%
