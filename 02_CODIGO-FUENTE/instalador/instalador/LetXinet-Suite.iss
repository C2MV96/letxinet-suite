; ============================================================
;  LetXinet-Suite.iss
;  Inno Setup 6 script - LetXinet Suite v1.0 installer
;
;  Suite unificado que empaqueta 4 componentes:
;    1. OSM-MCP                (servicio NSSM, puerto 7082)
;    2. MarkItDown API          (servicio NSSM, puerto 7860)
;    3. MCP-V11-Local           (servicio NSSM, puerto 4003 + sidecar 4002)
;    4. LetXinet Desktop HF     (Electron GUI, sin NSSM, puerto 43123)
;
;  Requisitos:
;    - PrivilegesRequired=admin (registra servicios Windows via NSSM)
;    - Windows 10 x64 (por Electron 37 + Python 3.12 embed amd64)
;    - Inno Setup 6.7+ ISCC.exe para compilarlo
;
;  Build:
;    "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" LetXinet-Suite.iss
;    (build-variants.cmd llama a ISCC con /D VARIANT_A o /D VARIANT_B)
; ============================================================

#define MyAppName         "LetXinet Suite"
#define MyAppVersion      "1.1.5"
; Requisito incluido: Node.js LTS (lo usan el adaptador de MarkItDown y los puentes MCP de bin\mcp)
#define NodeMsi           "node-v22.23.4-x64.msi"
#define MyAppPublisher    "C2MV / LetXipu"
#define MyAppURL          "https://github.com/C2MV/letxinet-suite"
#define MyAppExeName      "LetXipu Desktop HF.exe"

; PAYLOAD_ROOT: raiz de los payloads compilados (componentes-parches\).
; Default relativo. Override via /DPAYLOAD_ROOT=L:\ desde build-variants.cmd
; si los paths largos superan MAX_PATH (260) en Windows.
#ifndef PAYLOAD_ROOT
  #define PAYLOAD_ROOT "..\componentes-parches"
#endif

; Variantes:
;   VARIANT_A (interno)  -> incluye .env con tokens reales en variant-tokens\
;   VARIANT_B (publico)  -> .env publico sin tokens (la compilacion publica)
; Default: B si no se define (mas seguro)
#ifndef VARIANT_A
  #ifndef VARIANT_B
    #define VARIANT_B
  #endif
#endif

#ifdef VARIANT_A
  #define MyAppSuffix      "-VariantA"
  #define MyAppSuffixLabel "VariantA (interno, con tokens academicos + IA providers)"
#else
  #define MyAppSuffix      "-VariantB"
  #define MyAppSuffixLabel "VariantB (publico, sin tokens - operador rellena)"
#endif

