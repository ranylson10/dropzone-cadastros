@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo DROPZONE - R08 - INTEGRIDADE DE GRUPOS E SLOTS
echo ================================================
where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: instale Node.js 22 ou superior.
  pause
  exit /b 1
)
if not exist "node_modules\typescript" (
  echo ERRO: faltam dependencias. Rode npm ci na raiz do projeto.
  pause
  exit /b 1
)
call npm run test:rounds
if errorlevel 1 goto fail
if /I "%~1"=="--build" (
  call npm run typecheck
  if errorlevel 1 goto fail
  call npm run lint
  if errorlevel 1 goto fail
  call npm run build
  if errorlevel 1 goto fail
)
echo APROVADO: testes locais R01-R08.
echo ATENCAO: faltam QA E2E, build completo e concorrencia PostgreSQL.
pause
exit /b 0
:fail
echo ERRO: testes falharam. Nao publique.
pause
exit /b 1
