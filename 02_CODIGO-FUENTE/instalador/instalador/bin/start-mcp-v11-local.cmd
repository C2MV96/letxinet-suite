@echo off
REM start-mcp-v11-local.cmd - Launcher del servicio MCP-V11-Local (Node pkg + sidecar spaCy).
REM
REM Ejecutado por NSSM (LetXinetSuiteMCPV11 service) o a mano para tests.
REM
REM Layout produccion:
REM   {app}\MCP-V11-Local\MCP-V11-Local.exe       <- binario Node pkg node22
REM   {app}\MCP-V11-Local\dist\server.js            <- codigo TS compilado (pkg embebe el dist pero server.js sigue ahi por dotenv)
REM   {app}\MCP-V11-Local\python\spacy_server.py   <- sidecar Flask
REM   {app}\MCP-V11-Local\python-runtime\          <- Python embed + spaCy + numpy + modelos sm
REM   {app}\MCP-V11-Local\.env                      <- dotenv V11 (variante A o B segun build)
REM   {app}\bin\suite-env-loader.cmd                <- carga LetXinet-Suite.env
REM
REM Variables (todas overridables por LetXinet-Suite.env):
REM   PORT                  - puerto MCP Node (default 4003)
REM   SPACY_PORT            - puerto sidecar Flask (default 4002)
REM   SPACY_PYTHON          - override del python.exe (default %INSTALL_DIR%\python-runtime\python.exe)
REM   SPACY_SCRIPT          - override del spacy_server.py
REM   SPACY_CACHE_ROOT      - override de los modelos spaCy (default %INSTALL_DIR%\python-runtime\Lib\site-packages)
REM   LETXIPU_DESKTOP_GATEWAY=true
REM   MARKITDOWN_API_URL    - URL del MarkItDown API (consumido por V11 para PDFs)
REM   SCIHUB_MIRRORS, UNPAYWALL_BASE_URL, UNPAYWALL_EMAIL, DOI_RESOLVER_URL
REM   GOOGLE_API_KEY, MISTRAL_API_KEY, SERPAPI_KEY (solo variante A)

setlocal enableextensions

set "INSTALL_DIR=%~dp0.."
pushd "%INSTALL_DIR%" >nul 2>&1
set "INSTALL_DIR=%CD%"
popd >nul 2>&1

if not defined SUITE_LOG_DIR set "SUITE_LOG_DIR=%PROGRAMDATA%\LetXinet Suite\Logs"
if not exist "%SUITE_LOG_DIR%" mkdir "%SUITE_LOG_DIR%"

REM --- Load .env del Suite ---
set "SUITE_ENV_PATH=%PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env"
if not exist "%SUITE_ENV_PATH%" set "SUITE_ENV_PATH=%INSTALL_DIR%\shared-env\LetXinet-Suite.env"
call "%INSTALL_DIR%\bin\suite-env-loader.cmd"

REM --- Defaults ---
set "NODE_EXE=%INSTALL_DIR%\MCP-V11-Local\MCP-V11-Local.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node.exe"

set "PYTHON_EXE=%INSTALL_DIR%\MCP-V11-Local\python-runtime\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python.exe"

set "SPACY_SCRIPT=%INSTALL_DIR%\MCP-V11-Local\python\spacy_server.py"
REM Interruptor (01/11/2026): si existe MCP-V11-Local\SPACY_DISABLED no arranca el sidecar spaCy;
REM V11 trabaja en modo JSON-only. Para reactivarlo, borra ese archivo y reinicia el servicio.
if exist "%INSTALL_DIR%\MCP-V11-Local\SPACY_DISABLED" set "SPACY_SCRIPT=%INSTALL_DIR%\MCP-V11-Local\python\__spacy_desactivado__.py"
set "SPACY_CACHE_ROOT=%INSTALL_DIR%\MCP-V11-Local\python-runtime\Lib\site-packages"
set "SPACY_PYTHON=%PYTHON_EXE%"
if not defined SPACY_PORT set "SPACY_PORT=4002"
if not defined PORT set "PORT=4003"
if not defined LETXIPU_DESKTOP_GATEWAY set "LETXIPU_DESKTOP_GATEWAY=true"
if not defined MARKITDOWN_API_URL set "MARKITDOWN_API_URL=http://127.0.0.1:7860"

REM --- cd a {app}\MCP-V11-Local\ para que dotenv.config() encuentre .env ---
cd /d "%INSTALL_DIR%\MCP-V11-Local"

"%NODE_EXE%" "%INSTALL_DIR%\MCP-V11-Local\dist\server.js"

exit /b %ERRORLEVEL%
