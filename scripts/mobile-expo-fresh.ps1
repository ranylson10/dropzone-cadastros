param([switch]$Tunnel)

$ErrorActionPreference = "Stop"
$workspaceRoot = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $workspaceRoot "app"
$appPackage = Join-Path $appRoot "package.json"
$port = 8082

if (-not (Test-Path -LiteralPath $appPackage)) {
  throw "App mobile nao encontrado em $appRoot"
}

$package = Get-Content -LiteralPath $appPackage -Raw | ConvertFrom-Json
if ($package.name -ne "dropzone-mobile") {
  throw "package.json inesperado em $appRoot"
}

$expoVersion = (Get-Content -LiteralPath (Join-Path $appRoot "node_modules\expo\package.json") -Raw | ConvertFrom-Json).version
$reactNativeVersion = (Get-Content -LiteralPath (Join-Path $appRoot "node_modules\react-native\package.json") -Raw | ConvertFrom-Json).version
if (-not $expoVersion.StartsWith("54.")) {
  throw "Expo incorreto no app: $expoVersion. Esperado: SDK 54."
}
if ($reactNativeVersion -ne "0.81.5") {
  throw "React Native incorreto no app: $reactNativeVersion. Esperado: 0.81.5."
}

$listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
  if ($process -and $process.CommandLine -match "expo" -and $process.CommandLine -match "dropzone-cadastros\\app") {
    Stop-Process -Id $listener.OwningProcess -Force
  } elseif ($process) {
    throw "A porta $port esta ocupada por outro programa (PID $($listener.OwningProcess))."
  }
}

Write-Host "DropZone Mobile" -ForegroundColor Cyan
Write-Host "Pasta: $appRoot"
Write-Host "Expo: $expoVersion | React Native: $reactNativeVersion | Porta: $port"
Write-Host "Leia o NOVO QR Code abaixo. Nao abra pela lista de recentes." -ForegroundColor Yellow

Push-Location $appRoot
try {
  if ($Tunnel) {
    & npm.cmd run start:go:tunnel
  } else {
    & npm.cmd run start:go
  }
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
