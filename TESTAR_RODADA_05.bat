@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo  DROPZONE - R05 - ENGINE, MATCHSTATS, SPEC E ELECTRON
 echo ============================================================
where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: instale Node.js 22 ou superior.
  pause
  exit /b 1
)
if not exist "node_modules\typescript" (
  echo NOTA: Este teste precisa do TypeScript do projeto ou global.
  echo Se ele nao estiver instalado, execute npm install antes.
)
node scripts\testes\test-round2-guards.mjs
if errorlevel 1 goto fail
node scripts\testes\test-round3-db-gates.mjs
if errorlevel 1 goto fail
node scripts\testes\test-round4-ui.mjs
if errorlevel 1 goto fail
node scripts\testes\test-engine-result-r11.mjs
if errorlevel 1 goto fail
node scripts\testes\test-round5-integrations.mjs
if errorlevel 1 goto fail
node --check desktop\main.cjs
if errorlevel 1 goto fail
node --check desktop\remote-assets.cjs
if errorlevel 1 goto fail
echo.
echo APROVADO: validacoes locais da R02 a R05.
echo AVISO: build Next, empacotamento Electron, QA real com OBS, SPEC e
 echo MatchStats exigem ambiente instalado, credenciais e homologacao.
pause
exit /b 0
:fail
echo FALHA: revise os erros antes de publicar.
pause
exit /b 1
