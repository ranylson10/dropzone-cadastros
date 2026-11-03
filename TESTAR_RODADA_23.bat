@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo DROPZONE R23 - VISUAL PREMIUM E MOBILE APP
 echo ============================================================
call npm run test:round23 || goto :erro
call npm run test:round22 || goto :erro
call npm run test:round21 || goto :erro
call npm run test:round20 || goto :erro
call npm run test:round19:buildfix || goto :erro
call npm run typecheck || goto :erro
call npm run lint || goto :erro
echo.
echo R23: TESTES LOCAIS APROVADOS. TESTE VISUAL E BUILD AINDA NECESSARIOS.
pause
exit /b 0
:erro
echo.
echo R23: FALHA DETECTADA. ENVIE O RESULTADO DO CMD.
pause
exit /b 1
