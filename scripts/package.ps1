[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$extensionRoot = Join-Path $projectRoot 'extension'
$distRoot = Join-Path $projectRoot 'dist'
$manifestPath = Join-Path $extensionRoot 'manifest.json'

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "Extension manifest is missing: $extensionRoot"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.version -notmatch '^\d+\.\d+\.\d+(\.\d+)?$') {
  throw "Extension manifest version is invalid: $($manifest.version)"
}

$archivePath = Join-Path $distRoot "proxy-profiles-switcher-$($manifest.version).zip"

New-Item -ItemType Directory -Path $distRoot -Force | Out-Null
if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

Compress-Archive -Path (Join-Path $extensionRoot '*') -DestinationPath $archivePath -CompressionLevel Optimal
Write-Output $archivePath
