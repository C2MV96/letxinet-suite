@echo off
REM start-letxinet-desktop.cmd - Launcher de la app Electron LetXipu Desktop HF.
REM
REM Esta NO es un servicio NSSM. Es una aplicacion de GUI lanzada por shortcut
REM del menu inicio o por el usuario. Carga LetXinet-Suite.env para que main.cjs
REM herede las variables (DESKTOP_ENDPOINT_MODE, LETXIPU_*_URL, etc.).
REM
REM v1.1.0 Dual Build integracion:
REM   - BUILD_VARIANT define comportamiemto del server.cjs y main.cjs en runtime
REM   - VariantA del installer lo setea en "private" (URLs HF fallback activas,
REM     seedSecretsFromBundle intenta copiar resources/secrets.json)
REM   - VariantB del installer lo setea en "public" (no fallbacks HF, modo
REM     local_only por defecto, sin secrets.json en bundle)
REM   - Default si no esta en .env: "private" (back-compat con v1.0.1)
REM
REM Layout produccion:
REM   {app}\LetXinet-Desktop\LetXipu Desktop HF.exe  <- Electron bundle
REM   {app}\LetXinet-Desktop\resources\secrets.json  <- solo VariantA

setlocal enableextensions

set "INSTALL_DIR=%~dp0.."
pushd "%INSTALL_DIR%" >nul 2>&1
set "INSTALL_DIR=%CD%"
popd >nul 2>&1

if not defined SUITE_LOG_DIR set "SUITE_LOG_DIR=%PROGRAMDATA%\LetXinet Suite\Logs"
if not exist "%SUITE_LOG_DIR%" mkdir "%SUITE_LOG_DIR%"

REM --- Load .env del Suite (las vars quedan en process.env del cmd y
REM     electron hereda el entorno) ---
set "SUITE_ENV_PATH=%PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env"
if not exist "%SUITE_ENV_PATH%" set "SUITE_ENV_PATH=%INSTALL_DIR%\shared-env\LetXinet-Suite.env"
call "%INSTALL_DIR%\bin\suite-env-loader.cmd"

REM --- Defaults si el .env no las define ---
if not defined DESKTOP_PORT set "DESKTOP_PORT=43123"
if not defined DESKTOP_ENDPOINT_MODE set "DESKTOP_ENDPOINT_MODE=auto"
REM v1.1.0: BUILD_VARIANT define dual-build behavior (private default)
REM VariantA installer setea BUILD_VARIANT=private en Suite.env
REM VariantB installer setea BUILD_VARIANT=public en Suite.env
REM Si el usuario no define nada: default private (back-compat v1.0.1)
if not defined BUILD_VARIANT set "BUILD_VARIANT=private"

REM --- Lanzar Electron app (no hiere: GUI app no bloquea launcher) ---
REM Electron hereda process.env del cmd, main.cjs lee BUILD_VARIANT y
REM process.env.BUILD_VARIANT llega al server.cjs (child process) tambien.
start "" "%INSTALL_DIR%\LetXinet-Desktop\LetXipu Desktop HF.exe"

exit /b 0
