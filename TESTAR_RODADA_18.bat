@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo DROPZONE R18 - CONVITES E REGRESSOES
 echo ================================================
where node >nul 2>&1 || (echo ERRO: instale Node.js antes de executar.& exit /b 1)
call npm run test:round18
if errorlevel 1 exit /b 1
call npm run test:rounds
if errorlevel 1 exit /b 1
for %%R in (13 14 15 16 17) do (
  call npm run test:round%%R
  if errorlevel 1 exit /b 1
)
echo.
echo TESTES LOCAIS APROVADOS. Isso nao certifica PostgreSQL, E2E ou build.
call npm run release:readiness -- --require-ready
if errorlevel 1 (
  echo PUBLICACAO BLOQUEADA: homologacao real pendente.
  exit /b 2
)
exit /b 0
