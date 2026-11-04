@echo off
setlocal
cd /d "%~dp0"
echo ======================================================
echo DROPZONE R26 - PAINEL DA PRODUTORA
echo ======================================================
call node scripts\testes\test-r26-produtora-layout.mjs
if errorlevel 1 goto :error
call node scripts\testes\test-round20-ux.mjs
if errorlevel 1 goto :error
call node scripts\testes\test-round22-role-hubs.mjs
if errorlevel 1 goto :error
call node scripts\testes\test-round24-redesign-final.mjs
if errorlevel 1 goto :error
echo.
echo Testes locais R26 aprovados. Build e teste no navegador ainda necessarios.
pause
exit /b 0
:error
 echo.
echo R26: falha nos testes. Copie o resultado do CMD.
pause
exit /b 1
