@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title DeliveryCheck - Relatorio Estatistico de Entregas
cls

:MENU
cls
echo ====================================================================
echo                 DELIVERYCHECK - RELATORIO DE ENTREGAS
echo ====================================================================
echo.
echo [1] Ver Estatisticas de HOJE e do MES ATUAL
echo [2] Ver Estatisticas de um DIA especifico (Ex: 2026-09-07)
echo [3] Ver Estatisticas de um MES especifico (Ex: 2026-09)
echo [4] Ver Estatisticas dos ULTIMOS 10 ANOS (Acumulado Completo)
echo [5] Sair
echo.
echo ====================================================================
set /p OPC="Escolha uma opcao (1-5): "

if "%OPC%"=="1" goto HOJE
if "%OPC%"=="2" goto DIA
if "%OPC%"=="3" goto MES
if "%OPC%"=="4" goto ANOS
if "%OPC%"=="5" exit
echo Opcao invalida! Tente novamente.
timeout /t 2 > nul
goto MENU

:HOJE
cls
echo Gerando estatisticas de HOJE e do MES ATUAL...
node relatorio_estatisticas.js
echo.
pause
goto MENU

:DIA
cls
echo ====================================================================
echo                   RELATORIO POR DIA ESPECIFICO
echo ====================================================================
echo.
set /p DATA_INPUT="Digite a data no formato YYYY-MM-DD (Ex: 2026-09-07): "
if "%DATA_INPUT%"=="" goto MENU
cls
echo Gerando estatisticas para o dia %DATA_INPUT%...
node relatorio_estatisticas.js --dia %DATA_INPUT%
echo.
pause
goto MENU

:MES
cls
echo ====================================================================
echo                  RELATORIO POR MES ESPECIFICO
echo ====================================================================
echo.
set /p MES_INPUT="Digite o ano e mes no formato YYYY-MM (Ex: 2026-09): "
if "%MES_INPUT%"=="" goto MENU
cls
echo Gerando estatisticas para o mes %MES_INPUT%...
node relatorio_estatisticas.js --mes %MES_INPUT%
echo.
pause
goto MENU

:ANOS
cls
echo ====================================================================
echo             RELATORIO ACUMULADO DOS ULTIMOS 10 ANOS
echo ====================================================================
echo.
echo Processando dados acumulados...
node relatorio_estatisticas.js --anos 10
echo.
pause
goto MENU
