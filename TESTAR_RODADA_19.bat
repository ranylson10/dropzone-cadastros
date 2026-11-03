@echo off
setlocal
cd /d "%~dp0"
title DropZone R19 - Regressao local
echo DROPZONE R19 - TESTES LOCAIS, SEM ACESSO A BANCO REAL
where node >nul 2>&1 || (echo ERRO: instale Node.js.& exit /b 1)
call npm run test:round19:buildfix
if errorlevel 1 exit /b 1
call npm run test:round19
if errorlevel 1 exit /b 1
call npm run test:rounds
if errorlevel 1 exit /b 1
for %%R in (13 14 15 16 17 18) do (
  call npm run test:round%%R
  if errorlevel 1 exit /b 1
)
echo.
echo REGRESSOES LOCAIS CONCLUIDAS. Avaliando gate de publicacao...
call npm run release:readiness -- --require-ready
if errorlevel 1 (
  echo PUBLICACAO AINDA BLOQUEADA: faltam provas reais e revisao humana.
  exit /b 2
)
exit /b 0
