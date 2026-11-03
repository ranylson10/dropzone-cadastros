@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo DROPZONE - R06 - REGRESSAO E PACOTE SEGURO
echo ============================================================
where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: instale Node.js 22 ou mais recente.
  pause
  exit /b 1
)
if not exist "node_modules\typescript" (
  echo Falta a instalacao das dependencias.
  echo Execute "npm ci" nesta pasta antes do teste.
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
echo APROVADO: testes de regressao local R01-R06.
echo O build so e executado com: TESTAR_RODADA_06.bat --build
echo NAO inclui QA autenticado, OBS, SPEC, PostgreSQL nem deploy.
pause
exit /b 0
:fail
echo ERRO: algum teste falhou. Nao publique antes de revisar.
pause
exit /b 1
