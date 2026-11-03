@echo off
setlocal
cd /d "%~dp0"
echo DROPZONE R12 - CONVITES DE JOGADOR E VENDEDOR
where node >nul 2>&1
if errorlevel 1 (echo Node.js nao encontrado. & pause & exit /b 1)
if not exist "node_modules\typescript" (echo Execute npm ci na pasta principal antes de testar. & pause & exit /b 1)
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
echo R12: mocks e testes locais aprovados. CONCORRENCIA REAL E BUILD PENDENTES.
pause
exit /b 0
:fail
echo R12 FALHOU - NAO PUBLIQUE.
pause
exit /b 1
