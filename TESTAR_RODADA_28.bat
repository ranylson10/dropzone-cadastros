@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo DROPZONE R28 - PAINEL PRODUTORA LIMPO E HORIZONTAL
 echo ============================================================
call node scripts\testes\test-r28-produtora-clean.mjs || exit /b 1
call node scripts\testes\test-r27-produtora-hierarchy.mjs || exit /b 1
call node scripts\testes\test-r26-produtora-layout.mjs || exit /b 1
call node scripts\testes\test-round20-ux.mjs || exit /b 1
call node scripts\testes\test-round22-role-hubs.mjs || exit /b 1
call node scripts\testes\test-round24-redesign-final.mjs || exit /b 1
echo.
echo Testes estaticos R28 e regressoes aprovados.
echo Para testar layout desktop/mobile no browser:
echo   npx playwright test --config=playwright.r28.config.ts
echo Para validar o app todo:
echo   npm run typecheck ^&^& npm run build
endlocal
