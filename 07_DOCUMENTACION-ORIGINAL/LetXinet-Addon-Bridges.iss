; ===========================================================================
; LetXinet Addon - Inno Setup script
;
; Addon para opencode + LetXinet Suite Desktop HF.
; Instala los 3 componentes que Suite NO trae:
;   1. mcp-bridge.cjs       - puente stdio->REST hacia Suite (letxinet-gateway)
;   2. omni-word-mcp/       - Python COM automation para Word (18 tools)
;   3. latex-mcp-local/     - compiler LaTeX local v4 (11 tools)
;
; El addon NO modifica Suite. Referencia el Suite instalado en C:\Program Files\
; para markitdown-api (que ya viene incluido en Suite).
;
; Compilar:
;   "C:\Program Files\Inno Setup 6\ISCC.exe" LetXinet-Addon-Bridges.iss
; ===========================================================================

#define MyAppName          "LetXinet Addon Bridges"
#define MyAppVersion       "1.0.0"
#define MyAppPublisher     "LetXinet"
#define MyAppExeName       "LetXinet-Addon"
#define MySourceDir        "D:\OTROS\LETXINET-ADDON-BUILD\sources"
#define MyScriptsDir       "D:\OTROS\LETXINET-ADDON-BUILD\scripts"

[Setup]
AppId={{C2MV-LETXINET-ADDON-001}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={pf}\LetXinet Addon
DefaultGroupName=LetXinet Addon
DisableProgramGroupPage=yes
OutputDir=D:\OTROS\LETXINET-ADDON-BUILD\output
OutputBaseFilename=LetXinet-Addon-Bridges-v1.0.0
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
WizardStyle=modern

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "standard"; Description: "Instalacion estandar (mcp-bridge + omni-word-mcp + latex-mcp-local)"

[Files]
; --- mcp-bridge (30 KB) ---
Source: "{#MySourceDir}\mcp-bridge.cjs"; DestDir: "{app}\mcp-bridge"; Flags: ignoreversion

; --- omni-word-mcp completo (305 MB) ---
Source: "{#MySourceDir}\omni-word-mcp\*"; DestDir: "{app}\omni-word-mcp"; Flags: ignoreversion recursesubdirs createallsubdirs

; --- latex-mcp-local completo (59 MB con node_modules) ---
Source: "{#MySourceDir}\latex-mcp-local\*"; DestDir: "{app}\latex-mcp-local"; Flags: ignoreversion recursesubdirs createallsubdirs

; --- scripts de post-install ---
Source: "{#MyScriptsDir}\check-requirements.ps1"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "{#MyScriptsDir}\patch-opencode-config.ps1"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "{#MyScriptsDir}\restore-config.ps1"; DestDir: "{app}\bin"; Flags: ignoreversion

[Run]
; Pre-install check: detectar Suite, Word, opencode, Node
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\bin\check-requirements.ps1"""; StatusMsg: "Verificando requisitos (Suite, Word, opencode)..."; Flags: runhidden waituntilterminated

; Post-install: parchear opencode.json
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\bin\patch-opencode-config.ps1"" -AddonDir ""{app}"" -SuiteDir ""C:\Program Files\LetXinet Suite"""; StatusMsg: "Actualizando opencode.json..."; Flags: runhidden waituntilterminated

[UninstallRun]
; Restaurar backup de opencode.json si existe
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoProfile -File ""{app}\bin\restore-config.ps1"""; Flags: runhidden waituntilterminated

[UninstallDelete]
Type: filesandordirs; Name: "{app}\mcp-bridge"
Type: filesandordirs; Name: "{app}\omni-word-mcp"
Type: filesandordirs; Name: "{app}\latex-mcp-local"
Type: filesandordirs; Name: "{app}\bin"
Type: dirifempty; Name: "{app}"

[Code]
function InitializeSetup(): Boolean;
begin
    Result := True;
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
    Result := 'Componentes a instalar:' + NewLine +
              Space + 'mcp-bridge.cjs (puente Suite->opencode)' + NewLine +
              Space + 'omni-word-mcp (Word COM, 305 MB)' + NewLine +
              Space + 'latex-mcp-local (LaTeX compiler, 59 MB)' + NewLine + NewLine +
              'Destino:' + NewLine + MemoDirInfo + NewLine + NewLine +
              'Despues de instalar:' + NewLine +
              Space + 'Se actualizara ~/.config/opencode/opencode.json' + NewLine +
              Space + 'Backup automatico a opencode.json.bak-<timestamp>' + NewLine;
end;
