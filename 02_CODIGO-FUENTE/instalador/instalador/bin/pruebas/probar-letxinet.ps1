# Harness de pruebas de LetXinet Suite: revisa la instalación y prueba cada servicio con llamadas reales.
# Deja un informe en Markdown y JSON (por defecto en el Escritorio). No modifica nada ni muestra claves.
#
# Uso: doble clic en probar-letxinet.cmd, o desde PowerShell:
#   .\probar-letxinet.ps1                          prueba completa (3 a 6 minutos)
#   .\probar-letxinet.ps1 -Rapido                  sin búsquedas lentas (menos de 1 minuto)
#   .\probar-letxinet.ps1 -Comparar informe.json   compara con un informe anterior (por ejemplo, antes de reinstalar)
#   -PuertoV11 / -PuertoOSM / -PuertoMarkItDown / -PuertoDesktop   para probar servicios en otros puertos
param(
  [string]$Salida = [Environment]::GetFolderPath('Desktop'),
  [switch]$Rapido,
  [string]$Comparar,
  [int]$PuertoV11 = 4003,
  [int]$PuertoOSM = 7082,
  [int]$PuertoMarkItDown = 7860,
  [int]$PuertoDesktop = 43123,
  [string]$App
)
if (-not $App) {
  $reg = Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*, HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'LetXinet Suite' -and $_.InstallLocation } | Select-Object -First 1
  $App = if ($reg) { $reg.InstallLocation.TrimEnd('\') } else { Join-Path $env:ProgramFiles 'LetXinet Suite' }
}
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::Expect100Continue = $false
Add-Type -AssemblyName System.Net.Http
$inicio = Get-Date
$res = New-Object System.Collections.Generic.List[object]
$metricas = [ordered]@{}

function Anotar($grupo, $prueba, $estado, $detalle, $seg = $null) {
  $res.Add([pscustomobject]@{ Grupo = $grupo; Prueba = $prueba; Estado = $estado; Detalle = "$detalle"; Segundos = $seg })
  $color = @{ OK = 'Green'; AVISO = 'Yellow'; FALLA = 'Red' }[$estado]
  Write-Host ('[{0,-5}] {1,-11} {2,-34} {3}' -f $estado, $grupo, $prueba, $detalle) -ForegroundColor $color
}

function Http($url, $seg = 15) {
  try { $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec $seg; return [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) }
  catch { return $null }
}

# Cliente MCP por HTTP (respuesta JSON o text/event-stream)
function McpPost($url, $cuerpo, $sid, $seg) {
  $h = @{ Accept = 'application/json, text/event-stream' }
  if ($sid) { $h['Mcp-Session-Id'] = $sid }
  $bytes = [Text.Encoding]::UTF8.GetBytes(($cuerpo | ConvertTo-Json -Depth 12 -Compress))
  $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $url -ContentType 'application/json' -Headers $h -Body $bytes -TimeoutSec $seg
  $txt = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
  $nuevo = $r.Headers['Mcp-Session-Id']
  if (-not $txt.Trim()) { return @{ json = $null; sid = $(if ($nuevo) { $nuevo } else { $sid }) } }
  if (-not $txt.TrimStart().StartsWith('{')) {
    $datos = @($txt -split "`n" | Where-Object { $_ -like 'data:*' } | ForEach-Object { $_.Substring(5).Trim() })
    $txt = $datos[-1]
  }
  return @{ json = ($txt | ConvertFrom-Json); sid = $(if ($nuevo) { $nuevo } else { $sid }) }
}
function McpConectar($url) {
  $r = McpPost $url @{ jsonrpc = '2.0'; id = 1; method = 'initialize'; params = @{ protocolVersion = '2025-03-26'; capabilities = @{}; clientInfo = @{ name = 'harness-letxinet'; version = '1' } } } $null 30
  try { McpPost $url @{ jsonrpc = '2.0'; method = 'notifications/initialized' } $r.sid 15 | Out-Null } catch {}
  return $r.sid
}
function McpHerramientas($url, $sid) { (McpPost $url @{ jsonrpc = '2.0'; id = 2; method = 'tools/list'; params = @{} } $sid 60).json.result.tools }
function McpLlamar($url, $sid, $nombre, $argumentos, $seg = 180) {
  $r = (McpPost $url @{ jsonrpc = '2.0'; id = 3; method = 'tools/call'; params = @{ name = $nombre; arguments = $argumentos } } $sid $seg).json
  if ($r.error) { return @{ error = $true; texto = ($r.error | ConvertTo-Json -Compress) } }
  $t = ($r.result.content | ForEach-Object { $_.text }) -join ' '
  return @{ error = [bool]$r.result.isError; texto = $t }
}

# PDF mínimo de una página con el texto "Hola LetXinet", para probar MarkItDown sin archivos externos
function PdfPrueba {
  $objs = @(
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    $null,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>')
  $flujo = 'BT /F1 18 Tf 20 70 Td (Hola LetXinet) Tj ET'
  $objs[3] = "<</Length $($flujo.Length)>>`nstream`n$flujo`nendstream"
  $sb = New-Object Text.StringBuilder
  [void]$sb.Append("%PDF-1.4`n")
  $pos = @()
  for ($i = 0; $i -lt $objs.Count; $i++) { $pos += $sb.Length; [void]$sb.Append("$($i + 1) 0 obj`n$($objs[$i])`nendobj`n") }
  $x = $sb.Length
  [void]$sb.Append("xref`n0 $($objs.Count + 1)`n0000000000 65535 f `n")
  foreach ($p in $pos) { [void]$sb.Append(('{0:D10} 00000 n `n' -f $p)) }
  [void]$sb.Append("trailer`n<</Size $($objs.Count + 1)/Root 1 0 R>>`nstartxref`n$x`n%%EOF`n")
  return [Text.Encoding]::ASCII.GetBytes($sb.ToString())
}

Write-Host "`nHarness LetXinet Suite - $(Get-Date -Format 'yyyy-MM-dd HH:mm') - $env:COMPUTERNAME`n" -ForegroundColor Cyan

# 1. Instalación
$apps = Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*, HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'LetXinet' }
if ($apps) { foreach ($a in $apps) { Anotar 'Instalacion' 'Programa instalado' 'OK' "$($a.DisplayName) $($a.DisplayVersion)" } } else { Anotar 'Instalacion' 'Programa instalado' 'FALLA' 'No aparece LetXinet en Programas instalados' }
$metricas.programas = @($apps | ForEach-Object { "$($_.DisplayName) $($_.DisplayVersion)" })
foreach ($s in 'LetXinetSuiteMCPV11', 'LetXinetSuiteOSMMCP', 'LetXinetSuiteMarkitDown') {
  $svc = Get-Service $s -ErrorAction SilentlyContinue
  Anotar 'Instalacion' "Servicio $s" $(if ($svc -and $svc.Status -eq 'Running') { 'OK' } else { 'FALLA' }) $(if ($svc) { "$($svc.Status), inicio $($svc.StartType)" } else { 'no registrado' })
}
$exe = Join-Path $App 'MCP-V11-Local\MCP-V11-Local.exe'
if (Test-Path $exe) {
  $parches = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($exe)).Contains('maxPagesBySource')
  Anotar 'Instalacion' 'Parches de V11 en el .exe' $(if ($parches) { 'OK' } else { 'FALLA' }) "maxPagesBySource presente: $parches"
  $metricas.v11_exe_sha256 = (Get-FileHash $exe).Hash
} else { Anotar 'Instalacion' 'Parches de V11 en el .exe' 'FALLA' 'no existe MCP-V11-Local.exe' }
$sp = Test-Path (Join-Path $App 'MCP-V11-Local\SPACY_DISABLED')
Anotar 'Instalacion' 'spaCy desactivado' $(if ($sp) { 'OK' } else { 'AVISO' }) "SPACY_DISABLED: $sp"
$sec = Test-Path (Join-Path $App 'LetXinet-Desktop\resources\secrets.json')
Anotar 'Instalacion' 'Sin secrets.json en Program Files' $(if (-not $sec) { 'OK' } else { 'AVISO' }) $(if ($sec) { 'existe (normal solo en la Variante A)' } else { 'no existe' })
# 1.1.4: PyMuPDF (MarkItDown) y el Python de V11 necesitan msvcp140.dll de Visual C++; sin el, MarkItDown no arranca
$vcSis = Test-Path (Join-Path $env:WINDIR 'System32\msvcp140.dll')
$vcMd = Test-Path (Join-Path $App 'MarkItDown\API\python-runtime\msvcp140.dll')
Anotar 'Instalacion' 'Visual C++ para MarkItDown' $(if ($vcSis -or $vcMd) { 'OK' } else { 'FALLA' }) $(if ($vcMd) { 'msvcp140.dll incluido' } elseif ($vcSis) { 'msvcp140.dll de Windows' } else { 'falta msvcp140.dll: reinstala la Suite o instala Visual C++ x64' })
$mainDesk = Join-Path $App 'LetXinet-Desktop\resources\app\electron\main.cjs'
if (Test-Path $mainDesk) {
  $espera = [regex]::Match([IO.File]::ReadAllText($mainDesk), 'LETXIPU_BACKEND_TIMEOUT_MS \|\| (\d+)|timeoutMs = (\d+)')
  $ms = [int]$(if ($espera.Groups[1].Value) { $espera.Groups[1].Value } elseif ($espera.Groups[2].Value) { $espera.Groups[2].Value } else { 0 })
  Anotar 'Instalacion' 'Desktop: espera de arranque' $(if ($ms -ge 300000) { 'OK' } else { 'AVISO' }) $(if ($ms) { "$([math]::Round($ms / 60000)) min" + $(if ($ms -lt 300000) { ' (poco para laptops lentas)' } else { '' }) } else { 'no se pudo leer' })
}
$envf = Join-Path $env:ProgramData 'LetXinet Suite\LetXinet-Suite.env'
if (Test-Path $envf) {
  $vars = @(Get-Content $envf | Where-Object { $_ -match '^\s*[A-Za-z_]\w*\s*=' })
  $conClave = @($vars | Where-Object { $_ -match '^\s*\w*(KEY|TOKEN)\w*\s*=\s*\S' }).Count
  Anotar 'Instalacion' 'Configuracion central' 'OK' "$($vars.Count) variables, $conClave claves con valor"
  $metricas.claves_con_valor = $conClave
} else { Anotar 'Instalacion' 'Configuracion central' 'FALLA' "no existe $envf" }

