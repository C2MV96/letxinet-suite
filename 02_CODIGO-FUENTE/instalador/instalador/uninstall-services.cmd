@echo off
REM uninstall-services.cmd - Detiene y elimina los 3 servicios del LetXinet Suite.
REM
REM Invocado por Inno Setup en [UninstallRun] ANTES de borrar archivos.
REM Requiere admin.

setlocal enableextensions

set "NSSM=%~dp0bin\nssm.exe"
if not exist "%NSSM%" set "NSSM=%~dp0..\bin\nssm.exe"

REM --- Matar el Electron app si esta corriendo ---
REM (no es servicio, pero bloquedaría la desinstalacion de DLLs Electron)
taskkill /F /IM "Letxipu Desktop HF.exe" >nul 2>&1
timeout /t 1 /nobreak >nul

REM --- Detener y remover servicios en orden inverso:
REM 1) V11 primero (depende de MarkItDown y spaCy)
REM 2) MarkItDown
REM 3) OSM-MCP
echo [uninstall-services] Deteniendo y eliminando servicios...

for %%S in (LetXinetSuiteMCPV11 LetXinetSuiteMarkitDown LetXinetSuiteOSMMCP) do (
    sc query %%S >nul 2>&1 && (
        "%NSSM%" stop %%S >nul 2>&1
        timeout /t 1 /nobreak >nul
        "%NSSM%" remove %%S confirm >nul 2>&1
        echo   - %%S: detenido y removido
    ) || echo   - %%S: no estaba registrado
)

echo [uninstall-services] OK - 3 servicios eliminados.
exit /b 0
