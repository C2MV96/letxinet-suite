@echo off
rem LetXinet Suite - arreglo 2: MarkItDown en laptops con procesador antiguo (numpy).
rem Pide permisos de administrador y deja un resumen en el Escritorio.
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0arreglar-markitdown.ps1"
echo.
pause
