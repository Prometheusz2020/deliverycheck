require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const faveroName = "TRANSPORTADORA FÁVERO";
  const gplusId = 6434;

  // Busca ou cria o cliente
  let customer = await prisma.customer.findFirst({
    where: {
      name: {
        equals: faveroName,
        mode: 'insensitive'
      }
    }
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: { 
        name: faveroName,
        gplusId: gplusId
      }
    });
    console.log(`[+] Cliente '${faveroName}' criado com GPlus ID: ${gplusId}.`);
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
    { type: 'sale', date: '2026-05-20', amount: 28.00 },
    { type: 'sale', date: '2026-05-27', amount: 28.00 },
    { type: 'sale', date: '2026-06-03', amount: 28.00 },
    { type: 'sale', date: '2026-06-10', amount: 28.00 },
    { type: 'sale', date: '2026-06-17', amount: 28.00 },
    { type: 'sale', date: '2026-06-24', amount: 28.00 },
    { type: 'sale', date: '2026-06-30', amount: 28.00 },
    { type: 'sale', date: '2026-07-01', amount: 28.00 },
    { type: 'sale', date: '2026-07-07', amount: 28.00 },
    { type: 'sale', date: '2026-07-08', amount: 28.00 },
    { type: 'sale', date: '2026-07-15', amount: 28.00 },
    { type: 'sale', date: '2026-07-16', amount: 51.00 }
  ];

  console.log(`[+] Processando ${dataList.length} lançamentos para ${faveroName}...`);

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
