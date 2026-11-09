# ============================================================================
# set-env-key.ps1
# Helper de configure-keys.cmd para editar una KEY en un archivo .env.
#
# Uso:
#   powershell -File set-env-key.ps1 -EnvFile <path> -Key <NAME> -Value <val>
#
# Comportamiento:
#   - Lee el .env como UTF-8.
#   - Reemplaza la primera linea que case con ^KEY= por KEY=VALUE.
#   - Si no existe, APENDEA al final.
#   - Preserva todas las dems lineas (comentarios, otras keys, lineas vacias).
#   - Reescribe como UTF-8 sin BOM (compatible con dotenv de Node).
#   - Si Value contiene chars especiales (parens, spaces, =), se escriben literal.
#
# Exit codes:
#   0 = OK
#   1 = archivo no existe
#   2 = otra excepcion
# ============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)] [string] $EnvFile,
    [Parameter(Mandatory=$true)] [string] $Key,
    [Parameter(Mandatory=$true)] [AllowEmptyString()] [string] $Value
)

# Si $Value es null (PowerShell puede pasar null desde cmdline con -Value $null),
# normalizarlo a string vacio.
if ($null -eq $Value) { $Value = '' }

trap { Write-Error $_; exit 2 }

if (-not (Test-Path -LiteralPath $EnvFile)) {
    Write-Error "Env file not found: $EnvFile"
    exit 1
}

# Leer todas las lineas preservando formato. Usamos [System.IO.File] para
# evitar el BOM que Get-Content a veces annade al reescribir.
$lines = [System.IO.File]::ReadAllLines($EnvFile, [System.Text.Encoding]::UTF8)

$pattern = '^' + [regex]::Escape($Key) + '='
$found   = $false
$out     = New-Object System.Collections.Generic.List[string]

foreach ($line in $lines) {
    if ((-not $found) -and ($line -match $pattern)) {
        $out.Add($Key + '=' + $Value)
        $found = $true
    } else {
        $out.Add($line)
    }
}

if (-not $found) {
    # Si la ultima linea no termina en newline, annadir una antes
    if ($out.Count -gt 0 -and $out[-1] -ne '') {
        $out.Add('')
    }
    $out.Add($Key + '=' + $Value)
}

# Reescribir como UTF-8 sin BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($EnvFile, $out, $utf8NoBom)

exit 0
