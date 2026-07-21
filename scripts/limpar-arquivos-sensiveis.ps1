$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$targets = @(
  'check_auth_user.js',
  'insert_manager.js',
  'insert_manager.py',
  'response.json',
  'web/app/api/campeonatos/[id]/equipes/route.ts.bak'
)

foreach ($relative in $targets) {
  $path = Join-Path $root $relative
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Force
    Write-Host "Removido: $relative"
  }
}

Write-Host 'Limpeza concluida.'
