@echo off
REM start-mcp-local.cmd ? arranque del MCP V11 Local en modo portable.
REM
REM Variables de entorno (todas opcionales ? el gateway Electron las rellena):
REM   PORT                 ? puerto del MCP (default 4003)
REM   SPACY_PORT           ? puerto python sidecar (default 4002)
REM   SPACY_PYTHON         ? path al python.exe embebido
REM   SPACY_SCRIPT         ? path a spacy_server.py
REM   SPACY_CACHE_ROOT     ? root de los modelos spaCy (es_core_news_sm etc.)
REM   LETXIPU_DESKTOP_GATEWAY=true
REM   GOOGLE_API_KEY / MISTRAL_API_KEY / SERPAPI_KEY

setlocal

set INSTALL_DIR=%~dp0
set INSTALL_DIR=%INSTALL_DIR:~0,-1%

set NODE_EXE=%INSTALL_DIR%\MCP-V11-Local.exe

set PYTHON_EXE=%INSTALL_DIR%\python-embedded\python.exe
if not exist "%PYTHON_EXE%" set PYTHON_EXE=python.exe

set SPACY_SCRIPT=%INSTALL_DIR%\python\spacy_server.py
set SPACY_CACHE_ROOT=%INSTALL_DIR%\python\models

set SPACY_PYTHON=%PYTHON_EXE%
set SPACY_PORT=4002
set LETXIPU_DESKTOP_GATEWAY=true
if "%PORT%"=="" set PORT=4003
if "%MARKITDOWN_API_URL%"=="" set MARKITDOWN_API_URL=http://127.0.0.1:7860

REM C11 fix: cd al install dir para que dotenv.config() encuentre .env
cd /d "%INSTALL_DIR%"

REM Arrancar MCP V11 (el .exe es un Node bundle via pkg)
"%NODE_EXE%" "%INSTALL_DIR%\dist\server.js"
