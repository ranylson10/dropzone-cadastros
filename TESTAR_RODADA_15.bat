@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo DROPZONE R15 - HOMOLOGACAO / PROVAS REAIS
echo ================================================
where node >nul 2>&1 || (echo ERRO: Instale Node.js e tente novamente.& exit /b 1)
call npm run test:round15
if errorlevel 1 (echo ERRO: Verificacoes R15 falharam.& exit /b 1)
call npm run release:lab-preflight
if errorlevel 1 (
 echo.
 echo ATENCAO: O laboratorio PostgreSQL ainda precisa ser preparado.
 echo Confira docs\RODADA_15_HOMOLOGACAO.md.
)
echo.
if /i "%DROPZONE_RELEASE_STAGING%"=="1" (
 echo Executando verificacoes COMPLETAS: confirme que os valores .env apontam apenas para STAGING.
 call npm run release:verify -- --full
) else (
 echo Executando checagens locais RAPIDAS e seguras por padrao.
 echo Para autorizar build completo SOMENTE em ambiente staging:
 echo   set DROPZONE_RELEASE_STAGING=1
 echo   TESTAR_RODADA_15.bat
 call npm run release:verify -- --quick
)
set VERIFICACAO=%ERRORLEVEL%
call npm run release:readiness -- --require-ready
set APTO=%ERRORLEVEL%
if not "%VERIFICACAO%"=="0" (
 echo.
 echo PUBLICACAO BLOQUEADA: faltam testes ou houve erro.
 exit /b %VERIFICACAO%
)
if not "%APTO%"=="0" (
 echo.
 echo PUBLICACAO BLOQUEADA: falta homologacao externa.
 exit /b %APTO%
)
echo Os testes locais estao completos, MAS aguarde a revisao humana antes do deploy.
exit /b 0
