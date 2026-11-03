@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo DROPZONE R10 - ESCRITORES E REGRESSOES LOCAIS
echo ================================================
where node >nul 2>&1
if errorlevel 1 (echo ERRO: instale Node.js 22 ou superior. & pause & exit /b 1)
if not exist "node_modules\typescript" (echo ERRO: execute npm ci para instalar dependencias. & pause & exit /b 1)
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
echo VALIDACOES LOCAIS APROVADAS. TESTES POSTGRESQL CONCORRENTES PENDENTES.
pause
exit /b 0
:fail
echo TESTES FALHARAM. NAO PUBLIQUE.
pause
exit /b 1
