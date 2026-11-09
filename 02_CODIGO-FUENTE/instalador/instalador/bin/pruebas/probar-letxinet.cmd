@echo off
REM Harness de pruebas de LetXinet Suite. Deja el informe en el Escritorio. Opciones: -Rapido, -Comparar informe.json
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0probar-letxinet.ps1" %*
echo.
pause
