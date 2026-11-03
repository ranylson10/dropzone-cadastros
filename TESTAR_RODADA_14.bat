@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo DROPZONE R14 - VERIFICACOES LOCAIS DE RELEASE
echo ================================================
where node >nul 2>&1 || (echo ERRO: Instale Node.js 24 e execute novamente.& exit /b 1)
if not exist "node_modules\next\package.json" (
 echo AVISO: Pacotes npm ainda nao estao instalados.
 echo Execute npm ci quando houver internet e execute este BAT novamente.
 echo O relatorio parcial ainda sera produzido, sem liberar a publicacao.
)
call npm run release:verify -- --full
set RESULTADO=%ERRORLEVEL%
call npm run release:readiness
if not "%RESULTADO%"=="0" (
 echo AVISO: Uma verificacao falhou. Examine a lista do relatorio.
 exit /b %RESULTADO%
)
echo.
echo Concluidas as verificacoes disponiveis.
echo IMPORTANTE: PostgreSQL real, rollback, E2E e integracoes ainda exigem laboratorio.
echo Relatorio: relatorios-testes\round14-local-evidence.json
exit /b 0
