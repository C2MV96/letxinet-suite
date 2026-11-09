@echo off
REM LetXipu Search MCP v10 startup script
REM CRITICAL: must cd to project dir so dotenv.config() loads .env
REM (otherwise MARKITDOWN_PYTHON, MINERU_API_KEY, etc. are not seeded).

cd /d D:\OTROS\LETXIPU-SEARCH-MCP-V10

set PORT=4000
set LETXIPU_LOG_LEVEL=info
set SPACY_PORT=4002

REM Inherit env from .env (defensive — dotenv will also load it in-process)
for /f "usebackq tokens=1,* delims==" %%a in (`type .env 2^>nul ^| findstr /v "^#" ^| findstr /v "^$"`) do (
    if not defined %%a set "%%a=%%b"
)

start "letxipu-v10" /MIN node D:\OTROS\LETXIPU-SEARCH-MCP-V10\dist\server.js > D:\OTROS\LETXIPU-SEARCH-MCP-V10\rein_out.log 2>&1