# 2. Servicios HTTP
$h = Http "http://127.0.0.1:$PuertoV11/health"
if ($h) { $hj = $h | ConvertFrom-Json; Anotar 'V11' 'health' $(if ($hj.status -eq 'ok') { 'OK' } else { 'FALLA' }) "status=$($hj.status) version=$($hj.version) tools=$($hj.tools)" }
else { Anotar 'V11' 'health' 'FALLA' "no responde en $PuertoV11 (tras encender, V11 tarda 1-2 min)" }
$h = Http "http://127.0.0.1:$PuertoMarkItDown/"
$mdOnline = [bool]($h -match 'online')
Anotar 'MarkItDown' 'responde' $(if ($mdOnline) { 'OK' } else { 'FALLA' }) $(if ($h) { 'online' } else { "no responde en $PuertoMarkItDown (revisa ProgramData\LetXinet Suite\Logs\markitdown-api.stderr.log)" })
$h = Http "http://127.0.0.1:$PuertoDesktop/health" 5
if ($h) { $dj = $h | ConvertFrom-Json; Anotar 'Desktop' 'gateway' $(if ($dj.status -eq 'ok') { 'OK' } else { 'FALLA' }) "tools=$($dj.tools) fuentes=$($dj.activeSourcesCount) backend listo=$($dj.mcpBackendReady)" }
else { Anotar 'Desktop' 'gateway' 'AVISO' 'no responde: abre LetXinet Desktop si quieres probarlo' }

