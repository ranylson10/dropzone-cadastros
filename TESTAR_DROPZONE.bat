@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo DROPZONE - ROBO DE AUDITORIA COMPLETA
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado.
  exit /b 1
)

if not exist node_modules (
  echo [INFO] Dependencias nao encontradas. Executando npm install...
  call npm install
  if errorlevel 1 exit /b 1
)

call node scripts\testes\executar.mjs --full
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE% EQU 0 (
  echo [OK] Auditoria concluida sem erros bloqueadores.
) else (
  echo [ATENCAO] A auditoria encontrou erros. Veja relatorios-testes\ultimo-relatorio.txt
)
echo.
pause
exit /b %EXIT_CODE%
