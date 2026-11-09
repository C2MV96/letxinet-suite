# LetXinet Suite - arreglo 2: MarkItDown en laptops con procesador antiguo.
# PyMuPDF4LLM (el motor de MarkItDown) usa numpy. La version que trae la Suite (2.5.1) exige
# un procesador con SSE4.2 (x86-64-v2). En procesadores anteriores Windows no puede cargarla:
#   "DLL load failed while importing _multiarray_umath: Error en una rutina de inicializacion..."
# Este arreglo pone numpy 2.3.5, que funciona desde SSE3, y guarda el numpy original en
# python-runtime\respaldo-numpy-original para poder volver atras.
param([string]$App = 'C:\Program Files\LetXinet Suite', [string]$Informe = '', [switch]$Forzar)
$ErrorActionPreference = 'Continue'
$app = $App
$kit = $PSScriptRoot
$rt = Join-Path $app 'MarkItDown\API\python-runtime'
$py = Join-Path $rt 'python.exe'
$spk = Join-Path $rt 'Lib\site-packages'
$resp = Join-Path $rt 'respaldo-numpy-original'
$whl = Join-Path $kit 'numpy-2.3.5-cp312-cp312-win_amd64.whl'
$svc = 'LetXinetSuiteMarkitDown'
$logd = Join-Path $env:ProgramData 'LetXinet Suite\Logs'
$informe = if ($Informe) { $Informe } else { Join-Path ([Environment]::GetFolderPath('Desktop')) ("arreglo2-letxinet-{0:yyyyMMdd-HHmm}.txt" -f (Get-Date)) }
Start-Transcript -Path $informe | Out-Null
Get-ChildItem $kit -File | Unblock-File -ErrorAction SilentlyContinue

