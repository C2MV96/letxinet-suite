@echo off
REM start-markitdown-api.cmd - arranque de MarkItDown API local (PyMuPDF4LLM).
REM Puerto default 7860. El MCP-V11-Local lo consume via MARKITDOWN_API_URL.

setlocal
set API_DIR=%~dp0
set API_DIR=%API_DIR:~0,-1%

set PYTHON_EXE=%API_DIR%\.venv\Scripts\python.exe
if not exist "%PYTHON_EXE%" set PYTHON_EXE=python.exe

if "%MARKITDOWN_API_PORT%"=="" set MARKITDOWN_API_PORT=7860

echo [MarkItDown-API] Starting on port %MARKITDOWN_API_PORT% ...
"%PYTHON_EXE%" -m uvicorn app:app --host 127.0.0.1 --port %MARKITDOWN_API_PORT% --app-dir "%API_DIR%"
