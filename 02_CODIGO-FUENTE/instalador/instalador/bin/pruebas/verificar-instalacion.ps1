# Verifica una instalación de LetXinet Suite (+ Addon y Claude Code) y guarda el resultado
# en resultado-prueba.txt, en el Escritorio.
# Uso: clic derecho -> Ejecutar con PowerShell (no requiere administrador).
$out = Join-Path ([Environment]::GetFolderPath('Desktop')) 'resultado-prueba.txt'
$L = New-Object System.Collections.Generic.List[string]
function Chk($ok, $msg) { $L.Add(('[{0}] {1}' -f $(if ($ok) { 'OK  ' } else { 'FALLA' }), $msg)) }
$L.Add("Verificación LetXinet Suite - $(Get-Date -Format 'yyyy-MM-dd HH:mm') - $env:COMPUTERNAME")
$L.Add('')

# 1) Programas instalados
$apps = Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*, HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'LetXinet' }
foreach ($a in $apps) { Chk $true ("Instalado: {0} {1}" -f $a.DisplayName, $a.DisplayVersion) }
if (-not $apps) { Chk $false 'No se encontró LetXinet Suite en Programas instalados' }

# 2) Servicios
foreach ($s in 'LetXinetSuiteOSMMCP', 'LetXinetSuiteMarkitDown', 'LetXinetSuiteMCPV11') {
  $svc = Get-Service $s -ErrorAction SilentlyContinue
  Chk ($svc -and $svc.Status -eq 'Running') ("Servicio {0}: {1}" -f $s, $(if ($svc) { $svc.Status } else { 'NO REGISTRADO' }))
}

# 3) Puertos y salud
$checks = @(
  @{ n = 'MCP-V11 /health (4003)'; u = 'http://127.0.0.1:4003/health' },
  @{ n = 'OSM-MCP (7082)'; u = 'http://127.0.0.1:7082/' },
  @{ n = 'MarkItDown (7860)'; u = 'http://127.0.0.1:7860/' },
  @{ n = 'Desktop HF gateway (43123, solo si la app está abierta)'; u = 'http://127.0.0.1:43123/health' })
foreach ($c in $checks) {
  try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 $c.u; Chk ($r.StatusCode -eq 200) ("{0}: HTTP {1}" -f $c.n, $r.StatusCode) }
  catch {
    # El gateway del Desktop solo responde con la app abierta: no es una falla
    if ($c.u -like '*:43123/*') { $L.Add(('[INFO ] {0}: no responde (abre LetXinet Desktop para probarlo)' -f $c.n)) }
    else { Chk $false ("{0}: {1}" -f $c.n, $_.Exception.Message) }
  }
}
# Prueba MCP real: lista de herramientas de V11
try {
  $body = '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
  $r = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:4003/api/mcp' -ContentType 'application/json' -Body $body -TimeoutSec 30
  Chk ($r.result.tools.Count -gt 0) ("MCP-V11 tools/list: {0} herramientas" -f $r.result.tools.Count)
} catch { Chk $false "MCP-V11 tools/list: $($_.Exception.Message)" }

# 4) spaCy y seguridad
$suite = $apps | Where-Object { $_.DisplayName -match 'LetXinet Suite' -and $_.InstallLocation } | Select-Object -First 1
$app = if ($suite) { $suite.InstallLocation.TrimEnd('\') } else { Join-Path $env:ProgramFiles 'LetXinet Suite' }
$sp = Test-Path "$app\MCP-V11-Local\SPACY_DISABLED"
$p4002 = Get-NetTCPConnection -State Listen -LocalPort 4002 -ErrorAction SilentlyContinue
Chk $sp ("Interruptor spaCy (SPACY_DISABLED): {0} | puerto 4002 escuchando: {1}" -f $sp, [bool]$p4002)
$sec = Test-Path "$app\LetXinet-Desktop\resources\secrets.json"
Chk (-not $sec) ("secrets.json en la instalación: {0}  (en Variante B debe ser False)" -f $sec)
$envf = Join-Path $env:ProgramData 'LetXinet Suite\LetXinet-Suite.env'
Chk (Test-Path $envf) "Archivo de configuración central: $envf"
# V11 ejecuta el código embebido en su .exe: los parches solo están activos si el .exe los trae
$exe = "$app\MCP-V11-Local\MCP-V11-Local.exe"
if (Test-Path $exe) {
  $tieneParches = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($exe)).Contains('maxPagesBySource')
  Chk $tieneParches ("Parches de V11 activos en el .exe: {0}" -f $tieneParches)
} else { Chk $false 'No se encontró MCP-V11-Local.exe' }

# 5) Requisitos y Claude Code
$node = Get-Command node -ErrorAction SilentlyContinue
Chk ([bool]$node) ("Node.js: {0}" -f $(if ($node) { (& node --version) } else { 'NO INSTALADO (necesario para MarkItDown MCP y letxinet-jobs)' }))
$cj = Join-Path $env:USERPROFILE '.claude.json'
if (Test-Path $cj) {
  $m = (Get-Content $cj -Raw -Encoding UTF8 | ConvertFrom-Json).mcpServers
  foreach ($k in 'letxinet-v11', 'letxinet-osm', 'letxinet-markitdown', 'letxinet-jobs') { Chk ($m.PSObject.Properties.Name -contains $k) "Claude Code MCP configurado: $k" }
} else { Chk $false 'No existe ~/.claude.json (ejecuta instalar-config-claude-code.ps1)' }
foreach ($sk in 'letxinet-investigacion-academica', 'letxinet-geo-academico') { Chk (Test-Path "$env:USERPROFILE\.claude\skills\$sk\SKILL.md") "Skill: $sk" }
$claude = Get-Command claude -ErrorAction SilentlyContinue
if ($claude) { $L.Add(''); $L.Add('--- claude mcp list ---'); (& claude mcp list 2>&1) | ForEach-Object { $L.Add("$_") } } else { $L.Add('(El comando claude no está en el PATH: comprueba en una sesión de Claude Code con «claude mcp list»)') }

$fallas = ($L | Where-Object { $_ -like '`[FALLA*' }).Count
$L.Add(''); $L.Add("RESUMEN: $fallas falla(s)")
$L | Set-Content -Path $out -Encoding UTF8
$L | ForEach-Object { Write-Host $_ }
Write-Host "`nResultado guardado en: $out"
