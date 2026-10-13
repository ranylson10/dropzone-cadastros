$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)

& git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host 'Selecione e revise os arquivos com git add antes de publicar. Nenhum arquivo foi adicionado automaticamente.'
    exit 1
}
if ($LASTEXITCODE -ne 1) { throw 'Falha ao verificar arquivos selecionados.' }
& git diff --cached --stat
& git diff --quiet
if ($LASTEXITCODE -ne 0) { throw 'Revise e selecione todas as alteracoes locais antes de validar a publicacao.' }
$untrackedFiles = @(& git ls-files --others --exclude-standard)
if ($LASTEXITCODE -ne 0) { throw 'Falha ao verificar arquivos novos.' }
if ($untrackedFiles.Count -gt 0) { throw 'Ha arquivos novos fora do commit. Selecione-os ou ignore-os antes de validar.' }
& npm run check:release
if ($LASTEXITCODE -ne 0) { throw 'Publicacao bloqueada: verificacoes falharam.' }

$branchName = (& git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or !$branchName) { throw 'Selecione uma branch antes de publicar.' }
Write-Host "Verificacoes aprovadas. Branch: $branchName"
$approvalText = Read-Host 'Digite PUBLICAR para enviar os arquivos selecionados ao GitHub'
if ($approvalText -cne 'PUBLICAR') { Write-Host 'Publicacao cancelada.'; exit 0 }
$commitMessage = Read-Host 'Mensagem do commit'
if ([string]::IsNullOrWhiteSpace($commitMessage)) { throw 'Informe uma mensagem para o commit.' }
& git commit -m $commitMessage
if ($LASTEXITCODE -ne 0) { throw 'O commit falhou. Nada foi enviado.' }
& git push origin $branchName
if ($LASTEXITCODE -ne 0) { throw 'O push falhou. O commit permanece somente local.' }
Write-Host 'GitHub atualizado. Acompanhe a Vercel para confirmar o resultado do deploy.'