# 3. V11 por MCP
$u = "http://127.0.0.1:$PuertoV11/api/mcp"
try {
  $sid = McpConectar $u
  $t = @(McpHerramientas $u $sid)
  Anotar 'V11' 'tools/list' $(if ($t.Count -ge 28) { 'OK' } else { 'FALLA' }) "$($t.Count) herramientas"
  $metricas.v11_herramientas = $t.Count
  $r = McpLlamar $u $sid 'list_sources' @{} 60
  $n = try { @(($r.texto | ConvertFrom-Json).data.sources).Count } catch { 0 }
  Anotar 'V11' 'list_sources' $(if (-not $r.error -and $n -gt 0) { 'OK' } else { 'FALLA' }) "$n fuentes"
  $metricas.v11_fuentes = $n
  $busquedas = @(@('pubmed', 'Aedes aegypti'), @('laref_peru', 'dengue Peru'))
  if (-not $Rapido) { $busquedas += , @('renati', 'dengue Chimbote') }
  foreach ($b in $busquedas) {
    $t0 = Get-Date
    try {
      $r = McpLlamar $u $sid 'search' @{ query = $b[1]; sources = @($b[0]); limit = 20 } 180
      $seg = [math]::Round(((Get-Date) - $t0).TotalSeconds)
      $d = ($r.texto | ConvertFrom-Json).data
      $estado = if ($r.error) { 'FALLA' } elseif ($d.total -gt 0) { 'OK' } else { 'AVISO' }
      Anotar 'V11' "search $($b[0])" $estado "$($d.total) resultados" $seg
      $metricas["v11_search_$($b[0])"] = $d.total
    } catch { Anotar 'V11' "search $($b[0])" 'FALLA' $_.Exception.Message ([math]::Round(((Get-Date) - $t0).TotalSeconds)) }
  }
} catch { Anotar 'V11' 'MCP' 'FALLA' $_.Exception.Message }

