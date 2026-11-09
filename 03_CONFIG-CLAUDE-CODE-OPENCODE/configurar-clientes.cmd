@echo off
REM Configura LetXinet Suite 1.1.2 en Claude Code, Claude Desktop y OpenCode (usuario actual, sin administrador).
REM Usa el configurador instalado con la Suite. Opciones: --modo separados^|juntos^|ambos  --clientes claude-code,claude-desktop,opencode
set "CFG=%ProgramFiles%\LetXinet Suite\bin\configurar-clientes.cjs"
if not exist "%CFG%" (echo No se encuentra LetXinet Suite 1.1.2 instalada en "%ProgramFiles%\LetXinet Suite". & pause & exit /b 1)
where node >nul 2>nul || (echo Falta Node.js. El instalador de la Suite 1.1.2 lo instala; reinicia la sesion o instalalo. & pause & exit /b 1)
node "%CFG%" %*
