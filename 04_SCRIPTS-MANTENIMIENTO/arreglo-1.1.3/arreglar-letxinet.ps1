# LetXinet Suite 1.1.3 - arreglo para laptops donde MarkItDown no responde en 7860
# y LetXipu Desktop HF dice "The desktop backend did not start in time".
# 1) MarkItDown usa PyMuPDF, que necesita msvcp140.dll (Visual C++). Si Windows no lo trae,
#    el servicio se reinicia en bucle y nunca abre el puerto. Se copia junto a su Python.
# 2) El Desktop esperaba solo 2 minutos a su backend; en laptops lentas o en el primer
#    arranque (antivirus revisando archivos) tarda mas. Se sube el limite a 10 minutos.
$ErrorActionPreference = 'Continue'
$app = 'C:\Program Files\LetXinet Suite'
$kit = $PSScriptRoot
$rt = Join-Path $app 'MarkItDown\API\python-runtime'
$logd = Join-Path $env:ProgramData 'LetXinet Suite\Logs'
$informe = Join-Path ([Environment]::GetFolderPath('Desktop')) ("arreglo-letxinet-{0:yyyyMMdd-HHmm}.txt" -f (Get-Date))
Start-Transcript -Path $informe | Out-Null
Get-ChildItem $kit -File | Unblock-File -ErrorAction SilentlyContinue

function Paso($t) { Write-Host ''; Write-Host "== $t" -ForegroundColor Cyan }
function Ok($t) { Write-Host "  [OK]    $t" -ForegroundColor Green }
function Mal($t) { Write-Host "  [FALLA] $t" -ForegroundColor Red }
function Info($t) { Write-Host "  $t" }
function ProbarPython {
  $py = Join-Path $rt 'python.exe'
  $o = & $py -c "import pymupdf, pymupdf4llm, fastapi, uvicorn; print('IMPORT_OK')" 2>&1 | Out-String
  return $o
}

Write-Host "Arreglo LetXinet Suite 1.1.3 - $env:COMPUTERNAME - $(Get-Date)"
if (-not (Test-Path (Join-Path $rt 'python.exe'))) { Mal "No encuentro LetXinet Suite en $app"; Stop-Transcript | Out-Null; exit 1 }

Paso '1. Por que MarkItDown no responde'
$err = Join-Path $logd 'markitdown-api.stderr.log'
if (Test-Path $err) { Info 'Ultimas lineas del registro de MarkItDown:'; Get-Content $err -Tail 6 | ForEach-Object { Info "  $_" } }
$antes = ProbarPython
if ($antes -match 'IMPORT_OK') { Ok 'El Python de MarkItDown carga PyMuPDF' }
else { Mal 'El Python de MarkItDown no carga PyMuPDF:'; ($antes.Trim() -split "`n" | Select-Object -Last 2) | ForEach-Object { Info "  $_" } }

Paso '2. Componente Visual C++ (msvcp140.dll)'
$sys = Join-Path $env:WINDIR 'System32\msvcp140.dll'
if (Test-Path $sys) { Ok 'msvcp140.dll ya esta en Windows' }
elseif (Test-Path (Join-Path $rt 'msvcp140.dll')) { Ok 'msvcp140.dll ya estaba junto a MarkItDown' }
else {
  Copy-Item (Join-Path $kit 'msvcp140.dll') $rt -Force
  if (Test-Path (Join-Path $rt 'msvcp140.dll')) { Ok 'Faltaba: msvcp140.dll copiado junto al Python de MarkItDown' } else { Mal 'No se pudo copiar msvcp140.dll' }
}
if ($antes -notmatch 'IMPORT_OK') {
  $despues = ProbarPython
  if ($despues -match 'IMPORT_OK') { Ok 'Ahora PyMuPDF si carga' }
  else { Mal 'PyMuPDF sigue sin cargar:'; ($despues.Trim() -split "`n" | Select-Object -Last 2) | ForEach-Object { Info "  $_" } }
}

