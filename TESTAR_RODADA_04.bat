@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo  DROPZONE - R04 - NAVEGACAO E TABELAS
 echo ============================================================
where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: instale Node.js 22 ou superior.
  pause
  exit /b 1
)
node scripts\testes\test-round2-guards.mjs
if errorlevel 1 goto fail
node scripts\testes\test-round3-db-gates.mjs
if errorlevel 1 goto fail
node scripts\testes\test-round4-ui.mjs
if errorlevel 1 goto fail
node --check scripts\testes\test-round4-ui.mjs
if errorlevel 1 goto fail
echo.
echo APROVADO: verificacoes locais R02, R03 e R04.
echo AVISO: testes de navegacao real, visual e do Supabase permanecem separados.
pause
exit /b 0
:fail
echo FALHA: revise antes de publicar.
pause
exit /b 1
