@echo off
REM Recompila LetXinet Suite desde estas fuentes y genera el instalador. Ver LEEME-RECOMPILAR.md
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0recompilar-todo.ps1" %*
echo.
pause