# 4. OSM por MCP
$u = "http://127.0.0.1:$PuertoOSM/mcp"
try {
  $sid = McpConectar $u
  $t = @(McpHerramientas $u $sid)
  Anotar 'OSM' 'tools/list' $(if ($t.Count -ge 28) { 'OK' } else { 'FALLA' }) "$($t.Count) herramientas"
  $metricas.osm_herramientas = $t.Count
  $r = McpLlamar $u $sid 'geo_distance' @{ from = @{ latitude = -9.07; longitude = -78.59 }; to = @{ latitude = -8.98; longitude = -78.63 } } 30
  $km = try { [math]::Round(($r.texto | ConvertFrom-Json).distance / 1000, 1) } catch { $null }
  Anotar 'OSM' 'geo_distance (sin internet)' $(if ($km -gt 10 -and $km -lt 12) { 'OK' } else { 'FALLA' }) "$km km"
  $t0 = Get-Date
  $r = McpLlamar $u $sid 'geocode_address' @{ address = 'Chimbote, Ancash, Peru' } 60
  Anotar 'OSM' 'geocode_address (Nominatim)' $(if (-not $r.error -and $r.texto -match 'Chimbote') { 'OK' } else { 'AVISO' }) $(if ($r.texto -match 'Chimbote') { 'Chimbote encontrado' } else { $r.texto.Substring(0, [Math]::Min(90, $r.texto.Length)) }) ([math]::Round(((Get-Date) - $t0).TotalSeconds))
} catch { Anotar 'OSM' 'MCP' 'FALLA' $_.Exception.Message }

