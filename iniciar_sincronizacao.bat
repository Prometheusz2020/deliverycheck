@echo off
TITLE DeliveryCheck - Agente de Sincronizacao GPlus
echo ==========================================
echo   DELIVERYCHECK - SYNC AGENT (NODE.JS)
echo ==========================================
echo Iniciando sincronizacao...

:: Verifica se a pasta node_modules existe
if not exist "node_modules" (
    echo [!] Dependencias nao encontradas. Rodando npm install...
    npm install
)

:: Executa o script de sincronizacao
npm run sync

pause
