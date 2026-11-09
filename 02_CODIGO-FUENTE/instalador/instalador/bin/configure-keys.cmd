@echo off
REM ============================================================================
REM configure-keys.cmd - Configura las API keys del LetXinet Suite (variante B).
REM
REM Pregunta interactiva las claves mas usadas y las parchea en:
REM   %PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env
REM Preservando el resto del archivo (comentarios, otras keys).
REM Despues reinicia los 3 servicios NSSM y hace healthchecks.
REM
REM Uso:
REM   Doble-click en el atajo "Menu Inicio > LetXinet Suite > Configurar API keys"
REM   O desde cmd elevado:
REM     "%PROGRAMFILES%\LetXinet Suite\bin\configure-keys.cmd"
REM
REQUIRES admin (auto-eleva UAC si no lo es).
REM ============================================================================

setlocal EnableDelayedExpansion

REM --- 0. Auto-elevacion admin (UAC) ---
net session >nul 2>&1
if errorlevel 1 (
    echo [configure-keys] Se requieren permisos de administrador. Solicitando UAC...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

REM --- 1. Rutas y verificaciones ---
set "ENV_FILE=%PROGRAMDATA%\LetXinet Suite\LetXinet-Suite.env"
set "SUITE_BIN=%PROGRAMFILES%\LetXinet Suite\bin"
set "NSSM=%SUITE_BIN%\nssm.exe"

if not exist "%ENV_FILE%" (
    echo [configure-keys] ERROR: No se encontro "%ENV_FILE%"
    echo [configure-keys]        Instala primero LetXinet Suite v1.0.
    pause
    exit /b 1
)
if not exist "%NSSM%" (
    echo [configure-keys] ERROR: No se encontro "%NSSM%"
    echo [configure-keys]        Instala primero LetXinet Suite v1.0.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   LetXinet Suite - Configurador de API keys (Variante B)
echo ============================================================
echo.
echo Pide las claves mas usadas. Para cada una:
echo   - Enter vacio = mantener valor actual
echo   - 'borrar'    = vaciar la key (deja la variable sin valor)
echo   - 'salir'     = aborta ahora (lo guardado hasta ahi se mantiene)
echo.
echo Editara: "%ENV_FILE%"
echo.
echo Presiona una tecla para continuar, o Ctrl+C para abortar...
pause >nul

goto :main

REM ============================================================================
REM Helper aplicar_key  %1=KEY %2=VALUE
REM   Lanza un inline PowerShell que recibe KEY y VALUE como args.
REM   Lee el .env, reemplaza la linea KEY=<cualquiera> por KEY=VALUE
REM   preservando el resto. Si no existe, apendea al final. UTF-8 no BOM.
REM   Usamos un PS helper externo para evitar quoting hell de cmd => ps.
REM ============================================================================
:aplicar_key
set "AK_KEY=%~1"
set "AK_VAL=%~2"
REM Llamar al helper PS. Pasamos Value con comillas always (cmd las quita,
REM PS recibe string vacio valido gracias a [AllowEmptyString()]).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0set-env-key.ps1" -EnvFile "%ENV_FILE%" -Key "%AK_KEY%" -Value "%AK_VAL%"
if errorlevel 1 (
    echo     [!] Error guardando %AK_KEY%
) else (
    echo     [v] %AK_KEY% guardada
)
goto :eof

REM ============================================================================
REM Subrutina ask  %1=KEY %2=prompt_label
REM   Hace set /p y dispatch a aplicar_key segun 'borrar'/salir/valor
REM ============================================================================
:ask
set "AK=%~1"
set "PROMPT=%~2"
echo.
echo --- %PROMPT% ---
set "V="
set /p "V=Ingresa %AK% [Enter=mantener]: "
if /i "!V!"=="salir" goto :abortar
if /i "!V!"=="borrar" (
    call :aplicar_key "%AK%" ""
    echo     [x] %AK% borrada
    goto :eof
)
if not "!V!"=="" (
    call :aplicar_key "%AK%" "!V!"
    goto :eof
)
echo     [-] %AK% no modificada
goto :eof

:main

REM ============================================================================
REM Preguntas academicas / provedores
REM ============================================================================
call :ask "MINERU_API_KEY"            "MinerU - precision mode PDFs >20 pags (https://mineru.net)"
call :ask "HF_TOKEN"                  "HuggingFace token (https://huggingface.co/settings/tokens)"
call :ask "SERP_API_KEY"              "SERP API / Google Scholar (https://serpapi.com)"
call :ask "SERPAPI_KEY"               "SERPAPI_KEY alias (https://serpapi.com) - recomendado igual que SERP_API_KEY"
call :ask "CORE_API_KEY"             "CORE Academic (https://core.ac.uk/services/api)"
call :ask "SEMANTIC_SCHOLAR_API_KEY"  "Semantic Scholar (https://www.semanticscholar.org/product/api)"
call :ask "SCOPUS_API_KEY"            "Scopus Elsevier (https://dev.elsevier.com)"
call :ask "REDALYC_TOKEN"            "Redalyc (https://www.redalyc.org)"
call :ask "UNPAYWALL_EMAIL"          "Unpaywall email (REQUERIDO contacto real)"
call :ask "OSM_USER_AGENT"           "OSM User-Agent (REQUERIDO contacto real)"

REM --- Pregunta IA ---
echo.
echo ============================================================
echo   Modelos de IA (OPCIONALES - paper-summarization etc.)
echo ============================================================
set "V_IA="
set /p "V_IA=Quieres configurar alguna IA key? (s/n) [n]: "
if /i "!V_IA!"=="s" goto :ia_keys
if /i "!V_IA!"=="si" goto :ia_keys
if /i "!V_IA!"=="y" goto :ia_keys
if /i "!V_IA!"=="yes" goto :ia_keys
goto :reiniciar

:ia_keys
call :ask "GEMINI_API_KEY"      "Google Gemini (https://aistudio.google.com/app/apikey)"
call :ask "ANTHROPIC_API_KEY"    "Anthropic Claude (https://console.anthropic.com)"
call :ask "ANTHROPIC_TOKEN"      "ANTHROPIC_TOKEN alias (mismo valor que ANTHROPIC_API_KEY)"
call :ask "OPENAI_API_KEY"       "OpenAI (https://platform.openai.com/api-keys)"
call :ask "OPENAI_TOKEN"         "OPENAI_TOKEN alias (mismo valor que OPENAI_API_KEY)"
call :ask "GROQ_API_KEY"         "Groq (https://console.groq.com/keys)"
call :ask "GROQ_TOKEN"           "GROQ_TOKEN alias (mismo valor que GROQ_API_KEY)"

REM ============================================================================
REM Reiniciar servicios NSSM
REM ============================================================================
:reiniciar
echo.
echo ============================================================
echo   Reiniciando servicios del Suite...
echo ============================================================
echo.

echo [1/3] LetXinetSuiteMCPV11 (puerto 4003^)...
"%NSSM%" restart LetXinetSuiteMCPV11
if errorlevel 1 ( echo     [!] no reiniciado ) else ( echo     [v] OK )

echo [2/3] LetXinetSuiteMarkitDown (puerto 7860^)...
"%NSSM%" restart LetXinetSuiteMarkitDown
if errorlevel 1 ( echo     [!] no reiniciado ) else ( echo     [v] OK )

echo [3/3] LetXinetSuiteOSMMCP (puerto 7082^)...
"%NSSM%" restart LetXinetSuiteOSMMCP
if errorlevel 1 ( echo     [!] no reiniciado ) else ( echo     [v] OK )

REM --- Esperar 10s ---
echo.
echo Esperando 10 segundos a que abran sus puertos...
timeout /t 10 /nobreak >nul

echo.
echo ============================================================
echo   Healthchecks
echo ============================================================
echo.

call :healthcheck "http://127.0.0.1:4003"       "MCP-V11"
call :healthcheck "http://127.0.0.1:7860/health" "MarkItDown"
call :healthcheck "http://127.0.0.1:7082"        "OSM-MCP"

echo.
echo ============================================================
echo   Configuracion completada.
echo ============================================================
echo.
echo Configuracion guardada en: "%ENV_FILE%"
echo Logs centralizados en:     "%PROGRAMDATA%\LetXinet Suite\Logs"
echo Para volver a editar: Menu Inicio -^> LetXinet Suite -^> Configurar API keys
echo.
pause
exit /b 0

REM ============================================================================
REM Subrutina healthcheck
REM ============================================================================
:healthcheck
set "URL=%~1"
set "NAME=%~2"
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 5; Write-Host ('    [v] ' + '%NAME%' + ' HTTP ' + $r.StatusCode) } catch { Write-Host ('    [!] ' + '%NAME%' + ' no responde aun (puede seguir inicializando)') }"
goto :eof

:abortar
echo.
echo [configure-keys] Abortado. Lo guardado hasta ahora SI queda en el .env.
pause
exit /b 0
