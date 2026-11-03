@echo off
cd /d "%~dp0"
echo.
echo ========================================
echo DropZone - testes da Rodada 01
echo ========================================
echo.
call npm run test:security:round1
if errorlevel 1 (
  echo.
  echo TESTE FALHOU. Consulte o erro acima.
) else (
  echo.
  echo TESTE PASSOU. Nao houve alteracao no banco.
)
pause
