@echo off
setlocal
cd /d "%~dp0"
echo ===================================================
echo DROPZONE R22 - PAINEIS POR PERFIL E REGRESSOES
 echo ===================================================
call npm run test:round22 || goto :erro
call npm run test:round21 || goto :erro
call npm run test:round20 || goto :erro
call npm run test:round19:buildfix || goto :erro
call npm run test:rounds || goto :erro
call npm run typecheck || goto :erro
call npm run lint || goto :erro
echo.
echo R22: TESTES LOCAIS APROVADOS. VALIDAR BUILD WEB E NAVEGACAO AUTENTICADA.
pause
exit /b 0
:erro
echo.
echo R22: FALHA DETECTADA. ENVIE O RESULTADO DO CMD.
pause
exit /b 1