[Setup]
; IDs unicos por variante para que A y B puedan coexistir en la misma maquina.
#ifdef VARIANT_A
  AppId={{7F8B9C2D-LETX-SUITE-2026-VARIANT-A-0000001}
#else
  AppId={{7F8B9C2D-LETX-SUITE-2026-VARIANT-B-0000001}
#endif
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion} {#MyAppSuffixLabel}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
; Instalacion por usuario ALL USERS (necesita admin para servicios NSSM)
DefaultDirName={commonpf}\LetXinet Suite
DefaultGroupName={#MyAppName}
; Carpeta de instalacion por defecto: Program Files (requiere admin)
DisableDirPage=no
DisableProgramGroupPage=yes
; Output del compilador
OutputDir=..\..\build\installer-output
OutputBaseFilename=LetXinet-Suite-{#MyAppVersion}{#MyAppSuffix}-Setup
; Compresion LZMA2 solida (payload ~2 GB -> ~700 MB approx)
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
; 64-bit obligatorio (Electron 37 + Python 3.12 embed amd64)
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
; Privilegios de administrador para NSSM services + Program Files
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
; v1.1.2: cerrar el Desktop abierto aunque no responda; sin esto una actualizacion silenciosa se cancela
CloseApplications=force
; Icono del uninstaller/setup
SetupIconFile=assets\icon.ico
UninstallDisplayIcon={app}\LetXinet-Desktop\Letxipu Desktop HF.exe
UninstallDisplayName={#MyAppName}
; Wizard
WizardStyle=modern
ShowLanguageDialog=yes
LanguageDetectionMethod=uilanguage
; Disk cost (estimado: 2 GB)
DiskSpanning=yes
DiskSliceSize=700000000
; License + info
LicenseFile=LICENSE.txt
InfoBeforeFile=INFO-BEFORE.txt
; Version info embedded en el exefile del installer
VersionInfoCompany={#MyAppPublisher}
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}
VersionInfoVersion={#MyAppVersion}

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; ===========================================================
; 1) Suite bin (launchers, env-loader, nssm, register/uninstall)
; ===========================================================
Source: "bin\*"; DestDir: "{app}\bin"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "nssm\nssm.exe"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "register-services.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall-services.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "restart-suite.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "run-osm.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "run-md.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "run-v11.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "assets\icon.ico"; DestDir: "{app}\assets"; Flags: ignoreversion
Source: "INFO-BEFORE.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion
; v1.1.2: Node.js LTS solo si no esta instalado (se borra de {tmp} al terminar)
Source: "prerequisitos\{#NodeMsi}"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: NodeFaltante

; ===========================================================
; 2) Shared env template (editable por el operador)
; ===========================================================
Source: "..\shared-env\LetXinet-Suite.env"; DestDir: "{commonappdata}\LetXinet Suite"; Flags: onlyifdoesntexist uninsneveruninstall
; (los logs tambien van a {commonappdata}\LetXinet Suite\Logs\)

; ===========================================================
; 3) Componente 1: OSM-MCP (24 MB)
; ===========================================================
Source: "{#PAYLOAD_ROOT}\osm-mcp\osmmcp.exe"; DestDir: "{app}\OSM-MCP"; Flags: ignoreversion

; ===========================================================
; 4) Componente 2: MarkItDown API (264 MB)
; ===========================================================
Source: "{#PAYLOAD_ROOT}\markitdown-api\markitdown-payload\app.py"; DestDir: "{app}\MarkItDown\API"; Flags: ignoreversion
Source: "{#PAYLOAD_ROOT}\markitdown-api\markitdown-payload\requirements.txt"; DestDir: "{app}\MarkItDown\API"; Flags: ignoreversion
Source: "{#PAYLOAD_ROOT}\markitdown-api\markitdown-payload\mcp-adapter\*"; DestDir: "{app}\MarkItDown\API\mcp-adapter"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#PAYLOAD_ROOT}\markitdown-api\markitdown-payload\python-runtime\*"; DestDir: "{app}\MarkItDown\API\python-runtime"; Flags: recursesubdirs createallsubdirs ignoreversion uninsneveruninstall

; ===========================================================
; 5) Componente 3: MCP-V11-Local (631 MB)
; ===========================================================
Source: "{#PAYLOAD_ROOT}\mcp-v11-local\MCP-V11-Local.exe"; DestDir: "{app}\MCP-V11-Local"; Flags: ignoreversion
Source: "{#PAYLOAD_ROOT}\mcp-v11-local\start-mcp-local.cmd"; DestDir: "{app}\MCP-V11-Local"; Flags: ignoreversion
; dist\ (TS compiled, requiere tambien para dotenv.config() lookup)
Source: "{#PAYLOAD_ROOT}\mcp-v11-local\dist\*"; DestDir: "{app}\MCP-V11-Local\dist"; Flags: recursesubdirs createallsubdirs ignoreversion
; python\ (spacy_server.py + requirements.txt + modelos sm)
Source: "{#PAYLOAD_ROOT}\mcp-v11-local\python\*"; DestDir: "{app}\MCP-V11-Local\python"; Flags: recursesubdirs createallsubdirs ignoreversion
; python-runtime\ (Python embed + site-packages)
Source: "{#PAYLOAD_ROOT}\mcp-v11-local\python-runtime\*"; DestDir: "{app}\MCP-V11-Local\python-runtime"; Flags: recursesubdirs createallsubdirs ignoreversion uninsneveruninstall
; v1.1.1: spaCy desactivado por defecto (sidecar con HTTP 500). Para reactivarlo: borrar el archivo y reiniciar el servicio.
Source: "{#PAYLOAD_ROOT}\mcp-v11-local\SPACY_DISABLED"; DestDir: "{app}\MCP-V11-Local"; Flags: ignoreversion

; .env del V11: variante A o B. ISS define QFileFrom parar incorporar el .env
; correcto. VARIABLE definida arriba en #ifdef.
#ifdef VARIANT_A
  Source: "..\..\variant-tokens\variantA-interno\.env"; DestDir: "{app}\MCP-V11-Local"; Flags: ignoreversion
#else
  ; Variante B (publica): usar la plantilla publico sin tokens
  Source: "..\..\variant-tokens\variantB-publico\.env"; DestDir: "{app}\MCP-V11-Local"; Flags: ignoreversion
#endif

; ===========================================================
; 6) Componente 4: LetXinet Desktop HF (772 MB Electron app)
;    Dual Build integracion v1.1.0 (Sesion 5):
;    - Layout nuevo: resources/app/ en lugar de resources/app.asar.unpacked/
;      (debido a asar:false en electron-builder config)
;    - server.cjs incluye BUILD_VARIANT condicional (leido de process.env)
;    - main.cjs incluye seedSecretsFromBundle() para copiar resources/secrets.json
;      a userData/secrets.json en primer arranque
;    - Variante A: EMBEDE resources/secrets.json con 3 IA provider keys
;      (Nebius/OpenRouter/DeepSeek). Variante B: NO lo lleva
; ===========================================================
; v1.1.1: se excluye secrets.json (antes entraba tambien en la Variante B por esta copia recursiva)
Source: "{#PAYLOAD_ROOT}\letxinet-desktop\*"; DestDir: "{app}\LetXinet-Desktop"; Flags: recursesubdirs createallsubdirs ignoreversion; Excludes: "resources\secrets.json,*.bak,*.bak-*,*.log"

