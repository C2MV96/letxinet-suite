@echo off
REM start-markitdown-api.cmd - Launcher del servicio MarkItDown API (FastAPI + uvicorn).
REM
REM Ejecutado por NSSM (LetXinetSuiteMarkitDown service) o a mano para tests.
REM
REM Layout produccion:
REM   {app}\MarkItDown\API\app.py          <- codigo FastAPI
REM   {app}\MarkItDown\API\python-runtime\ <- Python 3.12 embed + 5 deps
REM   {app}\bin\suite-env-loader.cmd       <- carga LetXinet-Suite.env

setlocal enableextensions

set "INSTALL_DIR=%~dp0.."
pushd "%INSTALL_DIR%" >nul 2>&1
set "INSTALL_DIR=%CD%"
popd >nul 2>&1

if not defined SUITE_LOG_DIR set "SUITE_LOG_DIR=%PROGRAMDATA%\LetXinet Suite\Logs"
if not exist "%SUITE_LOG_DIR%" mkdir "%SUITE_LOG_DIR%"

REM --- Load .env ---
set "SUITE_ENV_PATH=%PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env"
if not exist "%SUITE_ENV_PATH%" set "SUITE_ENV_PATH=%INSTALL_DIR%\shared-env\LetXinet-Suite.env"
call "%INSTALL_DIR%\bin\suite-env-loader.cmd"

if not defined MARKITDOWN_API_PORT set "MARKITDOWN_API_PORT=7860"

set "API_DIR=%INSTALL_DIR%\MarkItDown\API"
set "PYTHON_EXE=%API_DIR%\python-runtime\python.exe"

if not exist "%PYTHON_EXE%" (
    echo [start-markitdown-api] ERROR: python-runtime no encontrado en %API_DIR%
    exit /b 1
)

cd /d "%API_DIR%"
"%PYTHON_EXE%" -m uvicorn app:app --host 127.0.0.1 --port %MARKITDOWN_API_PORT% --app-dir "%API_DIR%"

exit /b %ERRORLEVEL%
