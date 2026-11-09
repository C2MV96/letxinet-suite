# check-requirements.ps1
# Pre-install check: verifica Suite, Word, opencode
# Llamado por Inno Setup en paso pre-install
# Retorna 0 si todo OK, 1 si warnings criticos, 2 si faltan criticos

$ErrorActionPreference = 'Continue'

Write-Host ""
Write-Host "============================================"
Write-Host " LetXinet Addon - Verificacion pre-install"
Write-Host "============================================"
Write-Host ""

$warnings = 0
$errors = 0

# === 1. Suite Desktop HF ===
Write-Host "[1/4] Detectando LetXinet Suite Desktop HF..."
$suitePaths = @(
    "C:\Program Files\LetXinet Suite",
    "C:\Program Files (x86)\LetXinet Suite",
    "D:\Program Files\LetXinet Suite",
    "D:\Program Files (x86)\LetXinet Suite"
)
$suiteFound = $null
foreach ($p in $suitePaths) {
    if (Test-Path $p) { $suiteFound = $p; break }
}

if ($suiteFound) {
    Write-Host "  OK Suite detectado en: $suiteFound"
    # Verificar que tiene los componentes esperados
    $osm = Test-Path "$suiteFound\OSM-MCP\osmmcp.exe"
    $md = Test-Path "$suiteFound\MarkItDown\API\mcp-adapter\markitdown-mcp.js"
    $v11 = Test-Path "$suiteFound\MCP-V11-Local\MCP-V11-Local.exe"
    Write-Host "  OSM-MCP:       $(if ($osm) {'OK'} else {'FALTA'})"
    Write-Host "  MarkItDown:    $(if ($md) {'OK'} else {'FALTA'})"
    Write-Host "  V11 gateway:   $(if ($v11) {'OK'} else {'FALTA'})"
    if (-not ($osm -and $md -and $v11)) {
        Write-Host "  WARNING: Suite existe pero le faltan componentes"
        $warnings++
    }
    # Escribir variable de entorno para Inno Setup
    $env:LETXINET_SUITE_PATH = $suiteFound
    [System.IO.File]::WriteAllText("$env:TEMP\letxinet-suite-path.txt", $suiteFound)
} else {
    Write-Host "  WARNING: Suite NO detectado en paths standard"
    Write-Host "  Las skills que usan gateway/OSM/markitdown no funcionaran"
    Write-Host "  Hasta instalar LetXinet Suite Desktop HF"
    $warnings++
}

Write-Host ""

# === 2. Microsoft Word (COM) ===
Write-Host "[2/4] Detectando Microsoft Word (COM automation)..."
try {
    $word = New-Object -ComObject Word.Application
    $version = $word.Version
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    Write-Host "  OK Microsoft Word $version detectado"
} catch {
    Write-Host "  WARNING: Microsoft Word no detectado via COM"
    Write-Host "  Las 29 skills que generan/editan .docx no funcionaran"
    Write-Host "  Instalar Word 2016+ para activarlas"
    $warnings++
}

Write-Host ""

# === 3. opencode ===
Write-Host "[3/4] Detectando opencode..."
$opencodeExe = Get-Command opencode -ErrorAction SilentlyContinue
if ($opencodeExe) {
    Write-Host "  OK opencode en PATH: $($opencodeExe.Source)"
} else {
    Write-Host "  opencode no esta en PATH - verificando ~/.config/opencode/"
    $cfg = "$env:USERPROFILE\.config\opencode"
    if (Test-Path $cfg) {
        Write-Host "  OK directorio ~/.config/opencode/ existe"
    } else {
        Write-Host "  ERROR: opencode no detectado (ni en PATH ni en ~/.config/opencode/)"
        Write-Host "  Instala opencode CLI primero: https://opencode.ai/docs"
        $errors++
    }
}

Write-Host ""

# === 4. Node.js ===
Write-Host "[4/4] Detectando Node.js (requerido por mcp-bridge y latex-mcp)..."
$nodeExe = Get-Command node -ErrorAction SilentlyContinue
if ($nodeExe) {
    $ver = (node --version 2>$null)
    Write-Host "  OK Node.js $ver en PATH"
} else {
    Write-Host "  ERROR: Node.js no detectado en PATH"
    Write-Host "  Install Node.js LTS: https://nodejs.org/"
    $errors++
}

Write-Host ""
Write-Host "============================================"
Write-Host " Resumen verificacion:"
Write-Host "  Errors:   $errors"
Write-Host "  Warnings: $warnings"
Write-Host "============================================"
Write-Host ""

if ($errors -gt 0) {
    Write-Host "RESULT: ERRORS - instalar dependencias faltantes primero"
    exit 2
} elseif ($warnings -gt 0) {
    Write-Host "RESULT: WARNINGS - addon se puede instalar pero algunas skills no funcionaran"
    exit 1
} else {
    Write-Host "RESULT: OK - todo listo para instalar addon"
    exit 0
}
