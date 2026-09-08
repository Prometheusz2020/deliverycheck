@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
set NODE_OPTIONS=--max-old-space-size=4096
title DeliveryCheck - Sincronizacao de Historico do Firebird
cls

:MENU
cls
echo ====================================================================
echo          DELIVERYCHECK - SINCRONIZACAO HISTORICA DO FIREBIRD
echo ====================================================================
echo.
echo Este utilitario busca entregas e vendas a prazo (FIADO) antigas
echo salvas no banco Firebird (GPLUS) e envia para o DeliveryCheck.
echo.
echo [1] Sincronizar ultimos 30 dias (1 mes)
echo [2] Sincronizar ultimo 1 ano (365 dias)
echo [3] Sincronizar ultimos 5 anos (1825 dias)
echo [4] Sincronizar ultimos 10 anos (3650 dias)
echo [5] Digitar numero de dias personalizado
echo [6] Sair
echo.
echo ====================================================================
set /p OPC="Escolha uma opcao (1-6): "

if "%OPC%"=="1" set DIAS=30& goto EXECUTAR
if "%OPC%"=="2" set DIAS=365& goto EXECUTAR
if "%OPC%"=="3" set DIAS=1825& goto EXECUTAR
if "%OPC%"=="4" set DIAS=3650& goto EXECUTAR
if "%OPC%"=="5" goto CUSTOM
if "%OPC%"=="6" exit
echo Opcao invalida! Tente novamente.
timeout /t 2 > nul
goto MENU

:CUSTOM
cls
echo ====================================================================
echo             SINCRONIZACAO PERSONALIZADA DE DIAS
echo ====================================================================
echo.
set /p DIAS="Digite a quantidade de dias para buscar no passado (Ex: 180): "
if "%DIAS%"=="" goto MENU
goto EXECUTAR

:EXECUTAR
cls
echo ====================================================================
echo  Sincronizando os ultimos %DIAS% dias do Firebird (GPLUS.FDB)...
echo ====================================================================
echo.
node sync_historico_gplus.js --days %DIAS%
echo.
echo Sincronizacao finalizada! Voce ja pode gerar relatorios.
pause
goto MENU