# 5. MarkItDown: PDF a Markdown
if (-not $mdOnline) { Anotar 'MarkItDown' 'PDF a Markdown' 'FALLA' 'no se probo: MarkItDown no responde' }
else { try {
  $cli = New-Object System.Net.Http.HttpClient
  $cli.Timeout = [TimeSpan]::FromSeconds(120)
  $form = New-Object System.Net.Http.MultipartFormDataContent
  $pdf = New-Object System.Net.Http.ByteArrayContent(, (PdfPrueba))
  $pdf.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('application/pdf')
  $form.Add($pdf, 'file', 'prueba-harness.pdf')
  # 1.1.4: GetAwaiter().GetResult() deja ver el error real; .Result devolvia null y salia
  # "No se puede llamar a un metodo en una expresion con valor NULL"
  $resp = $cli.PostAsync("http://127.0.0.1:$PuertoMarkItDown/convert", $form).GetAwaiter().GetResult()
  $txt = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $ok = $resp.IsSuccessStatusCode -and $txt -match 'Hola LetXinet'
  Anotar 'MarkItDown' 'PDF a Markdown' $(if ($ok) { 'OK' } else { 'FALLA' }) $(if ($ok) { 'texto extraido correctamente' } else { "HTTP $([int]$resp.StatusCode)" })
} catch { Anotar 'MarkItDown' 'PDF a Markdown' 'FALLA' $(if ($_.Exception.InnerException) { $_.Exception.InnerException.Message } else { $_.Exception.Message }) } }

# 6. Puentes MCP de la 1.1.2 (stdio): V11 + OSM juntos y tareas largas
function PuenteStdio($archivo, $vars, $lineas, $ms = 60000) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo 'node', ('"{0}"' -f $archivo)
  $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
  $psi.RedirectStandardInput = $true; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
  foreach ($k in $vars.Keys) { $psi.EnvironmentVariables[$k] = $vars[$k] }
  $p = [System.Diagnostics.Process]::Start($psi)
  $p.BeginErrorReadLine()
  foreach ($l in $lineas) { $p.StandardInput.WriteLine($l) }
  $resp = @{}; $fin = (Get-Date).AddMilliseconds($ms)
  while ($resp.Count -lt @($lineas | Where-Object { $_ -match '"id"' }).Count -and (Get-Date) -lt $fin) {
    $t = $p.StandardOutput.ReadLineAsync()
    if (-not $t.Wait([Math]::Max(100, ($fin - (Get-Date)).TotalMilliseconds))) { break }
    if ($null -eq $t.Result) { break }
    try { $j = $t.Result | ConvertFrom-Json; if ($null -ne $j.id) { $resp[[int]$j.id] = $j } } catch {}
  }
  try { $p.Kill() } catch {}
  return $resp
}
$puente = Join-Path $App 'bin\mcp\letxinet-mcp-bridge.cjs'
$tareas = Join-Path $App 'bin\mcp\letxinet-jobs-bridge.cjs'
if ((Test-Path $puente) -and (Get-Command node -ErrorAction SilentlyContinue)) {
  $geo = '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"geo_distance","arguments":{"from":{"latitude":-9.07,"longitude":-78.59},"to":{"latitude":-8.98,"longitude":-78.63}}}}'
  $t0 = Get-Date
  $r = PuenteStdio $puente @{ LETXINET_SELECCION = 'ambos'; LETXINET_V11_URL = "http://127.0.0.1:$PuertoV11/api/mcp"; LETXINET_OSM_URL = "http://127.0.0.1:$PuertoOSM/mcp" } @('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}', '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}', $geo)
  $n = @($r[2].result.tools).Count
  $okGeo = ($r[3].result.content | ForEach-Object { $_.text }) -match 'distance'
  Anotar 'Puentes' 'letxinet-ambos (V11 + OSM)' $(if ($n -ge 50 -and $okGeo) { 'OK' } else { 'FALLA' }) "$n herramientas; geo_distance por el puente: $([bool]$okGeo)" ([math]::Round(((Get-Date) - $t0).TotalSeconds))
  $metricas.puente_ambos_herramientas = $n
  foreach ($sel in 'v11', 'osm') {
    $r = PuenteStdio $puente @{ LETXINET_SELECCION = $sel; LETXINET_V11_URL = "http://127.0.0.1:$PuertoV11/api/mcp"; LETXINET_OSM_URL = "http://127.0.0.1:$PuertoOSM/mcp" } @('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}', '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}')
    $n = @($r[2].result.tools).Count
    Anotar 'Puentes' "letxinet-mcp-bridge solo $sel" $(if ($n -ge 25) { 'OK' } else { 'FALLA' }) "$n herramientas"
  }
} else { Anotar 'Puentes' 'letxinet-mcp-bridge' 'AVISO' 'no instalado (llega con la Suite 1.1.2)' }
if ((Test-Path $tareas) -and (Get-Command node -ErrorAction SilentlyContinue)) {
  $r = PuenteStdio $tareas @{ LETXIPU_LOCAL_URL = "http://127.0.0.1:$PuertoV11"; GATEWAY_URL = "http://127.0.0.1:$PuertoDesktop" } @('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}', '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"letxipu_local_call","arguments":{"tool":"list_sources","arguments":{}}}}')
  $okLocal = ($r[2].result.content | ForEach-Object { $_.text }) -match '"success"'
  Anotar 'Puentes' 'letxinet-jobs (V11 directo)' $(if ($okLocal) { 'OK' } else { 'FALLA' }) "letxipu_local_call: $([bool]$okLocal)"
}

