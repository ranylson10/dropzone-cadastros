@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo DROPZONE - R07 - ESCOLHA DE GRUPOS E PERMISSOES
 echo ============================================================
where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: instale Node.js 22 ou mais recente.
  pause
  exit /b 1
)
if not exist "node_modules\typescript" (
  echo Faltam dependencias. Execute npm ci na raiz antes do teste.
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
  call npm run build --workspace dropzone-web -- --experimental-build-mode compile
  if errorlevel 1 goto fail
)
echo.
echo APROVADO: R01-R07 em testes locais de regressao.
echo NAO substitui testes concorrentes PostgreSQL nem QA do aplicativo.
pause
exit /b 0
:fail
echo ERRO: falha no teste; NAO publique esta alteracao.
pause
exit /b 1
