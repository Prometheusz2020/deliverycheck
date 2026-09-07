/**
 * DELIVERYCHECK - ESTATÍSTICAS E VOLUME DE ENTREGAS (CLI STANDALONE)
 * 
 * Uso:
 *   node relatorio_estatisticas.js                    (Relatório de Hoje + Resumo do Mês)
 *   node relatorio_estatisticas.js --dia 2026-09-07   (Relatório de um dia específico)
 *   node relatorio_estatisticas.js --mes 2026-09      (Relatório de um mês específico)
 *   node relatorio_estatisticas.js --anos 10          (Relatório acumulado dos últimos 10 anos)
 */

const { execSync } = require('child_process');
require('dotenv').config();

let PrismaClient;
try {
    PrismaClient = require('@prisma/client').PrismaClient;
} catch (e) {
    console.log('[!] Gerando cliente do banco de dados (Prisma)...');
    try {
        execSync('npx prisma generate', { stdio: 'inherit' });
        PrismaClient = require('@prisma/client').PrismaClient;
    } catch (genErr) {
        console.error('[-] Falha ao gerar o Prisma Client:', genErr.message);
        process.exit(1);
    }
}

let prisma;
function getPrisma() {
    if (!prisma) {
        try {
            prisma = new PrismaClient();
        } catch (err) {
            if (err.message && err.message.includes('did not initialize yet')) {
                console.log('[!] Inicializando Prisma Client...');
                try {
                    execSync('npx prisma generate', { stdio: 'inherit' });
                    prisma = new PrismaClient();
                } catch (genErr) {
                    console.error('[-] Falha ao executar prisma generate:', genErr.message);
                    throw err;
                }
            } else {
                throw err;
            }
        }
    }
    return prisma;
}

const formatMoney = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

const parseArgs = () => {
    const args = process.argv.slice(2);
    let period = null;
    let dateStr = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--dia' || args[i] === '-d') {
            period = 'day';
            dateStr = args[i + 1];
            break;
        }
        if (args[i] === '--mes' || args[i] === '-m') {
            period = 'month';
            dateStr = args[i + 1];
            break;
        }
        if (args[i] === '--anos' || args[i] === '-a' || args[i] === '--10anos') {
            period = 'years';
            dateStr = args[i + 1] || '10';
            break;
        }
    }

    return { period, dateStr };
};

