# Desactiva el sidecar spaCy de LetXinet V11 (modo JSON-only) y reinicia el servicio.
# Reversible con reactivar-spacy.cmd.
$ErrorActionPreference = 'Stop'
$suite    = 'C:\Program Files\LetXinet Suite'
$launcher = Join-Path $suite 'bin\start-mcp-v11-local.cmd'
$flag     = Join-Path $suite 'MCP-V11-Local\SPACY_DISABLED'
$backup   = "$launcher.bak-spacy"

$text = [System.IO.File]::ReadAllText($launcher)
if ($text -notmatch 'SPACY_DISABLED') {
    if (-not (Test-Path $backup)) { Copy-Item $launcher $backup }
    $anchor = 'set "SPACY_SCRIPT=%INSTALL_DIR%\MCP-V11-Local\python\spacy_server.py"'
    if (-not $text.Contains($anchor)) { throw "No se encontró la línea SPACY_SCRIPT en el launcher; no se cambió nada." }
    $nl = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
    $add = $nl + 'REM Interruptor (01/11/2026): si existe MCP-V11-Local\SPACY_DISABLED no arranca el sidecar spaCy;' +
           $nl + 'REM V11 trabaja en modo JSON-only. Para reactivarlo, borra ese archivo y reinicia el servicio.' +
           $nl + 'if exist "%INSTALL_DIR%\MCP-V11-Local\SPACY_DISABLED" set "SPACY_SCRIPT=%INSTALL_DIR%\MCP-V11-Local\python\__spacy_desactivado__.py"'
    $text = $text.Replace($anchor, $anchor + $add)
    [System.IO.File]::WriteAllText($launcher, $text, [System.Text.Encoding]::Default)
    Write-Host "Launcher modificado (respaldo: $backup)"
} else {
    Write-Host "El launcher ya tenía el interruptor."
}

Set-Content -Path $flag -Value 'spaCy desactivado el 01/11/2026 (HTTP 500 en /concept_match). Borrar este archivo y reiniciar LetXinetSuiteMCPV11 para reactivarlo.'
Write-Host "Interruptor creado: $flag"

Write-Host "Reiniciando LetXinetSuiteMCPV11..."
Stop-Service LetXinetSuiteMCPV11 -Force
# Cierra un sidecar spaCy huérfano que siga ocupando el puerto 4002
Get-NetTCPConnection -State Listen -LocalPort 4002 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Start-Service LetXinetSuiteMCPV11
Start-Sleep -Seconds 8
Get-Service LetXinetSuiteMCPV11 | Format-Table Name, Status -AutoSize
$spacy = Get-NetTCPConnection -State Listen -LocalPort 4002 -ErrorAction SilentlyContinue
if ($spacy) { Write-Host "AVISO: algo sigue escuchando en el puerto 4002." } else { Write-Host "OK: spaCy (puerto 4002) ya no está activo." }
