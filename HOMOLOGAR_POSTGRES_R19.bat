@echo off
setlocal
cd /d "%~dp0"
title DropZone R19 - PostgreSQL Isolado
echo ================================================================
echo DROPZONE R19 - TESTES NATIVOS EM POSTGRESQL ISOLADO (DOCKER)
echo NAO USA SUPABASE DE PRODUCAO OU DADOS DE JOGADORES.
echo ================================================================
where node >nul 2>&1 || (echo ERRO: instale Node.js 22 ou superior.& pause & exit /b 1)
where docker >nul 2>&1 || (echo ERRO: instale e inicie Docker Desktop.& pause & exit /b 1)
set "ZIP_ORIGINAL=%~1"
if "%ZIP_ORIGINAL%"=="" if exist "%~dp0dropzone-cadastros-ENVIO.zip" set "ZIP_ORIGINAL=%~dp0dropzone-cadastros-ENVIO.zip"
if "%ZIP_ORIGINAL%"=="" if exist "%~dp0DROPZONE_CATALOGO_LAB_PRIVADO.zip" set "ZIP_ORIGINAL=%~dp0DROPZONE_CATALOGO_LAB_PRIVADO.zip"
if "%ZIP_ORIGINAL%"=="" (
 echo Informe o caminho do ZIP original ou do CATALOGO_LAB_PRIVADO.
 echo Pode arrastar o ZIP desejado ate esta janela e pressionar Enter.
 echo NAO informe o ZIP de codigo R19 nem o nome do arquivo BAT.
 set /p "ZIP_ORIGINAL=Caminho completo: "
)
rem Remove apenas aspas externas adicionadas ao arrastar o arquivo para o CMD.
set "ZIP_ORIGINAL=%ZIP_ORIGINAL:"=%"
rem Verifica extensao, existencia, indice ZIP e catalogo ANTES de criar Docker.
node scripts\release\round19-check-catalog-zip.mjs "%ZIP_ORIGINAL%"
if errorlevel 1 (
 echo ERRO: coloque dropzone-cadastros-ENVIO.zip OU DROPZONE_CATALOGO_LAB_PRIVADO.zip nesta pasta.
 echo Se preferir, execute novamente arrastando um desses ZIPs sobre o BAT.
 pause
 exit /b 1
)
echo.
echo Usaremos SOMENTE o catalogo de schema historico do ZIP.
echo O teste criara um container Docker SEM REDE e um banco sintetico.
echo Um container com o mesmo nome nunca sera apagado automaticamente.
echo.
choice /c SN /m "Confirma a criacao do laboratorio DESCARTAVEL no Docker"
if errorlevel 2 exit /b 2
node scripts\release\round19-laboratorio.mjs --execute "%ZIP_ORIGINAL%"
set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" echo HOMOLOGACAO NAO CONCLUIDA: confira relatorios-testes.
if "%CODE%"=="0" echo TESTES NATIVOS DA FIXTURE APROVADOS. PRODUCAO AINDA NAO HOMOLOGADA.
pause
exit /b %CODE%