async function generateReport(period, dateStr) {
    const db = getPrisma();
    const now = new Date();
    let start, end, title;

    if (period === 'years') {
        const numYears = parseInt(dateStr || '10') || 10;
        start = new Date();
        start.setFullYear(start.getFullYear() - numYears);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        title = `RELATÓRIO ACUMULADO DOS ÚLTIMOS ${numYears} ANOS (${start.getFullYear()} - ${end.getFullYear()})`;
    } else if (period === 'month') {
        let year = now.getFullYear();
        let month = now.getMonth();

        if (dateStr) {
            const parts = dateStr.split('-').map(Number);
            if (parts.length >= 2 && !parts.some(isNaN)) {
                year = parts[0];
                month = parts[1] - 1;
            }
        }
        start = new Date(year, month, 1, 0, 0, 0, 0);
        const lastDay = new Date(year, month + 1, 0).getDate();
        end = new Date(year, month, lastDay, 23, 59, 59, 999);
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        title = `RELATÓRIO MENSAL DE ENTREGAS: ${monthNames[month].toUpperCase()} / ${year}`;
    } else {
        let year = now.getFullYear();
        let month = now.getMonth();
        let day = now.getDate();

        if (dateStr) {
            const parts = dateStr.split('-').map(Number);
            if (parts.length === 3 && !parts.some(isNaN)) {
                year = parts[0];
                month = parts[1] - 1;
                day = parts[2];
            }
        }
        start = new Date(year, month, day, 0, 0, 0, 0);
        end = new Date(year, month, day, 23, 59, 59, 999);
        title = `RELATÓRIO DIÁRIO DE ENTREGAS: ${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
    }

    console.time('Tempo de processamento do banco');

    const [deliveries, drivers] = await Promise.all([
        db.delivery.findMany({
            where: { scannedAt: { gte: start, lte: end } }
        }),
        db.driver.findMany()
    ]);

    console.timeEnd('Tempo de processamento do banco');

    const totalOrders = deliveries.length;
    let deliveredOrders = 0;
    let onRouteOrders = 0;
    let pendingOrders = 0;
    let canceledOrders = 0;
    let totalAmount = 0;
    let totalFees = 0;
    let totalItems = 0;

    const paymentMap = {};
    const driverMap = {};

    for (const dr of drivers) {
        driverMap[dr.id] = {
            name: dr.name,
            totalDeliveries: 0,
            deliveredCount: 0,
            totalAmount: 0,
            totalFees: 0,
            itemsCount: 0
        };
    }

    deliveries.forEach(d => {
        const amt = d.totalAmount || 0;
        const fee = d.deliveryFee || 0;
        const items = d.itemsCount || 1;

        if (d.status === 'ENTREGUE') {
            deliveredOrders++;
            totalAmount += amt;
            totalFees += fee;
            totalItems += items;
        } else if (d.status === 'EM ROTA') {
            onRouteOrders++;
            totalAmount += amt;
            totalFees += fee;
        } else if (d.status === 'PENDENTE') {
            pendingOrders++;
        } else if (d.status === 'CANCELADO') {
            canceledOrders++;
        }

        // Agrupamento por motorista
        let targetDriverId = d.driverId;
        if (!targetDriverId && d.deliveryPerson) {
            const match = drivers.find(dr => dr.name.toLowerCase() === d.deliveryPerson.toLowerCase());
            if (match) targetDriverId = match.id;
        }

        if (targetDriverId && driverMap[targetDriverId]) {
            const dr = driverMap[targetDriverId];
            dr.totalDeliveries++;
            if (d.status === 'ENTREGUE') {
                dr.deliveredCount++;
                dr.totalAmount += amt;
                dr.totalFees += fee;
                dr.itemsCount += items;
            }
        } else if (d.deliveryPerson) {
            const key = `unknown_${d.deliveryPerson}`;
            if (!driverMap[key]) {
                driverMap[key] = {
                    name: d.deliveryPerson,
                    totalDeliveries: 0,
                    deliveredCount: 0,
                    totalAmount: 0,
                    totalFees: 0,
                    itemsCount: 0
                };
            }
            driverMap[key].totalDeliveries++;
            if (d.status === 'ENTREGUE') {
                driverMap[key].deliveredCount++;
                driverMap[key].totalAmount += amt;
                driverMap[key].totalFees += fee;
                driverMap[key].itemsCount += items;
            }
        }

        // Formas de Pagamento
        const method = d.paymentMethod ? d.paymentMethod.trim() : 'Não informado';
        if (!paymentMap[method]) {
            paymentMap[method] = { count: 0, totalAmount: 0 };
        }
        paymentMap[method].count++;
        if (d.status === 'ENTREGUE') {
            paymentMap[method].totalAmount += amt;
        }
    });

    const avgTicket = deliveredOrders > 0 ? totalAmount / deliveredOrders : 0;
    const completionRate = totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(1) : '0.0';

    console.log('\n================================================================================');
    console.log(` ${title}`);
    console.log('================================================================================');
    console.log(`[*] Total de Comandas Registradas: ${totalOrders}`);
    console.log(`[+] Entregas Concluídas:          ${deliveredOrders} (${completionRate}%)`);
    console.log(`[~] Em Rota no momento:           ${onRouteOrders}`);
    console.log(`[?] Pendentes de Atribuição:     ${pendingOrders}`);
    console.log(`[-] Canceladas:                   ${canceledOrders}`);
    console.log('--------------------------------------------------------------------------------');
    console.log(`[$] Faturamento Total Entregas:    ${formatMoney(totalAmount)}`);
    console.log(`[$] Total em Taxas de Motoboys:   ${formatMoney(totalFees)}`);
    console.log(`[$] Ticket Médio por Entrega:      ${formatMoney(avgTicket)}`);
    console.log(`[#] Total de Produtos (Marmitex): ${totalItems} un.`);
    console.log('--------------------------------------------------------------------------------');

    console.log('\n--- DESEMPENHO E VOLUME POR MOTOBOY ---');
    const activeDriverStats = Object.values(driverMap).filter(d => d.totalDeliveries > 0);

    if (activeDriverStats.length === 0) {
        console.log('Nenhuma entrega registrada para motoboys neste período.');
    } else {
        activeDriverStats.sort((a, b) => b.deliveredCount - a.deliveredCount);
        console.log(
            'Nome'.padEnd(20) + 
            'Concluídas'.padStart(12) + 
            'Marmitex'.padStart(10) + 
            'Total R$'.padStart(16) + 
            'Taxas R$'.padStart(14)
        );
        console.log('-'.repeat(72));

        activeDriverStats.forEach(dr => {
            console.log(
                dr.name.substring(0, 18).padEnd(20) + 
                String(dr.deliveredCount).padStart(12) + 
                String(dr.itemsCount).padStart(10) + 
                formatMoney(dr.totalAmount).padStart(16) + 
                formatMoney(dr.totalFees).padStart(14)
            );
        });
    }

    console.log('\n--- FORMAS DE PAGAMENTO UTILIZADAS ---');
    const paymentList = Object.entries(paymentMap).sort((a, b) => b[1].count - a[1].count);
    if (paymentList.length === 0) {
        console.log('Nenhum método de pagamento registrado.');
    } else {
        paymentList.forEach(([method, data]) => {
            console.log(`- ${method.padEnd(25)}: ${data.count} entregas | Total: ${formatMoney(data.totalAmount)}`);
        });
    }

    console.log('================================================================================\n');
}

async function main() {
    try {
        const { period, dateStr } = parseArgs();
        if (period) {
            await generateReport(period, dateStr);
        } else {
            console.log('\n>>> Exibindo Estatísticas de HOJE e do MÊS ATUAL <<<\n');
            await generateReport('day');
            await generateReport('month');
        }
    } catch (err) {
        console.error('Erro ao gerar relatório estatístico:', err.message);
    } finally {
        if (prisma) {
            await prisma.$disconnect();
        }
    }
}

main();
