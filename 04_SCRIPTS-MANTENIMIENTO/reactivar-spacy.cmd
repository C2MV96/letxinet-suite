@echo off
REM Reactiva spaCy en LetXinet V11 (borra el interruptor y reinicia el servicio). Pide permisos de administrador.
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
del /q "C:\Program Files\LetXinet Suite\MCP-V11-Local\SPACY_DISABLED" 2>nul
powershell -NoProfile -Command "Restart-Service LetXinetSuiteMCPV11 -Force; Start-Sleep 8; Get-Service LetXinetSuiteMCPV11"
echo spaCy reactivado.
pause