function Paso($t) { Write-Host ''; Write-Host "== $t" -ForegroundColor Cyan }
function Ok($t) { Write-Host "  [OK]    $t" -ForegroundColor Green }
function Mal($t) { Write-Host "  [FALLA] $t" -ForegroundColor Red }
function Info($t) { Write-Host "  $t" }
function Probar([string]$codigo) {
  $f = Join-Path $env:TEMP 'letxinet-prueba.py'
  Set-Content -Path $f -Value $codigo -Encoding ascii
  $o = & $py -I $f 2>&1 | Out-String
  Remove-Item $f -ErrorAction SilentlyContinue
  return $o
}
function Ultimas($texto, $n) {
  ($texto.Trim() -split "`n" | Where-Object { $_.Trim() -and $_ -notmatch '^\s*(\+|En l.nea|CategoryInfo|FullyQualifiedErrorId)' } | Select-Object -Last $n) | ForEach-Object { Info "  $($_.Trim())" }
}
$codNumpy = "import numpy`nprint('NUMPY_OK', numpy.__version__)"
$codPdf = @'
import os, tempfile
import pymupdf, pymupdf4llm, fastapi, uvicorn
p = os.path.join(tempfile.gettempdir(), 'letxinet-prueba.pdf')
d = pymupdf.open(); pg = d.new_page()
pg.insert_text((72, 72), 'Prueba de LetXinet MarkItDown', fontsize=16)
d.save(p); d.close()
md = pymupdf4llm.to_markdown(p); os.remove(p)
print('PDF_OK', len(md))
'@
function VersionNumpy { (Get-ChildItem $spk -Directory -Filter 'numpy-*.dist-info' | Select-Object -First 1).Name -replace '^numpy-|\.dist-info$', '' }
function DetenerServicio {
  Stop-Service $svc -Force -ErrorAction SilentlyContinue
  Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$rt*" } | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

Write-Host "Arreglo 2 de LetXinet Suite (MarkItDown) - $env:COMPUTERNAME - $(Get-Date)"
if (-not (Test-Path $py)) { Mal "No encuentro LetXinet Suite en $app"; Stop-Transcript | Out-Null; exit 1 }
if (-not (Test-Path $whl)) { Mal "Falta $whl junto a este script. Descomprime el zip completo y vuelve a intentar."; Stop-Transcript | Out-Null; exit 1 }

Paso '1. Procesador de esta laptop'
$cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name
Info "Procesador: $($cpu.Trim())"
try {
  Add-Type -Namespace LX -Name Cpu -MemberDefinition '[DllImport("kernel32.dll")] public static extern bool IsProcessorFeaturePresent(uint f);' -ErrorAction Stop
  $feat = [ordered]@{ 'SSE3' = 13; 'SSSE3' = 36; 'SSE4.1' = 37; 'SSE4.2' = 38; 'AVX' = 39; 'AVX2' = 40 }
  $si = @(); $no = @()
  foreach ($k in $feat.Keys) { if ([LX.Cpu]::IsProcessorFeaturePresent($feat[$k])) { $si += $k } else { $no += $k } }
  Info "Tiene:    $($si -join ', ')"
  Info "No tiene: $(if ($no) { $no -join ', ' } else { '(nada de la lista)' })"
  if ($no -contains 'SSE4.2') { Info 'Sin SSE4.2 el numpy 2.5.1 de la Suite no puede cargar. Por eso fallaba MarkItDown.' }
} catch { Info "No se pudieron leer las instrucciones del procesador: $($_.Exception.Message)" }

Paso '2. numpy actual'
$vAntes = VersionNumpy
$r = Probar $codNumpy
if ($r -match 'NUMPY_OK') { Ok "numpy $vAntes carga bien en esta laptop; no hace falta cambiarlo" ; $cambiar = $false }
else { Mal "numpy $vAntes no carga:"; Ultimas $r 2; $cambiar = $true }
if ($Forzar -and -not $cambiar) { Info '(prueba: se fuerza el cambio de numpy)'; $cambiar = $true }

if ($cambiar) {
  Paso '3. Poner numpy 2.3.5 (compatible con procesadores antiguos)'
  if ($vAntes -eq '2.3.5') {
    Mal 'Ya tiene numpy 2.3.5 y tampoco carga. Mandale a Claude una foto de esta ventana.'
  } else {
    DetenerServicio
    New-Item -ItemType Directory -Force $resp | Out-Null
    $movidos = @()
    foreach ($d in (Get-ChildItem $spk -Directory | Where-Object { $_.Name -eq 'numpy' -or $_.Name -eq 'numpy.libs' -or $_.Name -like 'numpy-*.dist-info' })) {
      $dest = Join-Path $resp $d.Name
      if (Test-Path $dest) { $dest = "$dest-$(Get-Date -Format yyyyMMddHHmmss)" }
      Move-Item $d.FullName $dest
      $movidos += [pscustomobject]@{ Nombre = $d.Name; Respaldo = $dest }
    }
    Info "numpy $vAntes guardado en $resp"
    try {
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      [IO.Compression.ZipFile]::ExtractToDirectory($whl, $spk)
      $r2 = Probar $codNumpy
    } catch { $r2 = "No se pudo descomprimir: $($_.Exception.Message)" }
    if ($r2 -match 'NUMPY_OK') {
      Ok "numpy 2.3.5 carga bien"
    } else {
      Mal 'numpy 2.3.5 tampoco carga:'; Ultimas $r2 2
      $r3 = & cmd /c "set OPENBLAS_NUM_THREADS=1&& `"$py`" -I -c `"import numpy; print('NUMPY_OK')`" 2>&1" | Out-String
      if ($r3 -match 'NUMPY_OK') {
        Ok 'Carga si se limita OpenBLAS a 1 hilo; se configura asi el servicio'
        $k = "HKLM:\SYSTEM\CurrentControlSet\Services\$svc\Parameters"
        $cur = @((Get-ItemProperty $k -Name AppEnvironmentExtra -ErrorAction SilentlyContinue).AppEnvironmentExtra | Where-Object { $_ -and $_ -notmatch '^OPENBLAS_NUM_THREADS=' })
        New-ItemProperty $k -Name AppEnvironmentExtra -PropertyType MultiString -Value ($cur + 'OPENBLAS_NUM_THREADS=1') -Force | Out-Null
      } else {
        Info 'Se deja el numpy original como estaba.'
        $nuevo = Join-Path $resp ("numpy-2.3.5-no-funciono-{0:yyyyMMddHHmmss}" -f (Get-Date))
        New-Item -ItemType Directory -Force $nuevo | Out-Null
        Get-ChildItem $spk -Directory | Where-Object { $_.Name -eq 'numpy' -or $_.Name -eq 'numpy.libs' -or $_.Name -like 'numpy-*.dist-info' } | Move-Item -Destination $nuevo
        foreach ($m in $movidos) { Move-Item $m.Respaldo (Join-Path $spk $m.Nombre) }
      }
    }
  }
}

Paso '4. Probar la conversion de PDF a Markdown (sin el servicio)'
$env:OPENBLAS_NUM_THREADS = $null
$k = "HKLM:\SYSTEM\CurrentControlSet\Services\$svc\Parameters"
if (@((Get-ItemProperty $k -Name AppEnvironmentExtra -ErrorAction SilentlyContinue).AppEnvironmentExtra) -contains 'OPENBLAS_NUM_THREADS=1') { $env:OPENBLAS_NUM_THREADS = '1' }
$rp = Probar $codPdf
if ($rp -match 'PDF_OK') { Ok "El motor de MarkItDown convierte PDF (numpy $(VersionNumpy))" }
else { Mal 'El motor de MarkItDown todavia no convierte PDF:'; Ultimas $rp 4 }

Paso '5. Reiniciar el servicio MarkItDown'
DetenerServicio
try { Start-Service $svc -ErrorAction Stop; Info 'Servicio iniciado; esperando hasta 2 minutos...' } catch { Mal "No se pudo iniciar: $($_.Exception.Message)" }
$listo = $false; $t0 = Get-Date
while (((Get-Date) - $t0).TotalSeconds -lt 120) {
  try { $h = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 'http://127.0.0.1:7860/'; if ($h.Content -match 'online') { $listo = $true; break } } catch {}
  Start-Sleep -Seconds 3
}
if ($listo) { Ok ("MarkItDown responde en el puerto 7860 (tardo {0:N0} s)" -f ((Get-Date) - $t0).TotalSeconds) }
else {
  Mal 'MarkItDown sigue sin responder. Mandale a Claude una foto de esta ventana.'
  $err = Join-Path $logd 'markitdown-api.stderr.log'
  if (Test-Path $err) { Info 'Ultimas lineas del registro:'; Get-Content $err -Tail 8 | ForEach-Object { Info "  $_" } }
}

Write-Host ''
Write-Host "Listo. Este resumen quedo en: $informe" -ForegroundColor Cyan
Write-Host 'Para comprobar todo: menu Inicio > "Probar LetXinet Suite".'
Stop-Transcript | Out-Null