; v1.1.0 Dual Build: secrets.json SOLO en Variante A (interno, con 3 IA keys)
; En Variante B este archivo NO se copia - el usuario configura via GUI del Desktop
; Mechanics: main.cjs con seedSecretsFromBundle() detecta si resources/secrets.json
; existe en el bundle y lo copia a userData\secrets.json en primer arranque.
#ifdef VARIANT_A
  Source: "{#PAYLOAD_ROOT}\letxinet-desktop\resources\secrets.json"; DestDir: "{app}\LetXinet-Desktop\resources"; Flags: ignoreversion
#endif

; ===========================================================
; 7) README y docs
; ===========================================================
Source: "README-SUITE.txt"; DestDir: "{app}"; Flags: ignoreversion isreadme

[Dirs]
; Carpeta centralizada de logs en %PROGRAMDATA%
Name: "{commonappdata}\LetXinet Suite\Logs"; Flags: uninsneveruninstall
Name: "{commonappdata}\LetXinet Suite"; Flags: uninsneveruninstall

[Icons]
; ===========================================================
; Atajos en el menu Inicio
; ===========================================================
Name: "{group}\LetXinet Desktop HF"; Filename: "{app}\bin\start-letxinet-desktop.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\LetXinet-Desktop\Letxipu Desktop HF.exe"; Comment: "Lanza la app Electron LetXipu Desktop HF"
Name: "{group}\Configurar API keys"; Filename: "{app}\bin\configure-keys.cmd"; WorkingDir: "{app}\bin"; Comment: "Asistente interactivo para meter claves de API de MinerU/HF/SerpAPI/etc. y reiniciar servicios"
Name: "{group}\Editar LetXinet-Suite.env"; Filename: "notepad.exe"; Parameters: """{commonappdata}\LetXinet Suite\LetXinet-Suite.env"""; Comment: "Abre el archivo de configuracion del Suite (puertos, endpoints remotos, IA tokens)"
Name: "{group}\Ver logs centralizados"; Filename: "explorer.exe"; Parameters: """{commonappdata}\LetXinet Suite\Logs"""; Comment: "Carpeta con los logs de los 3 servicios"
Name: "{group}\Detener servicios del Suite"; Filename: "{app}\uninstall-services.cmd"; Comment: "Detiene (no desinstala) los 3 servicios; util para diagnoastico"
Name: "{group}\Reiniciar servicios del Suite"; Filename: "{app}\restart-suite.cmd"; Comment: "Reinicia los 3 servicios del Suite (OSM-MCP, MarkItDown API, MCP-V11-Local); requiere permisos de administrador"
Name: "{group}\Configurar Claude Code, Claude Desktop y OpenCode"; Filename: "{app}\bin\configurar-clientes.cmd"; WorkingDir: "{app}\bin"; Comment: "Escribe la configuracion MCP de LetXinet en los clientes de IA del usuario (modos separados, juntos o ambos)"
Name: "{group}\Probar LetXinet Suite"; Filename: "{app}\bin\pruebas\probar-letxinet.cmd"; WorkingDir: "{app}\bin\pruebas"; Comment: "Harness de pruebas: revisa la instalacion y prueba cada servicio; deja un informe en el Escritorio"
Name: "{group}\Desinstalar LetXinet Suite"; Filename: "{uninstallexe}"; Comment: "Desinstala el Suite completo y los servicios Windows asociados"

