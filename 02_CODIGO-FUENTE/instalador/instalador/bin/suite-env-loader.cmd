@echo off
REM suite-env-loader.cmd - Carga variables de LetXinet-Suite.env en el proceso actual.
REM
REM Uso:   call "%%PROGRAMDATA%%\LetXinet Suite\bin\suite-env-loader.cmd"
REM
REM Ubicacion de LetXinet-Suite.env (primer match gana):
REM   1. %PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env   (layout produccion)
REM   2. %~dp0..\..\shared-env\LetXinet-Suite.env          (layout dev/compilacion)
REM   3. %~dp0..\LetXinet-Suite.env                        (fallback)
REM
REM Reglas:
REM   - Lineas vacias o que empiecen con # son ignoradas.
REM   - Soporta KEY=VALUE y KEY="VALUE con espacios".
REM   - Si VALUE empieza y termina con comillas dobles, se conservan las comillas
REM     intactas (no se strip). Esto es importante para paths con espacios.
REM
REM Estrategia: Napoleon Hondura. Cada var se setea con `call set "!K!=!V!"` para
REM propagarla fuera del for-scope (que tiene su propio delayed expansion).

if not defined SUITE_ENV_PATH set "SUITE_ENV_PATH=%PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env"
if not exist "%SUITE_ENV_PATH%" set "SUITE_ENV_PATH=%~dp0..\..\shared-env\LetXinet-Suite.env"
if not exist "%SUITE_ENV_PATH%" set "SUITE_ENV_PATH=%~dp0..\LetXinet-Suite.env"
if not exist "%SUITE_ENV_PATH%" (
    echo [suite-env-loader] WARN LetXinet-Suite.env no encontrado
    exit /b 0
)

REM setlocal solo en el bloque del for para evitar contaminar vars ya definidas
REM antes de exit /b. NOTA: usamos FOR /F con backquote y tokens=* para capturar
REM toda la linea, no delims para evitar truncamiento en simbolos.
REM Importante: tokens=1,* asigna el primer token a %%K y el resto a la SIGUIENTE
REM letra del alfabeto: %%L (NO %%V).
for /f "usebackq eol=# tokens=1,* delims==" %%K in ("%SUITE_ENV_PATH%") do (
    set "%%K=%%L"
)

exit /b 0
