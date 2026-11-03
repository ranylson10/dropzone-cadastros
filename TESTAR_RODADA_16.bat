@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo DROPZONE R16 - REGRESSOES E LABORATORIO
 echo ============================================
where node >nul 2>&1 || (echo ERRO: Node.js nao encontrado.& exit /b 1)
call npm run test:round16
if errorlevel 1 (echo ERRO: Falha nos testes de ZIP/catalogo R16.& exit /b 1)
call npm run test:round15
if errorlevel 1 (echo ERRO: Falha nas verificacoes anteriores R15.& exit /b 1)
call npm run release:lab-preflight
if errorlevel 1 echo AVISO: Laboratorio PostgreSQL ainda nao preparado. Consulte docs\RODADA_16_RECUPERACAO_LABORATORIO.md.
call npm run release:verify -- --quick
if errorlevel 1 (
 echo.
 echo PUBLICACAO BLOQUEADA ate homologacao completa.
 exit /b 2
)
call npm run release:readiness -- --require-ready
if errorlevel 1 exit /b 2
exit /b 0
