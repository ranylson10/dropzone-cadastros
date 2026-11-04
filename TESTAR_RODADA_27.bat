@echo off
setlocal
cd /d "%~dp0"
echo ======================================================
echo DROPZONE R27 - PAINEL PRODUTORA POR MODULOS
echo ======================================================
call node scripts\testes\test-r27-produtora-hierarchy.mjs
if errorlevel 1 goto falha
call node scripts\testes\test-r26-produtora-layout.mjs
if errorlevel 1 goto falha
call node scripts\testes\test-round20-ux.mjs
if errorlevel 1 goto falha
call node scripts\testes\test-round22-role-hubs.mjs
if errorlevel 1 goto falha
call node scripts\testes\test-round24-redesign-final.mjs
if errorlevel 1 goto falha
echo.
echo R27 e regressoes locais aprovadas.
echo Execute separadamente: npm run typecheck ^&^& npm run build
goto fim
:falha
echo.
echo FALHA: verifique o erro acima. Nao publique antes de corrigir.
exit /b 1
:fim
endlocal
