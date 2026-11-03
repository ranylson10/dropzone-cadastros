@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo DROPZONE R17 - LABORATORIO SEGURO E REGRESSOES
echo ================================================
where node >nul 2>&1 || (echo ERRO: instale Node.js antes de executar.& exit /b 1)
call npm run test:round17
if errorlevel 1 (echo ERRO: Falha nos testes R17.& exit /b 1)
call npm run test:round16
if errorlevel 1 exit /b 1
call npm run test:round15
if errorlevel 1 exit /b 1
call npm run test:round14
if errorlevel 1 exit /b 1
call npm run test:round13
if errorlevel 1 exit /b 1
call npm run release:lab-preflight
if errorlevel 1 echo AVISO: Docker/PostgreSQL isolado nao disponivel. NENHUM SQL foi executado.
call npm run release:verify -- --quick
if errorlevel 1 (
 echo PUBLICACAO BLOQUEADA: falta homologacao real.
 exit /b 2
)
call npm run release:readiness -- --require-ready
if errorlevel 1 exit /b 2
exit /b 0
