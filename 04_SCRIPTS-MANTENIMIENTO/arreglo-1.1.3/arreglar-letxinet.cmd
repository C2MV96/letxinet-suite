@echo off
rem LetXinet Suite 1.1.3 - arregla MarkItDown (puerto 7860) y el arranque de LetXipu Desktop HF.
rem Pide permisos de administrador y deja un resumen en el Escritorio.
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0arreglar-letxinet.ps1"
echo.
pause
