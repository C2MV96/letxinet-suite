@echo off
REM restart-suite.cmd - Helper elevado para reiniciar los 3 servicios NSSM del Suite.
REM
REM Lanzado por Desktop HF (POST /api/keys/restart-services) via Start-Process -Verb RunAs
REM cuando detecta "Acceso denegado" en NSSM restart. Aparece un UAC prompt al operador.
REM
REM Idempotente: simplemente restart los 3 servicios. Si no existen, lo salta con mensaje.

setlocal enableextensions

set "NSSM=%~dp0bin\nssm.exe"
if not exist "%NSSM%" set "NSSM=%~dp0..\bin\nssm.exe"

if not exist "%NSSM%" (
    echo ERROR: nssm.exe no encontrado
    pause
    exit /b 1
)

REM Log pequenio en ProgramData
set "LOG=%PROGRAMDATA%\LetXinet Suite\Logs\restart-suite.log"
if not exist "%PROGRAMDATA%\LetXinet Suite\Logs" mkdir "%PROGRAMDATA%\LetXinet Suite\Logs"
echo. >> "%LOG%"
echo === restart-suite.cmd %date% %time% === >> "%LOG%"

for %%S in (LetXinetSuiteMCPV11 LetXinetSuiteMarkitDown LetXinetSuiteOSMMCP) do (
    sc query %%S >nul 2>&1 && (
        echo [%time%] Restarting %%S... >> "%LOG%"
        "%NSSM%" restart %%S >> "%LOG%" 2>&1
        echo [%time%] %%S exit=%errorlevel% >> "%LOG%"
    ) || (
        echo [%time%] %%S no registrado, skip >> "%LOG%"
    )
)

echo [%time%] Done. >> "%LOG%"
REM Sin pause: el UAC cerro la ventana al salir
exit /b 0
