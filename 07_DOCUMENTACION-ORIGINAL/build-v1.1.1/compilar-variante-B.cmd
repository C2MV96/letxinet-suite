@echo off
REM Compila LetXinet Suite 1.1.1 Variante B (sin claves) desde este arbol de build.
REM Requiere Inno Setup 6 en %LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe
setlocal
set "BASE=%~dp0"
set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
set "ISS=%BASE%src-suite\instalador\LetXinet-Suite.iss"
set "OUT=%BASE%installer-output\variantB"
set "DRV=Q:"
if not exist "%ISCC%" ( echo ERROR: no se encuentra ISCC.exe & exit /b 1 )
if exist "%DRV%\" ( echo ERROR: la unidad %DRV% ya esta en uso & exit /b 1 )
subst %DRV% "%BASE%src-suite\componentes-parches" || exit /b 1
if not exist "%OUT%" mkdir "%OUT%"
"%ISCC%" /Q /DVARIANT_B /DPAYLOAD_ROOT=%DRV%\ /O"%OUT%" "%ISS%"
set "RC=%ERRORLEVEL%"
subst %DRV% /D
echo ISCC termino con codigo %RC%
exit /b %RC%
