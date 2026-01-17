$ErrorActionPreference = "Stop"

$baseDir = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $baseDir "data"
$backupRoot = Join-Path $baseDir "backups"
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$targetDir = Join-Path $backupRoot $timestamp

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

$items = @(
  "odin.db",
  "images",
  "slides"
)

foreach ($item in $items) {
  $source = Join-Path $dataDir $item
  if (Test-Path $source) {
    Copy-Item -Path $source -Destination $targetDir -Recurse -Force
  }
}

Write-Host "Backup complete: $targetDir"
