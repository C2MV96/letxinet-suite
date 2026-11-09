# restore-config.ps1
# Uninstall hook - restaura el backup mas reciente de opencode.json
$cfgDir = Join-Path $env:USERPROFILE ".config\opencode"
$cfg = Join-Path $cfgDir "opencode.json"
$bak = Get-ChildItem (Join-Path $cfgDir "opencode.json.bak*") -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($bak) {
    Copy-Item $bak.FullName $cfg -Force
    Write-Host "Backup restaurado: $($bak.Name)"
} else {
    Write-Host "No hay backup - opencode.json queda sin restaurar"
}
