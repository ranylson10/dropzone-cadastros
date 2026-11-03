@echo off
setlocal
cd /d "%~dp0"
title DropZone R19 - Validacao Web
echo Iniciando validacao web da R19 corrigida...
echo ============================================================
echo DROPZONE R19 - VALIDACAO WEB (TIPOS, LINT, BUILD INTEGRAL)
echo Dados/credenciais de producao serao removidos do ambiente.
echo ============================================================
where node >nul 2>&1 || (echo ERRO: instale Node.js 22 ou superior.& pause & exit /b 1)
echo.
echo O processo executara npm ci e podera baixar dependencias.
choice /c SN /m "Deseja executar a verificacao Web agora"
if errorlevel 2 exit /b 2
call node scripts\release\round19-web-check.mjs --execute
set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" echo FALHA OU BLOQUEIO: veja relatorios-testes\r19-web-evidence.json.
if "%CODE%"=="0" echo BUILD WEB LOCAL APROVADO. E2E E PRODUCAO AINDA PENDENTES.
pause
exit /b %CODE%
