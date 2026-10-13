@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao foi encontrado. Instale o Node.js antes de testar.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo [ERRO] Dependencias nao instaladas. Execute npm install na pasta raiz.
  pause
  exit /b 1
)
echo.
echo [1/5] Auditoria do novo layout
node scripts\testes\audit-discovery-layout-r01-r02.mjs || goto failed
echo [2/5] Auditoria de rotas
node scripts\testes\audit-layout-pages.mjs || goto failed
echo [3/5] Auditoria dos cards
node scripts\testes\audit-championship-card.mjs || goto failed
echo [4/5] Verificacao de tipos
call npm run typecheck || goto failed
echo [5/5] Lint
call npm run lint || goto failed
echo.
echo APROVADO: validacoes locais. Faca o build e os testes visuais antes do deploy.
pause
exit /b 0
:failed
echo.
echo [FALHA] Alguma validacao falhou. Nao publique as alteracoes.
pause
exit /b 1
