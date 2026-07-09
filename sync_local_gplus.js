/**
 * DELIVERYCHECK - AGENTE DE SINCRONIZAÇÃO AUTOMÁTICO (GPLUS)
 * VERSION: 1.1.0
 * 
 * Este script roda como um serviço em segundo plano no servidor do restaurante.
 */

require('dotenv').config();
const Firebird = require('node-firebird');
const axios = require('axios');

// CONFIGURAÇÕES DO SERVIDOR LOCAL (GPLUS)
const fbOptions = {
    host: process.env.FB_HOST || '127.0.0.1',
    port: parseInt(process.env.FB_PORT || '3050'),
    database: process.env.FB_DATABASE || 'C:\\Gplus\\DADOS\\GPLUS.FDB',
    user: process.env.FB_USER || 'SYSDBA',
    password: process.env.FB_PASSWORD || 'masterkey',
};

// CONFIGURAÇÕES DA NUVEM (VERCEL)
const VERCEL_URL = process.env.VERCEL_URL || 'https://delivery-check-six.vercel.app';
const SYNC_TOKEN = process.env.SYNC_TOKEN || 'ztilabs_sync_secret_2024';
const POLLING_INTERVAL = parseInt(process.env.POLLING_INTERVAL || '30000'); // 30 segundos

function hasValidAddress(logradouro) {
    if (!logradouro) return false;
    const clean = String(logradouro).trim().toLowerCase();
    
    // Lista de termos comuns para indicar ausência de endereço ou consumo local/retirada
    const invalidKeywords = [
        "", "0", "s/e", "se", "s/n", "sn", "n/a", "na", "null", "undefined", "*", ".", "---",
        "nao informado", "não informado", "nao informada", "não informada",
        "balcao", "balcão", "mesa", "retirada", "consumo local", "estabelecimento"
    ];
    
    if (invalidKeywords.includes(clean)) return false;
    
    // Padrões de placeholder
    if (clean === "s/e, -" || clean.startsWith("s/e,") || clean.replace(/[^a-z0-9]/g, "") === "se") return false;
    
    return true;
}

async function syncAllOrdersFromToday() {
    console.log(`[${new Date().toLocaleTimeString()}] Iniciando verificação de novos pedidos...`);
    
    Firebird.attach(fbOptions, (err, db) => {
        if (err) {
            console.error('[-] Falha ao conectar no Firebird:', err.message);
            console.log('Verifique se o caminho do banco no .env está correto:', fbOptions.database);
            return;
        }

        const sql = `
            SELECT 
                COALESCE(V.NCOMANDA, C.NUMERO_COMANDA, V.ID) AS NUMERO_COMANDA,
                V.NOME_CLIENTE,
                E.LOGRADOURO,
                E.NUMERO AS NUMERO_CASA,
                E.BAIRRO,
                V.VALOR_FINAL,
                COALESCE(V.CUPOM_CANCELADO, 'N') AS CANCELADO,
                COALESCE(V.STATUS_VENDA, 'N') AS STATUS_VENDA,
                COALESCE(V.TOT_QTD, 1) AS QUANTIDADE_ITENS
            FROM ECF_VENDA_CABECALHO V
            LEFT JOIN ECF_VENDA_COMANDA C ON (C.ID_VENDA_CABECALHO = V.ID)
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
                let totalAmount = 0;
                if (row.VALOR_FINAL !== null && row.VALOR_FINAL !== undefined) {
                    const valStr = String(row.VALOR_FINAL).replace(',', '.').trim();
                    totalAmount = parseFloat(valStr);
                }
                if (isNaN(totalAmount)) {
                    totalAmount = 0;
                }

                const isCanceled = row.CANCELADO === 'S' || row.STATUS_VENDA === 'C';

                if (totalAmount <= 0 && !isCanceled) {
                    console.log(`[skip] Ignorando comanda #${String(row.NUMERO_COMANDA).trim()} pois está sem valor (R$ ${totalAmount}).`);
                    continue;
                }

                const logradouro = row.LOGRADOURO;
                if (!hasValidAddress(logradouro) && !isCanceled) {
                    console.log(`[skip] Ignorando comanda #${String(row.NUMERO_COMANDA).trim()} pois não possui endereço válido de entrega.`);
                    continue;
                }

                const addressParts = [];
                if (row.LOGRADOURO) addressParts.push(String(row.LOGRADOURO).trim());
                if (row.NUMERO_CASA) addressParts.push(String(row.NUMERO_CASA).trim());
                if (row.BAIRRO) addressParts.push(String(row.BAIRRO).trim());

                const finalAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Endereço não informado';

                let itemsCount = Math.round(parseFloat(row.QUANTIDADE_ITENS || 1));
                if (isNaN(itemsCount) || itemsCount <= 0) {
                    itemsCount = 1;
                }

                const orderData = {
                    orderNumber: `#${String(row.NUMERO_COMANDA).trim()}`,
                    customerName: (row.NOME_CLIENTE || "Cliente GPlus").trim(),
                    address: finalAddress,
                    totalAmount: totalAmount,
                    status: isCanceled ? 'CANCELADO' : 'PENDENTE',
                    itemsCount: itemsCount
                };

                try {
                    const response = await axios.post(`${VERCEL_URL}/api/sync/order`, {
                        syncToken: SYNC_TOKEN,
                        order: orderData
                    });
                    if (response.data && response.data.message) {
                        console.log(`[+] Comanda #${String(row.NUMERO_COMANDA).trim()}: ${response.data.message}`);
                    } else {
                        console.log(`[+] Comanda #${String(row.NUMERO_COMANDA).trim()} sincronizada.`);
                    }
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
console.log(`Servidor: ${fbOptions.host}:${fbOptions.port}`);
console.log(`Intervalo: ${POLLING_INTERVAL/1000}s`);
console.log('=========================================');

syncAllOrdersFromToday();
setInterval(syncAllOrdersFromToday, POLLING_INTERVAL);
