@echo off
:: Garante que o diretorio de trabalho seja a pasta onde este arquivo .bat esta localizado
cd /d "%~dp0"

TITLE DeliveryCheck - Agente de Sincronizacao GPlus
echo ==========================================
echo   DELIVERYCHECK - SYNC AGENT (NODE.JS)
echo ==========================================
echo Iniciando sincronizacao...

:: Verifica se a pasta node_modules existe
if not exist "node_modules" (
    echo [!] Dependencias nao encontradas. Rodando npm install...
    call npm install
)

:: Executa o script de sincronizacao
call npm run sync

pause