; Atajo en el escritorio del usuario por defecto
Name: "{commondesktop}\LetXinet Desktop HF"; Filename: "{app}\bin\start-letxinet-desktop.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\LetXinet-Desktop\Letxipu Desktop HF.exe"; Comment: "Lanza la app Electron LetXipu Desktop HF"

[Run]
; ===========================================================
; v1.1.2: requisitos y configuracion antes de arrancar los servicios
; ===========================================================
Filename: "msiexec.exe"; Parameters: "/i ""{tmp}\{#NodeMsi}"" /qn /norestart"; Flags: runhidden waituntilterminated; StatusMsg: "Instalando Node.js LTS (requisito)..."; Check: NodeFaltante
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\bin\actualizar-config.ps1"" -Contacto ""{code:ContactoOsm}"""; Flags: runhidden waituntilterminated; StatusMsg: "Actualizando la configuracion..."

; ===========================================================
; Post-install: registrar servicios NSSM e iniciar
; ===========================================================
; Ejecutar como admin (Inno ya pidio elevation con PrivilegesRequired=admin)
Filename: "{app}\register-services.cmd"; Parameters: ""; Flags: runhidden postinstall runascurrentuser waituntilterminated; StatusMsg: "Registrando servicios Windows (NSSM)..."; Check: IsAdminInstallMode

; Variante B: lanzar el asistente de configuracion de API keys (solo GUI).
; skipifsilent: no se ofrece en installs /SILENT o /VERYSILENT (deploy自动化).
; nowait: no bloquea el finish page; el operador puede saltarselo.
#ifdef VARIANT_B
  Filename: "{app}\bin\configure-keys.cmd"; Parameters: ""; Flags: postinstall nowait skipifsilent runascurrentuser; StatusMsg: "Lanzar asistente de API keys (opcional)..."; Check: IsAdminInstallMode
#endif

; v1.1.2: configurar Claude Code, Claude Desktop y OpenCode del usuario que instala (no del administrador)
Filename: "{code:RutaNode}"; Parameters: """{app}\bin\configurar-clientes.cjs"" --modo separados --silencioso"; Flags: postinstall runasoriginaluser runhidden waituntilterminated; Description: "Configurar Claude Code, Claude Desktop y OpenCode (recomendado)"; StatusMsg: "Configurando los clientes de IA..."

; Mensaje final indicando al usuario los puertos por defecto
Filename: "{cmd}"; Parameters: "/c echo. & echo === LetXinet Suite instalado === & echo Desktop HF:  http://127.0.0.1:43123 & echo MCP-V11:    http://127.0.0.1:4003 & echo OSM-MCP:    http://127.0.0.1:7082 & echo MarkItDown: http://127.0.0.1:7860 & echo. & echo Variante B (publico): ejecuta 'Configurar API keys' & echo desde el Menu Inicio para meter tus claves. & echo. & pause"; Flags: postinstall nowait skipifsilent runascurrentuser; Check: IsAdminInstallMode

