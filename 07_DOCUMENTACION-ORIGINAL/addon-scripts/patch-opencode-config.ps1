# patch-opencode-config.ps1
# Post-install script for LetXinet Addon - reescribe opencode.json con paths absolutos
# Backup automatico a opencode.json.bak-<timestamp> antes de sobrescribir
# Llamado por Inno Setup con: powershell -ExecutionPolicy Bypass -File "<installdir>\bin\patch-opencode-config.ps1" -AddonDir "<installdir>" -SuiteDir "<suitedir>"

param(
    [Parameter(Mandatory=$true)]
    [string]$AddonDir,

    [Parameter(Mandatory=$true)]
    [string]$SuiteDir
)

$ErrorActionPreference = 'Stop'

# === 1. Detectar opencode config dir ===
$opencodeDir = Join-Path $env:USERPROFILE ".config\opencode"
$configPath = Join-Path $opencodeDir "opencode.json"

Write-Host "[patch-opencode-config] opencode dir: $opencodeDir"
Write-Host "[patch-opencode-config] config path:  $configPath"

if (-not (Test-Path $opencodeDir)) {
    Write-Host "[patch-opencode-config] Creando ~/.config/opencode/ ..."
    New-Item -ItemType Directory -Path $opencodeDir -Force | Out-Null
}

# === 2. Backup de config existente ===
if (Test-Path $configPath) {
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backup = Join-Path $opencodeDir "opencode.json.bak-$timestamp"
    Copy-Item $configPath $backup -Force
    Write-Host "[patch-opencode-config] Backup creado: $backup"
} else {
    Write-Host "[patch-opencode-config] No existe opencode.json - se creara nuevo"
}

# === 3. Normalizar paths (formato forward slash para JSON) ===
$addonPath = $AddonDir -replace '\\', '/'
$suitePath = $SuiteDir -replace '\\', '/'

# === 4. Construir config nueva ===
# Referencias absolutas a:
#   letxinet-gateway  -> Addon\mcp-bridge\mcp-bridge.cjs (puente stdio->REST hacia Suite)
#   omni-word-mcp     -> Addon\omni-word-mcp\.venv\Scripts\python.exe + word_mcp_server.py
#   markitdown-api    -> Suite\MarkItDown\API\mcp-adapter\markitdown-mcp.js (ya incluido en Suite)
#   latex-mcp-local   -> Addon\latex-mcp-local\dist\index.js
#   codebase-memory   -> mantenido del config existente (si existe)

# Preservar codebase-memory path si existe
$codebaseMemoryCmd = "C:/Users/$env:USERNAME/AppData/Local/Programs/codebase-memory-mcp/codebase-memory-mcp.exe"
if (Test-Path $configPath) {
    try {
        $existing = Get-Content $configPath -Raw | ConvertFrom-Json
        if ($existing.mcp.PSObject.Properties.Name -contains 'codebase-memory' -and $existing.mcp.'codebase-memory'.command) {
            $codebaseMemoryCmd = ($existing.mcp.'codebase-memory'.command -join ' ').Trim()
        }
    } catch {
        Write-Host "[patch-opencode-config] Error leyendo config existente (continuando con default)"
    }
}

# Detectar username actual para el codebase-memory path
$cbPath = "C:/Users/$env:USERNAME/AppData/Local/Programs/codebase-memory-mcp/codebase-memory-mcp.exe"

$newConfig = @{
    '$schema' = 'https://opencode.ai/config.json'
    mcp = [ordered]@{
        'letxinet-gateway' = @{
            type = 'local'
            command = @('node', "$addonPath/mcp-bridge/mcp-bridge.cjs")
            enabled = $true
            timeout = 3600000
            environment = @{
                LETXINET_SUITE_URL = 'http://127.0.0.1:43123'
                LETXINET_SERVER_SELECTION = 'both'
            }
            '_note' = 'Puente MCP stdio -> REST del Suite Desktop HF. Requiere Suite corriendo en 127.0.0.1:43123.'
        }
        'omni-word-mcp' = @{
            type = 'local'
            command = @("$addonPath/omni-word-mcp/.venv/Scripts/python.exe", "$addonPath/omni-word-mcp/word_mcp_server.py")
            enabled = $true
            env = @{ MCP_DEBUG = '1' }
            '_note' = 'Requiere Microsoft Word 2016+ instalado (COM automation).'
        }
        'markitdown-api' = @{
            type = 'local'
            command = @('node', "$suitePath/MarkItDown/API/mcp-adapter/markitdown-mcp.js")
            enabled = $true
            env = @{ MARKITDOWN_API_URL = 'http://127.0.0.1:7860' }
            '_note' = 'API MarkItDown viene incluida en el Suite (puerto 7860).'
        }
        'latex-mcp-local' = @{
            type = 'local'
            command = @('node', "$addonPath/latex-mcp-local/dist/index.js")
            enabled = $true
            '_note' = 'Compiler LaTeX local v4 (XeLaTeX + Biber).'
        }
    }
    skills = @{
        paths = @("C:/Users/$env:USERNAME/.config/opencode/skills")
    }
}

# Agregar codebase-memory si existe
if (Test-Path $cbPath) {
    $newConfig.mcp.Insert(0, 'codebase-memory', @{
        type = 'local'
        command = @($cbPath)
        enabled = $true
    })
    Write-Host "[patch-opencode-config] codebase-memory detectado y activado"
}

# === 5. Escribir config nueva ===
$json = $newConfig | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($configPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "=== opencode.json actualizado ==="
Write-Host "Path: $configPath"
Write-Host ""
Write-Host "MCPs activos:"
Write-Host "  letxinet-gateway  -> $addonPath/mcp-bridge/mcp-bridge.cjs"
Write-Host "  omni-word-mcp     -> $addonPath/omni-word-mcp/.venv/Scripts/python.exe"
Write-Host "  markitdown-api    -> $suitePath/MarkItDown/API/mcp-adapter/markitdown-mcp.js"
Write-Host "  latex-mcp-local   -> $addonPath/latex-mcp-local/dist/index.js"
if (Test-Path $cbPath) {
    Write-Host "  codebase-memory   -> $cbPath"
}
Write-Host ""
Write-Host "Skills path: C:/Users/$env:USERNAME/.config/opencode/skills"
Write-Host ""
Write-Host "[patch-opencode-config] OK - reinicia opencode para activar skills"
