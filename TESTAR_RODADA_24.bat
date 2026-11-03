@echo off
setlocal
cd /d "%~dp0"
echo =============================================================
echo DROPZONE R24 - REGRESSOES DO REDESIGN R20 A R24
echo =============================================================
call npm run test:round24 || goto :erro
call npm run test:round23 || goto :erro
call npm run test:round22 || goto :erro
call npm run test:round21 || goto :erro
call npm run test:round20 || goto :erro
call npm run test:rounds || goto :erro
call npm run test:round13 || goto :erro
call npm run test:round14 || goto :erro
call npm run test:round15 || goto :erro
call npm run test:round16 || goto :erro
call npm run test:round17 || goto :erro
call npm run test:round18 || goto :erro
call npm run test:round19 || goto :erro
call npm run test:round19:buildfix || goto :erro
call npm run typecheck || goto :erro
call npm run lint || goto :erro
echo.
echo R24: verificacoes locais aprovadas. Build e navegador requerem homologacao separada.
pause
exit /b 0
:erro
echo.
echo R24: erro encontrado. Envie o resultado do terminal.
pause
exit /b 1