[UninstallRun]
; ===========================================================
; Pre-uninstall: detener y eliminar servicios PRIMERO
; ===========================================================
Filename: "{app}\uninstall-services.cmd"; Parameters: ""; Flags: runhidden runascurrentuser waituntilterminated; RunOnceId: "StopServices"

[UninstallDelete]
; Borrar componentes (los servicios ya fueron eliminados por uninstall-services.cmd)
Type: filesandordirs; Name: "{app}\OSM-MCP"
Type: filesandordirs; Name: "{app}\MarkItDown\API"
Type: filesandordirs; Name: "{app}\MCP-V11-Local"
Type: filesandordirs; Name: "{app}\LetXinet-Desktop"
Type: filesandordirs; Name: "{app}\bin"
Type: filesandordirs; Name: "{app}\assets"
; Borrar tambien root si esta vacio
Type: dirifempty; Name: "{app}"
; Logs centralizados: NO se borran (uninsneveruninstall en [Dirs])- el
; administrador puede inspeccionar logs despues de una desinstalacion para
; diagnostico.

[Code]
var
  PaginaOsm: TInputQueryWizardPage;
  ServiciosDetenidos: Boolean;
  InstalacionCompleta: Boolean;

function InitializeSetup(): Boolean;
begin
  Result := True;
end;

// v1.1.2: correo de contacto para OpenStreetMap (Nominatim pide identificar la aplicacion)
procedure InitializeWizard();
begin
  PaginaOsm := CreateInputQueryPage(wpSelectDir,
    'Contacto para OpenStreetMap',
    'Opcional: un correo para identificar tus consultas de mapas',
    'Las reglas de uso de Nominatim piden que cada aplicacion se identifique con un contacto real. ' +
    'Si lo dejas vacio, LetXinet se identifica solo con su nombre. Puedes cambiarlo despues en LetXinet-Suite.env (OSM_USER_AGENT).');
  PaginaOsm.Add('Correo de contacto (opcional):', False);
end;

function ContactoOsm(Param: String): String;
begin
  Result := '';
  if PaginaOsm <> nil then
    Result := Trim(PaginaOsm.Values[0]);
  StringChangeEx(Result, '"', '', True);
end;

function NodeFaltante(): Boolean;
begin
  Result := not FileExists(ExpandConstant('{commonpf64}\nodejs\node.exe'));
end;

function RutaNode(Param: String): String;
begin
  if FileExists(ExpandConstant('{commonpf64}\nodejs\node.exe')) then
    Result := ExpandConstant('{commonpf64}\nodejs\node.exe')
  else
    Result := 'node.exe';
end;

// v1.1.2: en una actualizacion, detener los servicios antes de reemplazar sus archivos
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Codigo: Integer;
begin
  Result := '';
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop LetXinetSuiteMCPV11', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop LetXinetSuiteOSMMCP', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop LetXinetSuiteMarkitDown', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  ServiciosDetenidos := True;
  // En modo silencioso no hay a quien pedirle que cierre el Desktop, y Restart Manager no logra cerrar Electron
  if WizardSilent then
    Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /T /IM "LetXipu Desktop HF.exe"', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  Sleep(4000);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    InstalacionCompleta := True;
end;

// v1.1.2: si la instalacion se cancela despues de detener los servicios, volver a arrancarlos
procedure DeinitializeSetup();
var
  Codigo: Integer;
begin
  if ServiciosDetenidos and not InstalacionCompleta then
  begin
    Exec(ExpandConstant('{sys}\sc.exe'), 'start LetXinetSuiteMCPV11', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
    Exec(ExpandConstant('{sys}\sc.exe'), 'start LetXinetSuiteOSMMCP', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
    Exec(ExpandConstant('{sys}\sc.exe'), 'start LetXinetSuiteMarkitDown', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  end;
end;

// Verificar que NSSM este presente (no se compila en Windows por defecto).
// Esta funcion se invoca para validar la Source folder antes de compilar.
function IsNssmAvailable(): Boolean;
begin
  Result := FileExists(ExpandConstant('{src}\nssm\nssm.exe')) OR
            FileExists(ExpandConstant('{src}\bin\nssm.exe'));
end;
