@echo off
REM Configura LetXinet Suite en Claude Code, Claude Desktop y OpenCode (usuario actual, sin administrador).
REM Opciones: --modo separados^|juntos^|ambos  --clientes claude-code,claude-desktop,opencode  --silencioso
where node >nul 2>nul || (echo Falta Node.js. Instala Node.js LTS y vuelve a intentarlo. & pause & exit /b 1)
node "%~dp0configurar-clientes.cjs" %*