# 7. Claude Code y requisitos
$node = Get-Command node -ErrorAction SilentlyContinue
Anotar 'Claude Code' 'Node.js' $(if ($node) { 'OK' } else { 'FALLA' }) $(if ($node) { (& node --version) } else { 'no instalado' })
$cj = Join-Path $env:USERPROFILE '.claude.json'
if (Test-Path $cj) {
  $m = (Get-Content $cj -Raw -Encoding UTF8 | ConvertFrom-Json).mcpServers
  $nombres = @($m.PSObject.Properties.Name)
  # Vale el modo separados (letxinet-v11 + letxinet-osm) o el modo juntos (letxinet-ambos)
  $faltan = @('letxinet-markitdown', 'letxinet-jobs' | Where-Object { $nombres -notcontains $_ })
  if (-not ($nombres -contains 'letxinet-ambos' -or ($nombres -contains 'letxinet-v11' -and $nombres -contains 'letxinet-osm'))) { $faltan += 'letxinet-v11 y letxinet-osm (o letxinet-ambos)' }
  $modoCfg = if ($nombres -contains 'letxinet-ambos' -and $nombres -contains 'letxinet-v11') { 'ambos' } elseif ($nombres -contains 'letxinet-ambos') { 'juntos' } else { 'separados' }
  Anotar 'Claude Code' 'Servidores MCP configurados' $(if (-not $faltan) { 'OK' } else { 'FALLA' }) $(if ($faltan) { 'faltan: ' + ($faltan -join ', ') } else { "modo $modoCfg" })
  $viejos = @($m.PSObject.Properties | Where-Object { ($_.Value | ConvertTo-Json -Compress -Depth 5) -match 'D:/OTROS|D:\\\\OTROS|127\.0\.0\.1:3000' } | ForEach-Object Name)
  Anotar 'Claude Code' 'Sin rutas de desarrollo ni puerto 3000' $(if (-not $viejos) { 'OK' } else { 'AVISO' }) $(if ($viejos) { 'revisar: ' + ($viejos -join ', ') + ' (ejecuta configurar-clientes)' } else { '' })
} else {
  # 1.1.4: Claude Code es opcional; si no esta instalado en este usuario es un aviso, no una falla
  $hayClaude = [bool](Get-Command claude -ErrorAction SilentlyContinue)
  Anotar 'Claude Code' 'Servidores MCP configurados' $(if ($hayClaude) { 'FALLA' } else { 'AVISO' }) $(if ($hayClaude) { 'no existe ~/.claude.json: abre Claude Code una vez y ejecuta "Configurar Claude Code..."' } else { 'Claude Code no esta instalado en este usuario (opcional)' })
}
if ((Test-Path $cj) -or (Get-Command claude -ErrorAction SilentlyContinue)) {
  $set = Join-Path $env:USERPROFILE '.claude\settings.json'
  $to = (Test-Path $set) -and ((Get-Content $set -Raw) -match 'MCP_TOOL_TIMEOUT')
  Anotar 'Claude Code' 'MCP_TOOL_TIMEOUT' $(if ($to) { 'OK' } else { 'AVISO' }) $(if ($to) { 'configurado' } else { 'sin configurar: las busquedas largas pueden cortarse' })
  foreach ($sk in 'letxinet-investigacion-academica', 'letxinet-geo-academico') {
    Anotar 'Claude Code' "Skill $sk" $(if (Test-Path "$env:USERPROFILE\.claude\skills\$sk\SKILL.md") { 'OK' } else { 'AVISO' }) ''
  }
}

