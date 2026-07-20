require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const customerName = "METALURGICA MOCOCA SA";
  const gplusId = 2568;

  // Busca ou cria o cliente
  let customer = await prisma.customer.findFirst({
    where: {
      name: {
        equals: customerName,
        mode: 'insensitive'
      }
    }
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: { 
        name: customerName,
        gplusId: gplusId
      }
    });
    console.log(`[+] Cliente '${customerName}' criado com GPlus ID: ${gplusId}.`);
  } else {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: { gplusId: gplusId }
    });
    console.log(`[+] Cliente '${customer.name}' atualizado com GPlus ID: ${gplusId}.`);
  }

  // Limpa histórico antigo desse cliente para evitar duplicidade ao re-executar
  const deletedSales = await prisma.creditSale.deleteMany({ where: { customerId: customer.id } });
  const deletedPayments = await prisma.payment.deleteMany({ where: { customerId: customer.id } });
  console.log(`[Clean] Removidos ${deletedSales.count} vendas e ${deletedPayments.count} pagamentos anteriores.`);

  // Lista de lançamentos informados pelo usuário
  const dataList = [
    { type: 'sale', date: '2026-06-04', amount: 26.00 },
    { type: 'sale', date: '2026-06-04', amount: 78.00 },
    { type: 'sale', date: '2026-06-06', amount: 26.00 },
    { type: 'sale', date: '2026-06-07', amount: 78.00 },
    { type: 'sale', date: '2026-06-07', amount: 26.00 },
    { type: 'sale', date: '2026-06-13', amount: 26.00 },
    { type: 'sale', date: '2026-06-14', amount: 78.00 },
    { type: 'sale', date: '2026-06-14', amount: 26.00 },
    { type: 'sale', date: '2026-06-20', amount: 26.00 },
    { type: 'sale', date: '2026-06-21', amount: 26.00 },
    { type: 'sale', date: '2026-06-21', amount: 52.00 },
    { type: 'sale', date: '2026-06-27', amount: 26.00 },
    { type: 'sale', date: '2026-06-28', amount: 26.00 },
    { type: 'sale', date: '2026-06-28', amount: 130.00 },
    { type: 'sale', date: '2026-07-04', amount: 26.00 },
    { type: 'sale', date: '2026-07-05', amount: 78.00 },
    { type: 'sale', date: '2026-07-05', amount: 26.00 },
    { type: 'sale', date: '2026-07-09', amount: 26.00 },
    { type: 'sale', date: '2026-07-11', amount: 26.00 },
    { type: 'sale', date: '2026-07-12', amount: 26.00 },
    { type: 'sale', date: '2026-07-12', amount: 78.00 },
    { type: 'sale', date: '2026-07-18', amount: 26.00 },
    { type: 'sale', date: '2026-07-19', amount: 26.00 },
    { type: 'sale', date: '2026-07-19', amount: 78.00 }
  ];

  console.log(`[+] Processando ${dataList.length} lançamentos para ${customerName}...`);

  for (const entry of dataList) {
    const entryDate = new Date(`${entry.date}T12:00:00`);

    if (entry.type === 'sale') {
      await prisma.creditSale.create({
        data: {
          customerId: customer.id,
          date: entryDate,
          totalAmount: entry.amount,
          status: 'PENDENTE',
          notes: 'Lançamento retroativo comanda antiga',
          items: {
            create: {
              description: 'Comanda antiga',
              quantity: 1,
              unitPrice: entry.amount,
              totalPrice: entry.amount
            }
          }
        }
      });
    }
  }

  console.log('[OK] Importação concluída com sucesso!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
