# Actualiza LetXinet-Suite.env a la 1.1.6 sin tocar los valores que eligio el usuario.
# Lo ejecuta el instalador (como administrador). Tambien sirve a mano para fijar el contacto de OpenStreetMap:
#   powershell -ExecutionPolicy Bypass -File actualizar-config.ps1 -Contacto tu@correo.com
param(
  [string]$EnvFile = (Join-Path $env:ProgramData 'LetXinet Suite\LetXinet-Suite.env'),
  [string]$Contacto = ''
)
$ErrorActionPreference = 'Stop'
$Version = '1.1.6'
if (-not (Test-Path $EnvFile)) { Write-Host "No existe $EnvFile"; exit 1 }

$lineas = [System.Collections.Generic.List[string]]([IO.File]::ReadAllLines($EnvFile))
function Indice($k) { for ($i = 0; $i -lt $lineas.Count; $i++) { if ($lineas[$i] -match ('^\s*' + [regex]::Escape($k) + '\s*=')) { return $i } }; return -1 }
function Valor($k) { $i = Indice $k; if ($i -ge 0) { return ($lineas[$i] -split '=', 2)[1].Trim() }; return $null }
$cambios = @()

# Ajustes de la 1.1.2: solo se agregan si faltan
$nuevos = [ordered]@{
  'OSM_MCP_URL'            = 'http://127.0.0.1:7082'
  'LETXINET_BIND_HOST'     = '127.0.0.1'
  'OVERPASS_FALLBACK_URLS' = 'https://overpass.openstreetmap.fr/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter'
}
$bloque = @()
foreach ($k in $nuevos.Keys) { if ((Indice $k) -lt 0) { $bloque += "$k=$($nuevos[$k])"; $cambios += $k } }
if ($bloque) {
  $lineas.Add('')
  $lineas.Add('# --- LetXinet Suite 1.1.2 ---')
  $lineas.Add('# OSM_MCP_URL: OSM local que usa V11. LETXINET_BIND_HOST: 127.0.0.1 = solo este equipo; 0.0.0.0 = tambien la red local.')
  $lineas.Add('# OVERPASS_FALLBACK_URLS: espejos de Overpass si el principal falla ("none" lo desactiva).')
  $lineas.Add('# Rutas a pie y en bicicleta reales (el servidor publico por defecto solo tiene coche), si tu red llega a ellos:')
  $lineas.Add('#   OSRM_URL_FOOT=https://routing.openstreetmap.de/routed-foot')
  $lineas.Add('#   OSRM_URL_BIKE=https://routing.openstreetmap.de/routed-bike')
  foreach ($b in $bloque) { $lineas.Add($b) }
}

# 1.1.3: Sci-Hub desactivado. Se vacia solo si tiene la lista que traia la plantilla (no una que haya puesto el usuario).
$listaVieja = 'https://sci-hub.al,https://sci-hub.mk,https://sci-hub.ru,https://sci-hub.su,https://sci-hub.red'
$i = Indice 'SCIHUB_MIRRORS'
if ($i -ge 0 -and (Valor 'SCIHUB_MIRRORS') -eq $listaVieja) {
  $lineas[$i] = 'SCIHUB_MIRRORS='
  $lineas.Insert($i, '# LetXinet 1.1.3: Sci-Hub desactivado por riesgo legal (download_pdf usa solo fuentes abiertas).')
  $cambios += 'SCIHUB_MIRRORS'
}

# 1.1.6: espejos de Overpass. La lista de la 1.1.2 a la 1.1.5 no incluia overpass.openstreetmap.fr, el unico
# que respondio en las pruebas del 10/11/2026, y como este archivo se conserva al actualizar, el espejo nuevo
# nunca se probaba. Se cambia solo si tiene la lista que traia la plantilla (no una que haya puesto el usuario).
$espejosViejos = 'https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter'
$i = Indice 'OVERPASS_FALLBACK_URLS'
if ($i -ge 0 -and (Valor 'OVERPASS_FALLBACK_URLS') -eq $espejosViejos) {
  $lineas[$i] = "OVERPASS_FALLBACK_URLS=$($nuevos['OVERPASS_FALLBACK_URLS'])"
  $cambios += 'OVERPASS_FALLBACK_URLS'
}

# User-Agent de OpenStreetMap: Nominatim exige que identifique la aplicacion (y pide un contacto real)
$ua = Valor 'OSM_USER_AGENT'
$nuevoUa = $null
if ($Contacto) { $nuevoUa = "LetXinet-Suite/$Version (contacto: $Contacto)" }
elseif (-not $ua -or $ua -match 'tudominio|osm-mcp-server') { $nuevoUa = "LetXinet-Suite/$Version" }
elseif ($ua -match '^LetXinet-Suite/1\.1\.\d+' -and $ua -notmatch "^LetXinet-Suite/$([regex]::Escape($Version))") {
  $nuevoUa = $ua -replace '^LetXinet-Suite/1\.1\.\d+', "LetXinet-Suite/$Version"   # conserva el contacto
}
if ($nuevoUa -and $nuevoUa -ne $ua) {
  $i = Indice 'OSM_USER_AGENT'
  if ($i -ge 0) { $lineas[$i] = "OSM_USER_AGENT=$nuevoUa" } else { $lineas.Add("OSM_USER_AGENT=$nuevoUa") }
  $cambios += 'OSM_USER_AGENT'
}

if ($cambios) {
  Copy-Item $EnvFile "$EnvFile.antes-$Version-$(Get-Date -Format yyyyMMdd-HHmmss)" -Force
  [IO.File]::WriteAllLines($EnvFile, $lineas, (New-Object Text.UTF8Encoding($false)))
  Write-Host ("Actualizado: " + ($cambios -join ', '))
} else { Write-Host 'Sin cambios' }
