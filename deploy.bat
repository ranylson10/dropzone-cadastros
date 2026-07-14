@echo off
title Deploy GitHub + Vercel

echo.
echo ===============================
echo      VERIFICANDO ALTERACOES
echo ===============================
echo.

git status

echo.
git add .

git diff --cached --quiet
if %errorlevel%==0 (
    echo.
    echo Nenhuma alteracao encontrada.
    pause
    exit
)

echo.
set /p msg=Mensagem do commit:

if "%msg%"=="" set msg=Atualizacao

git commit -m "%msg%"

if %errorlevel% neq 0 (
    pause
    exit
)

git push origin main

echo.
echo ===============================
echo   ENVIADO PARA O GITHUB!
echo O Vercel iniciara o deploy.
echo ===============================

pause