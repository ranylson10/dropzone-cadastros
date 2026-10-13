@echo off
setlocal
cd /d "%~dp0" || exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-reviewed.ps1"
exit /b %errorlevel%
