@echo off
rem Pool de harnesses de LetXinet Suite: todas las pruebas en paralelo y el informe al final.
rem Uso: ejecutar-pool.cmd [h02 h04 ...] [--sin-comparativo]
where node >nul 2>nul || (echo Falta Node.js. Instala LetXinet Suite 1.1.2, que lo incluye. & pause & exit /b 1)
node "%~dp0ejecutar-pool.cjs" %*
pause
