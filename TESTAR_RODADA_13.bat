@echo off
setlocal
cd /d "%~dp0"
echo ===== DROPZONE R13: TESTES LOCAIS =====
where node >nul 2>&1 || (echo ERRO: Node.js nao instalado.& exit /b 1)
if not exist node_modules\typescript\package.json (
  echo Dependencias ausentes. Execute npm ci nesta pasta antes dos testes.
  exit /b 1
)
call npm run test:rounds || exit /b 1
call npm run test:round13 || exit /b 1
call npm run test:security || exit /b 1
call npm run typecheck || exit /b 1
call npm run lint || exit /b 1
call npm run build || exit /b 1
echo Testes locais executados. O PostgreSQL e E2E real ainda exigem homologacao separada.
exit /b 0
