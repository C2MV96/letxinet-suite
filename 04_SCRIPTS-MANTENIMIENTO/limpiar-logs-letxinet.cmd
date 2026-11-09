@echo off
REM Borra los logs rotados de LetXinet Suite y las copias .env.backup.
REM Ya estan respaldados en C:\Users\USER\LetXinet-archivo\*.zip
REM No toca los logs activos (mcp-v11-local.stdout.log, osm-mcp.stderr.log, etc.).

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Pidiendo permisos de administrador...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

set "LOGS=C:\ProgramData\LetXinet Suite\Logs"
echo Borrando logs rotados y copias .env en "%LOGS%" ...
del /q "%LOGS%\mcp-v11-local.stdout-*.log"
del /q "%LOGS%\osm-mcp.stderr-*.log"
del /q "%LOGS%\LetXinet-Suite.env.backup-*.txt"
echo.
echo Listo. Archivos que quedan:
dir /b "%LOGS%"
echo.
pause