# 8. Puertos abiertos a la red (aviso de seguridad, no falla)
$abiertos = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in $PuertoV11, $PuertoOSM, $PuertoMarkItDown, $PuertoDesktop, 9090 -and $_.LocalAddress -in '0.0.0.0', '::' } | ForEach-Object { $_.LocalPort } | Sort-Object -Unique)
Anotar 'Seguridad' 'Puertos abiertos a la red' $(if ($abiertos) { 'AVISO' } else { 'OK' }) $(if ($abiertos) { ($abiertos -join ', ') + ' escuchan en todas las interfaces' } else { 'solo locales' })

# Informe
$ok = @($res | Where-Object Estado -eq 'OK').Count; $av = @($res | Where-Object Estado -eq 'AVISO').Count; $fa = @($res | Where-Object Estado -eq 'FALLA').Count
$nombre = 'harness-letxinet-{0:yyyyMMdd-HHmm}' -f $inicio
$json = [ordered]@{ fecha = $inicio.ToString('s'); equipo = $env:COMPUTERNAME; ok = $ok; avisos = $av; fallas = $fa; metricas = $metricas; resultados = $res }
$json | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $Salida "$nombre.json") -Encoding UTF8
$md = New-Object System.Collections.Generic.List[string]
$md.Add("# Harness LetXinet Suite - $($inicio.ToString('yyyy-MM-dd HH:mm')) - $env:COMPUTERNAME"); $md.Add('')
$md.Add("**Resultado:** $ok OK, $av avisos, $fa fallas. Duracion: $([math]::Round(((Get-Date) - $inicio).TotalSeconds)) s."); $md.Add('')
$md.Add('| Estado | Grupo | Prueba | Detalle | s |'); $md.Add('| --- | --- | --- | --- | --- |')
foreach ($r in $res) { $md.Add("| $($r.Estado) | $($r.Grupo) | $($r.Prueba) | $($r.Detalle -replace '\|', '/') | $($r.Segundos) |") }
if ($Comparar -and (Test-Path $Comparar)) {
  $prev = Get-Content $Comparar -Raw | ConvertFrom-Json
  $md.Add(''); $md.Add("## Comparacion con $(Split-Path $Comparar -Leaf) ($($prev.fecha))"); $md.Add('')
  $md.Add('| Metrica | Antes | Ahora |'); $md.Add('| --- | --- | --- |')
  Write-Host "`nComparacion con el informe anterior:" -ForegroundColor Cyan
  foreach ($k in $metricas.Keys) {
    $antes = $prev.metricas.$k; $ahora = $metricas[$k]
    $md.Add("| $k | $antes | $ahora |")
    Write-Host ('  {0,-28} antes: {1,-20} ahora: {2}' -f $k, "$antes", "$ahora")
  }
  $md.Add(''); $md.Add("Fallas antes: $($prev.fallas) | ahora: $fa")
}
$md | Set-Content (Join-Path $Salida "$nombre.md") -Encoding UTF8
Write-Host ("`nRESUMEN: {0} OK, {1} avisos, {2} fallas" -f $ok, $av, $fa) -ForegroundColor $(if ($fa) { 'Red' } else { 'Green' })
Write-Host "Informe: $(Join-Path $Salida "$nombre.md")"
exit $fa
