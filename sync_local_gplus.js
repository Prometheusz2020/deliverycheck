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

            console.log(`[OK] Sincronização de entregas concluída.`);
            db.detach();
        });
    });
}

async function syncFiadoOrdersFromToday() {
    console.log(`[${new Date().toLocaleTimeString()}] Iniciando verificação de vendas a prazo (FIADO)...`);
    
    Firebird.attach(fbOptions, (err, db) => {
        if (err) {
            console.error('[-] Falha ao conectar no Firebird para FIADO:', err.message);
            return;
        }

        const sql = `
            SELECT 
                V.ID AS GPLUS_ID,
                V.ID_CLIENTE AS GPLUS_CLIENTE_ID,
                COALESCE(V.NCOMANDA, C.NUMERO_COMANDA, V.ID) AS NUMERO_COMANDA,
                V.NOME_CLIENTE,
                V.DATA_VENDA,
                P.VALOR AS VALOR_PAGAMENTO,
                TP.DESCRICAO AS TIPO_PAGAMENTO,
                COALESCE(V.CUPOM_CANCELADO, 'N') AS CANCELADO,
                COALESCE(V.STATUS_VENDA, 'N') AS STATUS_VENDA
            FROM ECF_VENDA_CABECALHO V
            LEFT JOIN ECF_VENDA_COMANDA C ON (C.ID_VENDA_CABECALHO = V.ID)
            JOIN ECF_TOTAL_TIPO_PAGAMENTO P ON (P.ID_ECF_VENDA_CABECALHO = V.ID)
            JOIN ECF_TIPO_PAGAMENTO TP ON (TP.ID = P.ID_ECF_TIPO_PAGAMENTO)
            WHERE V.DATA_VENDA = CURRENT_DATE
        `;

        const detailsSql = `
            SELECT 
                D.ID_ECF_VENDA_CABECALHO AS ID_VENDA,
                COALESCE(D.NOME_PROD, P.DESCRICAO, P.NOME, 'Produto') AS NOME_PROD,
                D.QUANTIDADE,
                D.VALOR_UNITARIO,
                D.VALOR_TOTAL
            FROM ECF_VENDA_DETALHE D
            LEFT JOIN PRODUTO P ON (P.ID = D.ID_ECF_PRODUTO)
            JOIN ECF_VENDA_CABECALHO V ON (V.ID = D.ID_ECF_VENDA_CABECALHO)
            WHERE V.DATA_VENDA = CURRENT_DATE
              AND COALESCE(D.CANCELADO, 'N') <> 'S'
        `;

        db.query(detailsSql, (detailsErr, detailsResult) => {
            const itemsByVenda = {};
            if (detailsErr) {
                console.error('[-] Erro ao carregar detalhes das comandas:', detailsErr.message);
            } else if (detailsResult) {
                for (const row of detailsResult) {
                    const idVenda = row.ID_VENDA;
                    if (!itemsByVenda[idVenda]) {
                        itemsByVenda[idVenda] = [];
                    }
                    itemsByVenda[idVenda].push({
                        description: String(row.NOME_PROD || 'Produto').trim(),
                        quantity: parseFloat(row.QUANTIDADE || 1),
                        unitPrice: parseFloat(row.VALOR_UNITARIO || 0),
                        totalPrice: parseFloat(row.VALOR_TOTAL || 0)
                    });
                }
            }

            db.query(sql, async (err, result) => {
                if (err) {
                    console.error('[-] Erro na consulta SQL FIADO:', err.message);
                    db.detach();
                    return;
                }

                if (result.length === 0) {
                    console.log(`[o] Nenhuma venda a prazo encontrada hoje.`);
                    db.detach();
                    return;
                }

                // Filtro case-insensitive para formas de pagamento do FIADO
                const fiadoKeywords = ['PRAZO', 'FIADO', 'CONVENIO', 'CONVÊNIO', 'ASSINATURA'];
                const fiadoSales = result.filter(row => {
                    const desc = String(row.TIPO_PAGAMENTO || '').toUpperCase();
                    return fiadoKeywords.some(kw => desc.includes(kw));
                });

                if (fiadoSales.length === 0) {
                    db.detach();
                    return;
                }

                console.log(`[+] Encontradas ${fiadoSales.length} comandas com pagamento FIADO. Sincronizando...`);

                for (const row of fiadoSales) {
                    const gplusId = String(row.GPLUS_ID).trim();
                    const orderNumber = String(row.NUMERO_COMANDA).trim();
                    const customerName = String(row.NOME_CLIENTE || 'Cliente GPlus').trim();
                    
                    let valorPagamento = 0;
                    if (row.VALOR_PAGAMENTO !== null && row.VALOR_PAGAMENTO !== undefined) {
                        valorPagamento = parseFloat(String(row.VALOR_PAGAMENTO).replace(',', '.').trim());
                    }
                    if (isNaN(valorPagamento) || valorPagamento <= 0) {
                        continue;
                    }

                    const isCanceled = row.CANCELADO === 'S' || row.STATUS_VENDA === 'C';

                    const saleData = {
                        gplusId: gplusId,
                        orderNumber: orderNumber,
                        customerName: customerName,
                        gplusCustomerId: row.GPLUS_CLIENTE_ID ? parseInt(row.GPLUS_CLIENTE_ID) : null,
                        totalAmount: valorPagamento,
                        date: row.DATA_VENDA,
                        notes: `Sincronizado do GPlus (Comanda #${orderNumber} via ${String(row.TIPO_PAGAMENTO).trim()})`,
                        status: isCanceled ? 'CANCELADO' : 'PENDENTE',
                        items: itemsByVenda[row.GPLUS_ID] || []
                    };

                try {
                    const response = await axios.post(`${VERCEL_URL}/api/sync/credit-sale`, {
                        syncToken: SYNC_TOKEN,
                        creditSale: saleData
                    });
                    if (response.data && response.data.message) {
                        console.log(`[+] FIADO Comanda #${orderNumber} (${customerName}): ${response.data.message}`);
                    } else {
                        console.log(`[+] FIADO Comanda #${orderNumber} (${customerName}) sincronizada.`);
                    }
                } catch (apiErr) {
                    console.error(`[-] Falha ao enviar FIADO Comanda #${orderNumber}:`, apiErr.message);
                }
            }

            console.log(`[OK] Sincronização de FIADO concluída.`);
            db.detach();
        });
    });
});
}

function runAllSyncJobs() {
    syncAllOrdersFromToday();
    // Roda a sincronização de FIADO 3 segundos depois da de entregas para evitar concorrência direta
    setTimeout(syncFiadoOrdersFromToday, 3000);
}

// Inicia em loop
console.log('=========================================');
console.log('       DELIVERYCHECK - SYNC AGENT        ');
console.log('=========================================');
console.log(`Servidor: ${fbOptions.host}:${fbOptions.port}`);
console.log(`Intervalo: ${POLLING_INTERVAL/1000}s`);
console.log('=========================================');

runAllSyncJobs();
setInterval(runAllSyncJobs, POLLING_INTERVAL);
