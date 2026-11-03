@echo off
cd /d "%~dp0"
echo DROPZONE R20 - NAVEGACAO E PAINEIS POR PERFIL
call npm run test:round20 || goto :erro
call npm run test:rounds || goto :erro
for %%R in (13 14 15 16 17 18 19) do (
  call npm run test:round%%R || goto :erro
)
call npm run test:round19:buildfix || goto :erro
call npm run typecheck || goto :erro
call npm run lint || goto :erro
echo.
echo R20 - Verificacoes locais aprovadas. Testes visuais no navegador ainda necessarios.
pause
exit /b 0
:erro
echo.
echo R20 - Erro encontrado. Envie a saida do CMD.
pause
exit /b 1
