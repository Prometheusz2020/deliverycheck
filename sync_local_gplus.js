/**
 * DELIVERYCHECK - AGENTE DE SINCRONIZAÇÃO AUTOMÁTICO (GPLUS)
 * VERSION: 1.2.0 (Com suporte a Lotes de Memória Otimizados)
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

// Suporte a argumentos CLI
const args = process.argv.slice(2);
const isFullSync = args.includes('--full') || args.includes('-f');
const isOnce = args.includes('--once');
const daysArgIndex = args.indexOf('--days');
const customDays = daysArgIndex !== -1 && args[daysArgIndex + 1] ? parseInt(args[daysArgIndex + 1]) : null;
const daysBack = customDays || (isFullSync ? 30 : 0);

function hasValidAddress(logradouro) {
    if (!logradouro) return false;
    const clean = String(logradouro).trim().toLowerCase();
    
    const invalidKeywords = [
        "", "0", "s/e", "se", "s/n", "sn", "n/a", "na", "null", "undefined", "*", ".", "---",
        "nao informado", "não informado", "nao informada", "não informada",
        "balcao", "balcão", "mesa", "retirada", "consumo local", "estabelecimento"
    ];
    
    if (invalidKeywords.includes(clean)) return false;
    if (clean === "s/e, -" || clean.startsWith("s/e,") || clean.replace(/[^a-z0-9]/g, "") === "se") return false;
    
    return true;
}

function syncOrdersChunk(fromDays, toDays) {
    return new Promise((resolve) => {
        Firebird.attach(fbOptions, (err, db) => {
            if (err) {
                console.error('[-] Falha ao conectar no Firebird:', err.message);
                return resolve();
            }

            let dateWhere = `V.DATA_VENDA = CURRENT_DATE`;
            if (fromDays !== undefined && fromDays !== null && fromDays > 0) {
                if (toDays !== undefined && toDays !== null && toDays >= 0) {
                    dateWhere = `V.DATA_VENDA >= CURRENT_DATE - ${fromDays} AND V.DATA_VENDA <= CURRENT_DATE - ${toDays}`;
                } else {
                    dateWhere = `V.DATA_VENDA >= CURRENT_DATE - ${fromDays}`;
                }
            }

            const sql = `
                SELECT 
                    COALESCE(V.NCOMANDA, C.NUMERO_COMANDA, V.ID) AS NUMERO_COMANDA,
                    V.NOME_CLIENTE,
                    E.LOGRADOURO,
                    E.NUMERO AS NUMERO_CASA,
                    E.BAIRRO,
                    V.VALOR_FINAL,
                    V.DATA_VENDA,
                    COALESCE(V.CUPOM_CANCELADO, 'N') AS CANCELADO,
                    COALESCE(V.STATUS_VENDA, 'N') AS STATUS_VENDA,
                    COALESCE(V.TOT_QTD, 1) AS QUANTIDADE_ITENS,
                    (
                        SELECT FIRST 1 TP.DESCRICAO 
                        FROM ECF_TOTAL_TIPO_PAGAMENTO P 
                        JOIN ECF_TIPO_PAGAMENTO TP ON (TP.ID = P.ID_ECF_TIPO_PAGAMENTO) 
                        WHERE P.ID_ECF_VENDA_CABECALHO = V.ID AND COALESCE(P.EXCLUIDO, 'N') <> 'S'
                    ) AS TIPO_PAGAMENTO
                FROM ECF_VENDA_CABECALHO V
                LEFT JOIN ECF_VENDA_COMANDA C ON (C.ID_VENDA_CABECALHO = V.ID)
                LEFT JOIN ENDERECO E ON (E.ID = V.ID_ENDERECO)
                WHERE ${dateWhere}
            `;

            db.query(sql, async (err, result) => {
                if (err) {
                    console.error('[-] Erro na consulta SQL:', err.message);
                    db.detach();
                    return resolve();
                }

                if (!result || result.length === 0) {
                    db.detach();
                    return resolve();
                }

                console.log(`[+] Encontradas ${result.length} entregas no lote (-${fromDays} a -${toDays || 0} dias). Sincronizando...`);

                for (const row of result) {
                    let totalAmount = 0;
                    if (row.VALOR_FINAL !== null && row.VALOR_FINAL !== undefined) {
                        const valStr = String(row.VALOR_FINAL).replace(',', '.').trim();
                        totalAmount = parseFloat(valStr);
                    }
                    if (isNaN(totalAmount)) totalAmount = 0;

                    const isCanceled = row.CANCELADO === 'S' || row.STATUS_VENDA === 'C';
                    if (totalAmount <= 0 && !isCanceled) continue;

                    const logradouro = row.LOGRADOURO;
                    if (!hasValidAddress(logradouro) && !isCanceled) continue;

                    const addressParts = [];
                    if (row.LOGRADOURO) addressParts.push(String(row.LOGRADOURO).trim());
                    if (row.NUMERO_CASA) addressParts.push(String(row.NUMERO_CASA).trim());
                    if (row.BAIRRO) addressParts.push(String(row.BAIRRO).trim());

                    const finalAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Endereço não informado';
                    let itemsCount = Math.round(parseFloat(row.QUANTIDADE_ITENS || 1));
                    if (isNaN(itemsCount) || itemsCount <= 0) itemsCount = 1;

                    const orderData = {
                        orderNumber: `#${String(row.NUMERO_COMANDA).trim()}`,
                        customerName: (row.NOME_CLIENTE || "Cliente GPlus").trim(),
                        address: finalAddress,
                        totalAmount: totalAmount,
                        status: isCanceled ? 'CANCELADO' : 'PENDENTE',
                        itemsCount: itemsCount,
                        paymentMethod: row.TIPO_PAGAMENTO ? String(row.TIPO_PAGAMENTO).trim() : null,
                        date: row.DATA_VENDA
                    };

                    try {
                        await axios.post(`${VERCEL_URL}/api/sync/order`, {
                            syncToken: SYNC_TOKEN,
                            order: orderData
                        });
                    } catch (apiErr) {
                        // ignore failure for single order
                    }
                }

                db.detach();
                resolve();
            });
        });
    });
}

const syncedFiadoGPlusIds = new Set();

function syncFiadoChunk(fromDays, toDays) {
    return new Promise((resolve) => {
        Firebird.attach(fbOptions, (err, db) => {
            if (err) {
                console.error('[-] Falha ao conectar no Firebird para FIADO:', err.message);
                return resolve();
            }

            let dateWhere = `(V.DATA_VENDA = CURRENT_DATE OR V.DATA_HORA_ULTIMA_ALTERACAO >= CURRENT_TIMESTAMP - 1)`;
            if (fromDays !== undefined && fromDays !== null && fromDays > 0) {
                if (toDays !== undefined && toDays !== null && toDays >= 0) {
                    dateWhere = `V.DATA_VENDA >= CURRENT_DATE - ${fromDays} AND V.DATA_VENDA <= CURRENT_DATE - ${toDays}`;
                } else {
                    dateWhere = `V.DATA_VENDA >= CURRENT_DATE - ${fromDays}`;
                }
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
                LEFT JOIN ECF_TOTAL_TIPO_PAGAMENTO P ON (P.ID_ECF_VENDA_CABECALHO = V.ID AND COALESCE(P.EXCLUIDO, 'N') <> 'S')
                LEFT JOIN ECF_TIPO_PAGAMENTO TP ON (TP.ID = P.ID_ECF_TIPO_PAGAMENTO)
                WHERE ${dateWhere}
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
                WHERE ${dateWhere}
                  AND COALESCE(D.CANCELADO, 'N') <> 'S'
            `;

            db.query(detailsSql, (detailsErr, detailsResult) => {
                const itemsByVenda = {};
                if (detailsResult) {
                    for (const row of detailsResult) {
                        const idVenda = row.ID_VENDA;
                        if (!itemsByVenda[idVenda]) itemsByVenda[idVenda] = [];
                        itemsByVenda[idVenda].push({
                            description: String(row.NOME_PROD || 'Produto').trim(),
                            quantity: parseFloat(row.QUANTIDADE || 1),
                            unitPrice: parseFloat(row.VALOR_UNITARIO || 0),
                            totalPrice: parseFloat(row.VALOR_TOTAL || 0)
                        });
                    }
                }

                db.query(sql, async (err, result) => {
                    if (err || !result || result.length === 0) {
                        db.detach();
                        return resolve();
                    }

                    const fiadoKeywords = ['PRAZO', 'FIADO', 'CONVENIO', 'CONVÊNIO', 'ASSINATURA'];
                    const salesById = {};

                    for (const row of result) {
                        const gplusId = String(row.GPLUS_ID).trim();
                        if (!salesById[gplusId]) {
                            salesById[gplusId] = {
                                gplusId: gplusId,
                                gplusCustomerId: row.GPLUS_CLIENTE_ID ? parseInt(row.GPLUS_CLIENTE_ID) : null,
                                orderNumber: String(row.NUMERO_COMANDA).trim(),
                                customerName: String(row.NOME_CLIENTE || 'Cliente GPlus').trim(),
                                date: row.DATA_VENDA,
                                isCanceled: row.CANCELADO === 'S' || row.STATUS_VENDA === 'C',
                                fiadoAmount: 0,
                                fiadoTypes: [],
                                hasFiado: false
                            };
                        }

                        if (row.TIPO_PAGAMENTO && row.VALOR_PAGAMENTO !== null && row.VALOR_PAGAMENTO !== undefined) {
                            const desc = String(row.TIPO_PAGAMENTO).toUpperCase();
                            if (fiadoKeywords.some(kw => desc.includes(kw))) {
                                const val = parseFloat(String(row.VALOR_PAGAMENTO).replace(',', '.').trim()) || 0;
                                if (val > 0) {
                                    salesById[gplusId].fiadoAmount += val;
                                    salesById[gplusId].fiadoTypes.push(String(row.TIPO_PAGAMENTO).trim());
                                    salesById[gplusId].hasFiado = true;
                                }
                            }
                        }
                    }

                    const salesList = Object.values(salesById);
                    for (const sale of salesList) {
                        const { gplusId, orderNumber, customerName, gplusCustomerId, date, isCanceled, fiadoAmount, fiadoTypes, hasFiado } = sale;
                        if (hasFiado && fiadoAmount > 0 && !isCanceled) {
                            syncedFiadoGPlusIds.add(gplusId);
                            const saleData = {
                                gplusId: gplusId,
                                orderNumber: orderNumber,
                                customerName: customerName,
                                gplusCustomerId: gplusCustomerId,
                                totalAmount: fiadoAmount,
                                date: date,
                                notes: `Sincronizado do GPlus (Comanda #${orderNumber} via ${fiadoTypes.join(', ')})`,
                                status: 'PENDENTE',
                                isFiado: true,
                                items: itemsByVenda[gplusId] || []
                            };

                            try {
                                await axios.post(`${VERCEL_URL}/api/sync/credit-sale`, {
                                    syncToken: SYNC_TOKEN,
                                    creditSale: saleData
                                });
                            } catch (apiErr) {
                                // ignore
                            }
                        }
                    }

                    db.detach();
                    resolve();
                });
            });
        });
    });
}

async function runAllSyncJobs(overrideDays = null) {
    const totalDays = overrideDays !== null ? overrideDays : daysBack;

    if (totalDays > 30) {
        const chunkSize = 30; // Lote de 30 dias por vez para manter memória ultra baixa
        console.log(`[+] Sincronizando ${totalDays} dias em lotes otimizados de ${chunkSize} dias...`);
        for (let current = totalDays; current > 0; current -= chunkSize) {
            const fromDays = current;
            const toDays = Math.max(0, current - chunkSize);
            console.log(`[+] [LOTE HISTÓRICO] Processando entregas e fiados (dias -${fromDays} a -${toDays})...`);
            await syncOrdersChunk(fromDays, toDays);
            await syncFiadoChunk(fromDays, toDays);
            await new Promise(r => setTimeout(r, 150));
        }
        console.log(`[OK] Todos os lotes históricos foram sincronizados.`);
    } else {
        await syncOrdersChunk(totalDays, 0);
        await syncFiadoChunk(totalDays, 0);
    }
}

let lastMorningSyncDate = null;
function checkScheduledMorningSync() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (now.getHours() === 9 && now.getMinutes() === 0 && lastMorningSyncDate !== todayStr) {
        lastMorningSyncDate = todayStr;
        console.log(`[+] [09:00 AM] Executando Sincronização Matinal Programada (últimos 7 dias)...`);
        runAllSyncJobs(7);
    }
}

async function startAgent() {
    console.log('=========================================');
    console.log('       DELIVERYCHECK - SYNC AGENT        ');
    console.log('=========================================');
    console.log(`Servidor: ${fbOptions.host}:${fbOptions.port}`);
    console.log(`Intervalo: ${POLLING_INTERVAL/1000}s`);
    console.log('=========================================');

    if (isOnce) {
        const effectiveDays = daysBack || 30;
        console.log(`[+] Executando Sincronização Histórica Única (${effectiveDays} dias)...`);
        await runAllSyncJobs(effectiveDays);
        console.log('\n=========================================');
        console.log(' [OK] SINCRONIZAÇÃO HISTÓRICA CONCLUÍDA!');
        console.log('=========================================\n');
        process.exit(0);
    } else {
        console.log(`[+] [STARTUP] Computador/Serviço ligado: Executando Sincronização Inicial (${daysBack || 7} dias)...`);
        await runAllSyncJobs(daysBack || 7);

        setInterval(() => {
            checkScheduledMorningSync();
            runAllSyncJobs();
        }, POLLING_INTERVAL);
    }
}

startAgent();
