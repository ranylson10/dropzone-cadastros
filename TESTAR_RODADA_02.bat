@echo off
setlocal
cd /d "%~dp0"
echo ==============================================
echo  DROPZONE - RODADA 02 - TESTES ESTRUTURAIS
echo ==============================================
where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. Instale Node.js 22 ou superior.
  pause
  exit /b 1
)
node scripts\testes\test-round2-guards.mjs
if errorlevel 1 goto erro
node --check scripts\testes\postgres-inscricoes\validate-native.mjs
if errorlevel 1 goto erro
node --check scripts\testes\postgres-inscricoes\prepare-rollback.mjs
if errorlevel 1 goto erro
node --check scripts\testes\test-round2-guards.mjs
if errorlevel 1 goto erro
echo.
echo APROVADO: verificacoes locais R02.
echo AVISO: isto nao substitui os testes PostgreSQL/Next.js em homologacao.
pause
exit /b 0
:erro
echo FALHA: nao aplicar nenhuma migration.
pause
exit /b 1
