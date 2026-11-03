@echo off
setlocal
cd /d "%~dp0"
echo ====================================================
echo  DROPZONE - R03 - AUDITORIA BANCO (LOCAL / SEM ESCRITA)
echo ====================================================
where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: instale Node.js 22 ou superior.
  pause
  exit /b 1
)
node scripts\testes\test-round2-guards.mjs
if errorlevel 1 goto falha
node scripts\testes\test-round3-db-gates.mjs
if errorlevel 1 goto falha
node --check scripts\testes\test-round3-db-gates.mjs
if errorlevel 1 goto falha
echo.
echo APROVADO: controles locais R02 + R03.
echo ATENCAO: isso NAO aplica nem certifica migrations no Supabase.
echo Para conferir o banco, execute o SQL SOMENTE LEITURA no editor do Supabase.
pause
exit /b 0
:falha
echo FALHA: interrompa qualquer implantacao.
pause
exit /b 1
