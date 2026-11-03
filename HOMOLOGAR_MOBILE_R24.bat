@echo off
setlocal
cd /d "%~dp0"
echo =============================================================
echo DROPZONE R24 - TESTE VISUAL PUBLICO EM CHROMIUM
echo So le paginas publicas. Nao grava dados no Supabase.
echo =============================================================
call npx playwright test tests-e2e/public/rodada-24-mobile-ux.spec.ts --project=chromium-mobile --workers=1
if errorlevel 1 (
 echo.
echo Teste bloqueado ou falhou. Verifique se as dependencias e o Chromium do Playwright estao instalados.
echo Execute: npx playwright install chromium
 pause
 exit /b 1
)
echo.
echo Teste publico R24 concluido. Perfis autenticados exigem checagem manual.
pause
exit /b 0
