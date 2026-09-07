@echo off
chcp 65001 > nul
title DeliveryCheck - Relatorio Estatistico de Entregas
cls

:MENU
cls
echo ====================================================================
echo                 DELIVERYCHECK - RELATÓRIO DE ENTREGAS
echo ====================================================================
echo.
echo [1] Ver Estatísticas de HOJE e do MÊS ATUAL
echo [2] Ver Estatísticas de um DIA específico (Ex: 2026-09-07)
echo [3] Ver Estatísticas de um MÊS específico (Ex: 2026-09)
echo [4] Ver Estatísticas dos ÚLTIMOS 10 ANOS (Acumulado Completo)
echo [5] Sair
echo.
echo ====================================================================
set /p OPC="Escolha uma opção (1-5): "

if "%OPC%"=="1" goto HOJE
if "%OPC%"=="2" goto DIA
if "%OPC%"=="3" goto MES
if "%OPC%"=="4" goto ANOS
if "%OPC%"=="5" exit
echo Opção inválida! Tente novamente.
timeout /t 2 > nul
goto MENU

:HOJE
cls
echo Gerando estatísticas de HOJE e do MÊS ATUAL...
node relatorio_estatisticas.js
echo.
pause
goto MENU

:DIA
cls
echo ====================================================================
echo                   RELATÓRIO POR DIA ESPECÍFICO
echo ====================================================================
echo.
set /p DATA_INPUT="Digite a data no formato YYYY-MM-DD (Ex: 2026-09-07): "
if "%DATA_INPUT%"=="" goto MENU
cls
echo Gerando estatísticas para o dia %DATA_INPUT%...
node relatorio_estatisticas.js --dia %DATA_INPUT%
echo.
pause
goto MENU

:MES
cls
echo ====================================================================
echo                  RELATÓRIO POR MÊS ESPECÍFICO
echo ====================================================================
echo.
set /p MES_INPUT="Digite o ano e mês no formato YYYY-MM (Ex: 2026-09): "
if "%MES_INPUT%"=="" goto MENU
cls
echo Gerando estatísticas para o mês %MES_INPUT%...
node relatorio_estatisticas.js --mes %MES_INPUT%
echo.
pause
goto MENU

:ANOS
cls
echo ====================================================================
echo             RELATÓRIO ACUMULADO DOS ÚLTIMOS 10 ANOS
echo ====================================================================
echo.
echo Processando dados acumulados...
node relatorio_estatisticas.js --anos 10
echo.
pause
goto MENU
