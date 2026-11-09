# Configura LetXinet Suite en Claude Code en ESTA laptop (alcance de usuario).
# Requisitos: LetXinet Suite 1.1.0 ya instalada (servicios en 4003, 7082 y 7860) y Node.js en el PATH.
# Uso: clic derecho -> "Ejecutar con PowerShell", o:  powershell -ExecutionPolicy Bypass -File .\instalar-config-claude-code.ps1
# No pide permisos de administrador: solo escribe en tu carpeta de usuario.
$ErrorActionPreference = 'Stop'
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$home_ = $env:USERPROFILE
$dest = Join-Path $home_ 'LetXinet'
New-Item -ItemType Directory -Force -Path $dest, (Join-Path $dest 'jobs') | Out-Null

# 1) Puente de tareas largas (de OpenCode)
Copy-Item (Join-Path $aqui 'gateway-mcp-bridge.cjs') (Join-Path $dest 'gateway-mcp-bridge.cjs') -Force
$bridge = (Join-Path $dest 'gateway-mcp-bridge.cjs') -replace '\\', '/'
$jobs = (Join-Path $dest 'jobs') -replace '\\', '/'

# 2) Servidores MCP en ~/.claude.json (con respaldo)
$cj = Join-Path $home_ '.claude.json'
if (Test-Path $cj) { Copy-Item $cj "$cj.bak-letxinet-$(Get-Date -Format yyyyMMdd-HHmmss)" }
$cfg = if (Test-Path $cj) { Get-Content $cj -Raw -Encoding UTF8 | ConvertFrom-Json } else { New-Object PSObject }
if (-not ($cfg.PSObject.Properties.Name -contains 'mcpServers')) { $cfg | Add-Member -NotePropertyName mcpServers -NotePropertyValue (New-Object PSObject) }
$servers = [ordered]@{
  'letxinet-v11'        = @{ type = 'http'; url = 'http://127.0.0.1:4003/api/mcp' }
  'letxinet-osm'        = @{ type = 'http'; url = 'http://127.0.0.1:7082/mcp' }
  'letxinet-markitdown' = @{ type = 'stdio'; command = 'node'; args = @('C:/Program Files/LetXinet Suite/MarkItDown/API/mcp-adapter/markitdown-mcp.js'); env = @{ MARKITDOWN_API_URL = 'http://127.0.0.1:7860' } }
  'letxinet-jobs'       = @{ type = 'stdio'; command = 'node'; args = @($bridge); env = @{ GATEWAY_URL = 'http://127.0.0.1:3000'; LETXIPU_LOCAL_URL = 'http://127.0.0.1:4003'; JOBS_DIR = $jobs } }
}
foreach ($k in $servers.Keys) {
  if ($cfg.mcpServers.PSObject.Properties.Name -contains $k) { $cfg.mcpServers.PSObject.Properties.Remove($k) }
  $cfg.mcpServers | Add-Member -NotePropertyName $k -NotePropertyValue ([pscustomobject]$servers[$k])
}
[System.IO.File]::WriteAllText($cj, ($cfg | ConvertTo-Json -Depth 50), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "OK  MCP: letxinet-v11, letxinet-osm, letxinet-markitdown, letxinet-jobs"

# 3) Límite de espera MCP de 300 s en ~/.claude/settings.json
$cd = Join-Path $home_ '.claude'; New-Item -ItemType Directory -Force -Path $cd | Out-Null
$st = Join-Path $cd 'settings.json'
$s = if (Test-Path $st) { Copy-Item $st "$st.bak-letxinet" -Force; Get-Content $st -Raw -Encoding UTF8 | ConvertFrom-Json } else { New-Object PSObject }
if (-not ($s.PSObject.Properties.Name -contains 'env')) { $s | Add-Member -NotePropertyName env -NotePropertyValue (New-Object PSObject) }
if ($s.env.PSObject.Properties.Name -contains 'MCP_TOOL_TIMEOUT') { $s.env.MCP_TOOL_TIMEOUT = '300000' } else { $s.env | Add-Member -NotePropertyName MCP_TOOL_TIMEOUT -NotePropertyValue '300000' }
[System.IO.File]::WriteAllText($st, ($s | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "OK  MCP_TOOL_TIMEOUT=300000"

# 4) Skills
$sk = Join-Path $cd 'skills'; New-Item -ItemType Directory -Force -Path $sk | Out-Null
Copy-Item (Join-Path $aqui 'skills\*') $sk -Recurse -Force
Write-Host "OK  skills: letxinet-investigacion-academica, letxinet-geo-academico"

# 5) Comprobación rápida
foreach ($p in @(@{n='V11';u='http://127.0.0.1:4003/health'}, @{n='OSM';u='http://127.0.0.1:7082/'}, @{n='MarkItDown';u='http://127.0.0.1:7860/'})) {
  try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 $p.u; Write-Host ("OK  {0} responde ({1})" -f $p.n, $r.StatusCode) } catch { Write-Host ("FALLA {0}: {1}" -f $p.n, $_.Exception.Message) -ForegroundColor Yellow }
}
Write-Host "`nListo. Abre una sesion NUEVA de Claude Code y ejecuta:  claude mcp list"
