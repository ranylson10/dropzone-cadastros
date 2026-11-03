@echo off
setlocal
cd /d "%~dp0"
echo ==================================================
echo DROPZONE R21 - CRIACAO RAPIDA E REGRESSOES
 echo ==================================================
call npm run test:round21 || goto :erro
call npm run test:round20 || goto :erro
call npm run test:rounds || goto :erro
for %%R in (13 14 15 16 17 18 19) do (
  call npm run test:round%%R || goto :erro
)
call npm run test:round19:buildfix || goto :erro
call npm run typecheck || goto :erro
call npm run lint || goto :erro
echo.
echo R21 - TESTES LOCAIS APROVADOS. EXECUTE O BUILD WEB PARA HOMOLOGAR.
pause
exit /b 0
:erro
echo.
echo R21 - FALHA DETECTADA. ENVIE O LOG DO CMD.
pause
exit /b 1
