# Recompila LetXinet Suite desde estas fuentes y genera el instalador Variante B (sin claves).
#
# Compila V11 (tsc + .exe con yao-pkg), Desktop HF (vite + esbuild) y OSM (Go), y copia MarkItDown.
# Los runtimes que no son codigo fuente (Electron, node_modules, Python) se toman de una Suite
# ya instalada en esta PC, sin claves, porque pesan 1,5 GB y no cambian.
#
# Uso normal (doble clic en recompilar-todo.cmd). Requisitos: LetXinet Suite instalada, Node.js 22 o
# superior, Go 1.24 o superior, Inno Setup 6.3 o superior, internet para "npm ci" y unos 6 GB libres.
# Tarda de 30 a 40 minutos.
#
#   -Trabajo             Carpeta de trabajo (por defecto C:\LetXinet-Recompilado; evita carpetas de OneDrive)
#   -Instalado           Suite instalada de donde salen los runtimes
#   -NodeModulesV11      Reusar un node_modules de V11 en vez de ejecutar npm ci
#   -NodeModulesDesktop  Reusar un node_modules de Desktop en vez de ejecutar npm ci
#   -SinInstalador       Compila y arma el payload, sin ejecutar Inno Setup
#   -SoloInstalador      Solo ejecuta Inno Setup sobre un payload ya armado
param(
  [string]$Trabajo = (Join-Path $env:SystemDrive 'LetXinet-Recompilado'),
  [string]$Instalado = 'C:\Program Files\LetXinet Suite',
  [string]$NodeModulesV11,
  [string]$NodeModulesDesktop,
  [switch]$SinInstalador,
  [switch]$SoloInstalador
)
$ErrorActionPreference = 'Stop'
$Fuente = $PSScriptRoot
# El binario de Electron que descarga "npm ci" del Desktop no se usa (el runtime sale de la Suite instalada)
$env:ELECTRON_SKIP_BINARY_DOWNLOAD = '1'
$comp = Join-Path $Trabajo '_compilar'
$src = Join-Path $Trabajo 'src-suite'
$pl = Join-Path $src 'componentes-parches'
function Paso($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Falla($t) { Write-Host "ERROR: $t" -ForegroundColor Red; exit 1 }
function Copiar($o, $d, [string[]]$extra = @()) {
  & robocopy $o $d /E /XJ /NFL /NDL /NJH /NJS /NP /R:1 /W:1 @extra | Out-Null
  if ($LASTEXITCODE -ge 8) { Falla "robocopy no pudo copiar $o (codigo $LASTEXITCODE)" }
  $global:LASTEXITCODE = 0
}
function Modulos($carpeta, $reusar) {
  $nm = Join-Path $carpeta 'node_modules'
  if (Test-Path $nm) {
    # Un enlace a otro node_modules o una instalación terminada se reutilizan; una a medias se rehace
    if ((Get-Item $nm -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { return }
    if (Test-Path (Join-Path $nm '.package-lock.json')) { return }
    Remove-Item $nm -Recurse -Force
  }
  if ($reusar) {
    & cmd /c mklink /J "$nm" "$reusar" | Out-Null
  } else {
    Push-Location $carpeta
    # npm escribe avisos en stderr: se redirigen para que PowerShell no los tome como error
    & cmd /c "npm ci --no-audit --no-fund 2>&1"
    $rc = $LASTEXITCODE
    Pop-Location
    if ($rc -ne 0) { Falla "npm ci fallo en $carpeta" }
  }
}

$innoReg = Get-ItemProperty 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Inno Setup 6_is1', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Inno Setup 6_is1', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Inno Setup 6_is1' -ErrorAction SilentlyContinue
$iscc = @(
  (Get-Command ISCC.exe -ErrorAction SilentlyContinue).Source
  $innoReg | ForEach-Object { if ($_.InstallLocation) { Join-Path $_.InstallLocation 'ISCC.exe' } }
  (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe')
  $(if (${env:ProgramFiles(x86)}) { Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe' })
  (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $SoloInstalador) {
  Paso '1. Comprobar herramientas y espacio'
  foreach ($c in 'node', 'go') { if (-not (Get-Command $c -ErrorAction SilentlyContinue)) { Falla "falta $c" } }
  $vNode = [int](((& node -p 'process.versions.node') -split '\.')[0])
  if ($vNode -lt 22) { Falla "hace falta Node.js 22 o superior (hay $vNode)" }
  $vGo = (& go env GOVERSION) -replace '^go', ''
  if ([version]($vGo -replace '[^\d\.].*$', '') -lt [version]'1.21') { Falla "hace falta Go 1.24 o superior (hay $vGo)" }
  if ([version]($vGo -replace '[^\d\.].*$', '') -lt [version]'1.24.1') { Write-Host "Aviso: Go $vGo descargara el toolchain 1.24.5 (necesita internet)" -ForegroundColor Yellow }
  if (-not $SinInstalador -and -not $iscc) { Falla 'falta Inno Setup 6.3 o superior' }
  $libre = (Get-PSDrive ($Trabajo.Substring(0, 1))).Free / 1GB
  # 1.1.4: si el arbol de build ya existe (recompilacion), basta con espacio para el instalador nuevo
  $minimo = if (Test-Path (Join-Path $pl '.copia-completa')) { 1 } else { 4 }
  if ($libre -lt $minimo) { Falla ('hay {0:N1} GB libres en la unidad de trabajo; hacen falta {1}' -f $libre, $(if ($minimo -eq 1) { 'al menos 1 (recompilacion)' } else { 'unos 6' })) }
  # Binario base de Node 22 para empaquetar V11: se incluye en el paquete para no depender de GitHub
  $pkgBase = Join-Path $Fuente 'herramientas\pkg-cache\v3.6\fetched-v22.23.1-win-x64'
  $pkgDest = Join-Path $env:USERPROFILE '.pkg-cache\v3.6\fetched-v22.23.1-win-x64'
  if ((Test-Path $pkgBase) -and -not (Test-Path $pkgDest)) {
    New-Item -ItemType Directory -Force (Split-Path $pkgDest) | Out-Null
    Copy-Item $pkgBase $pkgDest
  }

  Paso '2. Preparar el arbol de build'
  New-Item -ItemType Directory -Force $src, $comp | Out-Null
  Copiar (Join-Path $Fuente 'instalador\instalador') (Join-Path $src 'instalador')
  Copiar (Join-Path $Fuente 'instalador\shared-env') (Join-Path $src 'shared-env')
  Copiar (Join-Path $Fuente 'instalador\variant-tokens') (Join-Path $Trabajo 'variant-tokens')

  Paso '3. Runtimes desde la Suite instalada (sin claves, logs ni respaldos)'
  # La marca se escribe al final: si la copia se corta, la siguiente ejecucion la completa (robocopy es incremental)
  $marca = Join-Path $pl '.copia-completa'
  if (-not (Test-Path $marca)) {
    if (-not (Test-Path (Join-Path $Instalado 'LetXinet-Desktop'))) { Falla "no encuentro la Suite instalada en $Instalado" }
    $fuera = @('/XF', '.env', '.env.*', 'secrets.json', '*.bak', '*.bak-*', '*.log', 'openalex-state.json', '/XD', '.cache', '__pycache__', 'logs', '*.bak', '*.bak-*')
    Copiar (Join-Path $Instalado 'LetXinet-Desktop') (Join-Path $pl 'letxinet-desktop') $fuera
    Copiar (Join-Path $Instalado 'MCP-V11-Local') (Join-Path $pl 'mcp-v11-local') $fuera
    Copiar (Join-Path $Instalado 'MarkItDown\API') (Join-Path $pl 'markitdown-api\markitdown-payload') $fuera
    Copiar (Join-Path $Instalado 'OSM-MCP') (Join-Path $pl 'osm-mcp') $fuera
    Set-Content $marca (Get-Date -Format s)
  } else { Write-Host 'Ya existe; se reutiliza.' }

  Paso '4. Compilar MCP-V11 (tsc y .exe)'
  $v = Join-Path $comp 'v11'
  New-Item -ItemType Directory -Force $v | Out-Null
  foreach ($d in 'src', 'dist') { if (Test-Path "$v\$d") { Remove-Item "$v\$d" -Recurse -Force } }
  Copiar (Join-Path $Fuente 'mcp-v11-local\src') "$v\src"
  Copy-Item (Join-Path $Fuente 'mcp-v11-local\package.json'), (Join-Path $Fuente 'mcp-v11-local\package-lock.json'), (Join-Path $Fuente 'mcp-v11-local\tsconfig.json') $v -Force
  Modulos $v $NodeModulesV11
  Push-Location $v
  & cmd /c "node node_modules\typescript\bin\tsc -p tsconfig.json 2>&1"
  if ($LASTEXITCODE -ne 0) { Pop-Location; Falla 'tsc fallo en V11' }
  $pkgBin = 'node_modules\@yao-pkg\pkg\lib-es5\bin.js'
  # El servicio ejecuta el codigo embebido en el .exe: sin este paso los parches no se activan.
  if (Test-Path $pkgBin) { & cmd /c "node `"$pkgBin`" . --targets node22-win-x64 --output MCP-V11-Local.exe 2>&1" }
  else { & cmd /c "npx --yes @yao-pkg/pkg@6.21.0 . --targets node22-win-x64 --output MCP-V11-Local.exe 2>&1" }
  $rc = $LASTEXITCODE
  Pop-Location
  if ($rc -ne 0 -or -not (Test-Path "$v\MCP-V11-Local.exe")) { Falla 'no se pudo generar MCP-V11-Local.exe' }
  $d11 = Join-Path $pl 'mcp-v11-local'
  Copy-Item "$v\MCP-V11-Local.exe" $d11 -Force
  & robocopy "$v\dist" "$d11\dist" /MIR /XJ /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
  if ($LASTEXITCODE -ge 8) { Falla 'no se pudo copiar dist de V11' }
  Copiar "$v\src\python" "$d11\python"
  if (-not (Test-Path "$d11\SPACY_DISABLED")) { Set-Content "$d11\SPACY_DISABLED" 'spaCy desactivado de fabrica. Borra este archivo y reinicia el servicio para activarlo.' }

  Paso '5. Compilar Desktop HF (vite y esbuild)'
  $w = Join-Path $comp 'desktop'
  New-Item -ItemType Directory -Force $w | Out-Null
  foreach ($d in 'src', 'public', 'electron', 'scripts', 'assets', 'data', 'dist') { if (Test-Path "$w\$d") { Remove-Item "$w\$d" -Recurse -Force } }
  & robocopy (Join-Path $Fuente 'desktop-hf') $w /E /XJ /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
  if ($LASTEXITCODE -ge 8) { Falla 'no se pudo copiar Desktop' }
  Modulos $w $NodeModulesDesktop
  Push-Location $w
  $env:BUILD_VARIANT = 'public'
  & cmd /c "node node_modules\vite\bin\vite.js build 2>&1"
  if ($LASTEXITCODE -ne 0) { Pop-Location; Falla 'vite fallo' }
  & cmd /c "node node_modules\esbuild\bin\esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs --define:process.env.NODE_ENV=\`"production\`" 2>&1"
  if ($LASTEXITCODE -ne 0) { Pop-Location; Falla 'esbuild fallo' }
  Pop-Location
  $app = Join-Path $pl 'letxinet-desktop\resources\app'
  Get-ChildItem "$app\dist\assets\index-*" -ErrorAction SilentlyContinue | Remove-Item -Force
  Copiar "$w\dist" "$app\dist"
  Copy-Item "$w\electron\*" "$app\electron" -Force
  New-Item -ItemType Directory -Force "$app\dist\data" | Out-Null
  foreach ($n in 'nvidia', 'opencode', 'openrouter') { Copy-Item "$w\data\${n}_models.json" "$app\dist\data" -Force }

  Paso '6. Compilar OSM-MCP (Go)'
  $env:CGO_ENABLED = '0'; $env:GOFLAGS = '-mod=vendor'; $env:GOCACHE = Join-Path $comp 'gocache'
  Push-Location (Join-Path $Fuente 'osm-mcp')
  $goBuild = "go build -trimpath -buildvcs=false -o `"$(Join-Path $comp 'osmmcp.exe')`" ./cmd/osmmcp 2>&1"
  & cmd /c $goBuild
  $rc = $LASTEXITCODE
  if ($rc -ne 0) {
    # Una compilacion interrumpida puede dejar la cache de Go danada: se borra y se reintenta una vez
    Write-Host 'go build fallo; se limpia la cache de Go y se reintenta'
    Remove-Item $env:GOCACHE -Recurse -Force -ErrorAction SilentlyContinue
    & cmd /c $goBuild
    $rc = $LASTEXITCODE
  }
  Pop-Location
  Remove-Item Env:GOFLAGS -ErrorAction SilentlyContinue
  if ($rc -ne 0) { Falla 'go build fallo' }
  Copy-Item (Join-Path $comp 'osmmcp.exe') (Join-Path $pl 'osm-mcp\osmmcp.exe') -Force

  Paso '7. MarkItDown (Python, no se compila)'
  $md = Join-Path $pl 'markitdown-api\markitdown-payload'
  Copy-Item (Join-Path $Fuente 'markitdown-api\app.py'), (Join-Path $Fuente 'markitdown-api\requirements.txt') $md -Force
  Copiar (Join-Path $Fuente 'markitdown-api\mcp-adapter') "$md\mcp-adapter"
  # 1.1.4: PyMuPDF y el Python de V11 necesitan msvcp140.dll (Visual C++). El Python embebido solo trae
  # vcruntime140; en laptops sin Visual C++ MarkItDown se reiniciaba en bucle sin abrir el puerto 7860.
  $vc = Join-Path $Fuente 'runtime-extra\msvcp140.dll'
  if (-not (Test-Path $vc)) { Falla "falta $vc" }
  foreach ($rt in "$md\python-runtime", "$d11\python-runtime") { Copy-Item $vc $rt -Force }
  # 1.1.5: numpy 2.5.1 exige SSE4.2 (x86-64-v2). En procesadores anteriores MarkItDown no arrancaba
  # ("DLL load failed while importing _multiarray_umath"). Se usa numpy 2.3.5, que funciona desde SSE3.
  $whl = Join-Path $Fuente 'runtime-extra\numpy-2.3.5-cp312-cp312-win_amd64.whl'
  if (-not (Test-Path $whl)) { Falla "falta $whl (ver runtime-extra\LEEME.txt)" }
  $spk = "$md\python-runtime\Lib\site-packages"
  $npActual = (Get-ChildItem $spk -Directory -Filter 'numpy-*.dist-info' | Select-Object -First 1).Name
  if ($npActual -ne 'numpy-2.3.5.dist-info') {
    Get-ChildItem $spk -Directory | Where-Object { $_.Name -eq 'numpy' -or $_.Name -eq 'numpy.libs' -or $_.Name -like 'numpy-*.dist-info' } | Remove-Item -Recurse -Force
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($whl, $spk)
    Write-Host "numpy de MarkItDown: $npActual -> numpy-2.3.5"
  }

  Paso '8. Comprobar que no queden claves'
  $patron = 'sk-or-v1-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{24,}|AIza[0-9A-Za-z_-]{30,}|gsk_[A-Za-z0-9]{20,}|nvapi-[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,}'
  $revisar = @(
    Get-ChildItem "$app\dist" -File | Where-Object { $_.Extension -in '.cjs', '.map', '.html', '.js' }
    Get-ChildItem "$app\dist\assets" -File
    Get-ChildItem "$app\electron" -File
    Get-ChildItem "$d11\dist" -Recurse -File -Include *.js
    Get-Item (Join-Path $src 'shared-env\LetXinet-Suite.env')
    Get-Item (Join-Path $Trabajo 'variant-tokens\variantB-publico\.env')
  )
  $hallados = $revisar | Select-String -Pattern $patron -List
  if ($hallados) { $hallados | ForEach-Object { Write-Host "Clave en: $($_.Path)" -ForegroundColor Red }; Falla 'se encontraron claves; no se genera el instalador' }
  if (Test-Path (Join-Path $pl 'letxinet-desktop\resources\secrets.json')) { Falla 'el payload contiene secrets.json' }
  Write-Host 'Sin claves.'
  foreach ($rt in "$md\python-runtime", "$d11\python-runtime") { if (-not (Test-Path "$rt\msvcp140.dll")) { Falla "falta msvcp140.dll en $rt" } }
  Write-Host 'msvcp140.dll incluido en los dos Python.'
  if (-not (Test-Path "$md\python-runtime\Lib\site-packages\numpy-2.3.5.dist-info")) { Falla 'MarkItDown no tiene numpy 2.3.5' }
  # Con 'Stop', PowerShell 5.1 toma como error cualquier aviso que Python escriba en stderr
  $eap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $prueba = & "$md\python-runtime\python.exe" -I -c "import numpy, pymupdf4llm; print('NUMPY', numpy.__version__)" 2>&1 | Out-String
  $ErrorActionPreference = $eap
  if ($prueba -notmatch 'NUMPY 2\.3\.5') { Falla "el Python de MarkItDown no carga numpy 2.3.5 con PyMuPDF4LLM: $($prueba.Trim())" }
  Write-Host 'MarkItDown carga numpy 2.3.5 y PyMuPDF4LLM.'
}

if ($SinInstalador) { Write-Host "`nPayload listo en $pl"; exit 0 }

Paso '9. Generar el instalador (Inno Setup, unos 20 minutos)'
if (-not $iscc) { Falla 'falta Inno Setup 6.3 o superior' }
$usadas = @(Get-PSDrive -PSProvider FileSystem | ForEach-Object Name) + @(Get-CimInstance Win32_LogicalDisk -ErrorAction SilentlyContinue | ForEach-Object { $_.DeviceID.TrimEnd(':') })
$letra = 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z' | Where-Object { $usadas -notcontains $_ -and -not (Test-Path "${_}:\") } | Select-Object -First 1
if (-not $letra) { Falla 'no hay una letra de unidad libre' }
$sal = Join-Path $Trabajo 'installer-output\variantB'
New-Item -ItemType Directory -Force $sal | Out-Null
& subst "${letra}:" $pl
if ($LASTEXITCODE -ne 0 -or -not (Test-Path "${letra}:\osm-mcp")) { & subst "${letra}:" /D 2>$null; Falla "no se pudo asignar la unidad ${letra}: al payload" }
try {
  $ErrorActionPreference = 'Continue'
  & $iscc /Q /DVARIANT_B "/DPAYLOAD_ROOT=${letra}:\" "/O$sal" (Join-Path $src 'instalador\LetXinet-Suite.iss')
  $rc = $LASTEXITCODE
} finally { & subst "${letra}:" /D; $ErrorActionPreference = 'Stop' }
if ($rc -ne 0) { Falla "Inno Setup termino con codigo $rc" }

$h = Join-Path $sal 'HASHES-SHA256-VariantB.txt'
Get-ChildItem $sal -File | Where-Object { $_.Name -like 'LetXinet-Suite-*' } | ForEach-Object { '{0}  {1}' -f (Get-FileHash $_.FullName).Hash, $_.Name } | Set-Content $h
Get-Content $h
Write-Host "`nListo. Instalador en: $sal" -ForegroundColor Green
