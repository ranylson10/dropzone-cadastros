@echo off
setlocal
cd /d "%~dp0"
echo DROPZONE - R11 CONVITES E RESERVAS
where node >nul 2>&1
if errorlevel 1 (echo Node.js nao encontrado. & pause & exit /b 1)
if not exist "node_modules\typescript" (echo Execute npm ci antes dos testes. & pause & exit /b 1)
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
echo R11 PASSOU: testes locais. PostgreSQL concorrente nao certificado.
pause
exit /b 0
:fail
echo FALHA NOS TESTES - NAO PUBLIQUE.
pause
exit /b 1
