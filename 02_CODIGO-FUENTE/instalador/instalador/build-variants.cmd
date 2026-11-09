@echo off
REM build-variants.cmd - Compila las dos variantes del LetXinet Suite.
REM
REM Uso:
REM   build-variants.cmd          (compila las dos)
REM   build-variants.cmd A        (solo Variante A)
REM   build-variants.cmd B        (solo Variante B)
REM
REM Requisitos:
REM   - Inno Setup 6 (ISCC.exe) en %LOCALAPPDATA%\Programs\Inno Setup 6\
REM   - Componentes en ..\componentes-parches\ (Fase 3)
REM   - binarios y assets ya generados (Fases 0-3)

setlocal enableextensions enabledelayedexpansion

set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" (
    echo [build-variants] ERROR: ISCC.exe no encontrado en "%ISCC%"
    exit /b 1
)

set "ISS=%~dp0LetXinet-Suite.iss"
if not exist "%ISS%" (
    echo [build-variants] ERROR: .iss no encontrado en "%ISS%"
    exit /b 1
)

set "OUTROOT=%~dp0..\..\build\installer-output"
if not exist "%OUTROOT%" mkdir "%OUTROOT%"

REM --- subst temporal para acortar paths largos (> MAX_PATH 260) ---
set "PAYLOAD_REAL=%~dp0..\componentes-parches"
set "PAYLOAD_DRIVE=L:"
set "SUBST_DONE=0"
if not exist "%PAYLOAD_DRIVE%\" (
    subst %PAYLOAD_DRIVE% "%PAYLOAD_REAL%"
    if not errorlevel 1 set "SUBST_DONE=1"
)

set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=ALL"

echo.
echo ============================================================
echo  LetXinet Suite - Build de instaladores
echo  ISCC        : %ISCC%
echo  ISS         : %ISS%
echo  Output      : %OUTROOT%
echo  PAYLOAD_ROOT: %PAYLOAD_DRIVE%\  ^(subst=%SUBST_DONE%^)
echo  Target      : %TARGET%
echo ============================================================
echo.

if /I "%TARGET%"=="ALL" call :build_a && call :build_b && goto :cleanup_ok
if /I "%TARGET%"=="A"    call :build_a         && goto :cleanup_ok
if /I "%TARGET%"=="B"                 call :build_b && goto :cleanup_ok
echo [build-variants] Argumento invalido: %TARGET%
goto :cleanup_err

:build_a
echo --- Compilando Variante A (interno, con tokens academicos + IA) ---
"%ISCC%" /DVARIANT_A /DPAYLOAD_ROOT="%PAYLOAD_DRIVE%\" /O"%OUTROOT%\variantA" "%ISS%"
set "A_EXE=%OUTROOT%\variantA\LetXinet-Suite-1.1.0-VariantA-Setup.exe"
if exist "%A_EXE%" (
    echo   OK: Variante A compilada - %A_EXE%
    exit /b 0
)
echo [build-variants] ERROR: ISCC fallo Variante A - .exe no generado
exit /b 1

:build_b
echo --- Compilando Variante B (publico, sin tokens) ---
"%ISCC%" /DVARIANT_B /DPAYLOAD_ROOT="%PAYLOAD_DRIVE%\" /O"%OUTROOT%\variantB" "%ISS%"
set "B_EXE=%OUTROOT%\variantB\LetXinet-Suite-1.1.0-VariantB-Setup.exe"
if exist "%B_EXE%" (
    echo   OK: Variante B compilada - %B_EXE%
    exit /b 0
)
echo [build-variants] ERROR: ISCC fallo Variante B - .exe no generado
exit /b 1

:cleanup_ok
if "%SUBST_DONE%"=="1" subst %PAYLOAD_DRIVE% /d
echo ============================================================
echo  Build completo.
echo ============================================================
exit /b 0

:cleanup_err
if "%SUBST_DONE%"=="1" subst %PAYLOAD_DRIVE% /d
echo ============================================================
echo  Build FALLIDO.
echo ============================================================
exit /b 1
