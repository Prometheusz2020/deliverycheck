/**
 * DELIVERYCHECK - AGENTE DE SINCRONIZAÇÃO AUTOMÁTICO (GPLUS)
 * VERSION: 1.0.0
 * 
 * Este script roda como um serviço em segundo plano no servidor do restaurante.
 */

const Firebird = require('node-firebird');
const axios = require('axios');

// CONFIGURAÇÕES DO SERVIDOR LOCAL (GPLUS)
const fbOptions = {
    host: '127.0.0.1',
    port: 3050,
    database: 'C:\\Gplus\\DADOS\\GPLUS.FDB',
    user: 'SYSDBA',
    password: 'masterkey',
};

// CONFIGURAÇÕES DA NUVEM (VERCEL)
const VERCEL_URL = 'https://delivery-check-six.vercel.app'; // Verifique sua URL correta
const SYNC_TOKEN = 'ztilabs_sync_secret_2024';
const POLLING_INTERVAL = 30000; // 30 segundos

// Cache simples para evitar reenvios desnecessários se nada mudou
let lastSyncCount = 0;

async function syncAllOrdersFromToday() {
    console.log(`[${new Date().toLocaleTimeString()}] Iniciando verificação de novos pedidos...`);
    
    Firebird.attach(fbOptions, (err, db) => {
        if (err) {
            console.error('[-] Falha ao conectar no Firebird:', err.message);
            return;
        }

        const sql = `
            SELECT 
                C.NUMERO_COMANDA,
                V.NOME_CLIENTE,
                E.LOGRADOURO,
                E.NUMERO AS NUMERO_CASA,
                E.BAIRRO,
                V.VALOR_FINAL
            FROM ECF_VENDA_COMANDA C
            INNER JOIN ECF_VENDA_CABECALHO V ON (V.ID = C.ID_VENDA_CABECALHO)
            LEFT JOIN ENDERECO E ON (E.ID = V.ID_ENDERECO)
            WHERE V.DATA_VENDA = CURRENT_DATE
        `;

        db.query(sql, async (err, result) => {
            if (err) {
                console.error('[-] Erro na consulta SQL:', err.message);
                db.detach();
                return;
            }

            if (result.length === 0) {
                console.log(`[o] Nenhum pedido encontrado para hoje.`);
                db.detach();
                return;
            }

            console.log(`[+] Encontrados ${result.length} pedidos. Sincronizando...`);

            for (const row of result) {
                const orderData = {
                    orderNumber: `#${row.NUMERO_COMANDA}`,
                    customerName: row.NOME_CLIENTE || "Cliente GPlus",
                    address: `${row.LOGRADOURO || 'S/E'}, ${row.NUMERO_CASA || ''} - ${row.BAIRRO || ''}`,
                    totalAmount: parseFloat(row.VALOR_FINAL || 0),
                };

                try {
                    await axios.post(`${VERCEL_URL}/api/sync/order`, {
                        syncToken: SYNC_TOKEN,
                        order: orderData
                    });
                } catch (apiErr) {
                    console.error(`[-] Falha ao enviar pedido #${row.NUMERO_COMANDA}:`, apiErr.message);
                }
            }

            console.log(`[OK] Sincronização concluída.`);
            db.detach();
        });
    });
}

// Inicia em loop
console.log('=========================================');
console.log('       DELIVERYCHECK - SYNC AGENT        ');
console.log('=========================================');
console.log(`Iniciando em modo automático (Intervalo: ${POLLING_INTERVAL/1000}s)`);

syncAllOrdersFromToday();
setInterval(syncAllOrdersFromToday, POLLING_INTERVAL);