Paso '3. Puerto 7860'
$c = Get-NetTCPConnection -LocalPort 7860 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($c) {
  $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
  if ($p.ProcessName -eq 'python') { Info "Lo usa python (PID $($p.Id)), que es MarkItDown" }
  else { Mal "Lo ocupa otro programa: $($p.ProcessName) (PID $($p.Id)). Cierralo o desinstalalo y vuelve a correr este arreglo." }
} else { Info 'Libre (MarkItDown aun no lo abre)' }

Paso '4. Reiniciar el servicio MarkItDown'
try { Restart-Service LetXinetSuiteMarkitDown -Force -ErrorAction Stop; Info 'Servicio reiniciado; esperando hasta 2 minutos...' } catch { Mal "No se pudo reiniciar: $($_.Exception.Message)" }
$listo = $false; $t0 = Get-Date
while (-not $listo -and ((Get-Date) - $t0).TotalSeconds -lt 120) {
  Start-Sleep 3
  try { $r = Invoke-WebRequest 'http://127.0.0.1:7860/' -UseBasicParsing -TimeoutSec 5; if ($r.Content -match 'online') { $listo = $true } } catch {}
}
if ($listo) { Ok ("MarkItDown responde en 7860 (tardo {0:N0} s)" -f ((Get-Date) - $t0).TotalSeconds) }
else { Mal 'MarkItDown sigue sin responder. Mandale a Claude una foto de esta ventana.'; if (Test-Path $err) { Get-Content $err -Tail 4 | ForEach-Object { Info "  $_" } } }

Paso '5. LetXipu Desktop HF: mas tiempo para arrancar'
$m = Join-Path $app 'LetXinet-Desktop\resources\app\electron\main.cjs'
if (Test-Path $m) {
  $txt = [IO.File]::ReadAllText($m)
  if ($txt.Contains('timeoutMs = 120000')) {
    $bak = "$m.orig-1.1.3"; if (-not (Test-Path $bak)) { Copy-Item $m $bak }
    Get-Process 'LetXipu Desktop HF' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    [IO.File]::WriteAllText($m, $txt.Replace('timeoutMs = 120000', 'timeoutMs = 600000'), (New-Object Text.UTF8Encoding $false))
    Ok 'El Desktop ahora espera hasta 10 minutos a su backend (antes 2)'
  } elseif ($txt.Contains('timeoutMs = 600000')) { Ok 'Ya estaba en 10 minutos' }
  else { Info 'No encontre el limite de espera; no se cambio nada' }
} else { Info 'El Desktop no esta instalado en esta laptop' }
$ml = Join-Path $env:TEMP 'letxipu-desktop-main.log'
if (Test-Path $ml) { Info 'Ultimo intento de abrir el Desktop:'; Get-Content $ml -Tail 4 | ForEach-Object { Info "  $_" } }

Paso '6. Claude Code'
if (Test-Path (Join-Path $env:USERPROFILE '.claude.json')) {
  Info 'Configurando Claude Code, Claude Desktop y OpenCode...'
  & node (Join-Path $app 'bin\configurar-clientes.cjs') --modo separados --silencioso 2>&1 | Select-Object -Last 6 | ForEach-Object { Info "  $_" }
} else {
  Info 'Claude Code no esta instalado (o nunca se abrio) en esta laptop. Por eso salia esa FALLA.'
  Info 'Si lo vas a usar: instalalo, abrelo una vez y luego corre en el menu Inicio'
  Info '"Configurar Claude Code, Claude Desktop y OpenCode".'
}

Write-Host ''
Write-Host "Listo. Este resumen quedo en: $informe" -ForegroundColor Cyan
Write-Host 'Ahora abre LetXinet Desktop (la primera vez puede tardar unos minutos) y,'
Write-Host 'si quieres comprobar todo, menu Inicio > "Probar LetXinet Suite".'
Stop-Transcript | Out-Null
