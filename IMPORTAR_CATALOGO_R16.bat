@echo off
setlocal
cd /d "%~dp0"
echo =====================================================
echo DROPZONE R16 - IMPORTAR CATALOGO DO ZIP ORIGINAL
 echo SO PARA LABORATORIO LOCAL - NAO ALTERA SUPABASE
 echo =====================================================
where node >nul 2>&1 || (echo ERRO: Node.js nao encontrado.& exit /b 1)
set "ORIGINAL=%~1"
if "%ORIGINAL%"=="" (
 echo Arraste o ZIP original dropzone-cadastros-ENVIO.zip
 echo sobre este BAT ou cole o caminho do arquivo abaixo.
 set /p "ORIGINAL=Caminho do ZIP original: "
)
if not exist "%ORIGINAL%" (echo ERRO: O ZIP original nao foi encontrado.& exit /b 1)
node scripts\release\importar-catalogo-original.mjs "%ORIGINAL%"
if errorlevel 1 (echo ERRO: Nao foi possivel importar o catalogo.& exit /b 1)
node scripts\testes\postgres-inscricoes\build-schema.mjs --emit-only
if errorlevel 1 (echo ERRO: Falha ao gerar esquema sintetico.& exit /b 1)
echo.
echo Catalogo historico importado e SQL sintetico gerado OFFLINE.
echo Isso NAO executa PostgreSQL nem valida o banco atual.
echo.
call npm run release:lab-preflight
set "PRE=%ERRORLEVEL%"
if not "%PRE%"=="0" (
 echo.
 echo LABORATORIO AINDA PENDENTE: configure Docker conforme o README.
 exit /b 2
)
echo Preflight aprovado; execute os testes nativos somente no laboratorio isolado.
exit /b 0
