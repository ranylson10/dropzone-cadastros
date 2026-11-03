@echo off
setlocal EnableExtensions
set "FONTE=E:\dropzone-cadastros"
set "COPIA=E:\dropzone-cadastros-ENVIO"
set "ARQUIVO=E:\dropzone-cadastros-ENVIO.zip"
if not exist "%FONTE%\package.json" (
  echo ERRO: pasta de origem nao encontrada: %FONTE%
  exit /b 1
)
cd /d E:\
echo Criando copia limpa do projeto...
if exist "%COPIA%" rmdir /s /q "%COPIA%"
if exist "%ARQUIVO%" del /f /q "%ARQUIVO%"
robocopy "%FONTE%" "%COPIA%" /E /XJ /MT:16 /R:0 /W:0 /NFL /NDL /NJH /NJS /NP ^
 /XD .git node_modules .next .vercel dist out build .turbo .cache coverage test-results playwright-report blob-report artifacts temp tmp .expo .temp .auth relatorios-testes ^
 /XF .env* *.log *.zip *.7z *.rar *.tmp *.bak *.trace *.tsbuildinfo *.pem *.key *.p12 *.pfx *.keystore *.jks
if errorlevel 8 (
  echo ERRO: falha ao copiar o projeto.
  exit /b 1
)
rem .env.example sao modelos necessarios ao projeto; os arquivos .env reais ficam excluidos.
if exist "%FONTE%\.env.e2e.example" copy /y "%FONTE%\.env.e2e.example" "%COPIA%\.env.e2e.example" >nul
if exist "%FONTE%\app\.env.example" copy /y "%FONTE%\app\.env.example" "%COPIA%\app\.env.example" >nul
if exist "%FONTE%\web\.env.example" copy /y "%FONTE%\web\.env.example" "%COPIA%\web\.env.example" >nul
powershell -NoProfile -Command "Compress-Archive -Path 'E:\dropzone-cadastros-ENVIO\*' -DestinationPath 'E:\dropzone-cadastros-ENVIO.zip' -CompressionLevel Fastest -Force"
if errorlevel 1 (
  echo ERRO: nao foi possivel compactar.
  exit /b 1
)
echo.
echo ZIP CONCLUIDO: %ARQUIVO%
dir "%ARQUIVO%"
endlocal
