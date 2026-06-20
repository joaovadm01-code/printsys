@echo off
title PrintSys ERP/PDV
cd /d "%~dp0"
echo.
echo ==========================================
echo   PrintSys ERP/PDV para Grafica
echo ==========================================
echo.
echo Iniciando servidor em http://localhost:3000
echo.
echo Para encerrar, feche esta janela ou pressione CTRL+C.
echo.
node server.js
pause
