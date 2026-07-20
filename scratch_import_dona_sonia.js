require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const soniaName = "DONA SONIA";

  // Busca ou cria o cliente
  let customer = await prisma.customer.findFirst({
    where: {
      name: {
        equals: soniaName,
        mode: 'insensitive'
      }
    }
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: { name: soniaName }
    });
    console.log(`[+] Cliente '${soniaName}' criado.`);
  } else {
    console.log(`[+] Cliente '${customer.name}' encontrado com ID: ${customer.id}`);
  }

  // Limpa histórico antigo desse cliente para evitar duplicidade ao re-executar
  const deletedSales = await prisma.creditSale.deleteMany({ where: { customerId: customer.id } });
  const deletedPayments = await prisma.payment.deleteMany({ where: { customerId: customer.id } });
  console.log(`[Clean] Removidos ${deletedSales.count} vendas e ${deletedPayments.count} pagamentos anteriores.`);

  // Lista de lançamentos informados pelo usuário
  const dataList = [
    { type: 'sale', date: '2026-01-08', amount: 51.00 },
    { type: 'sale', date: '2026-06-29', amount: 34.00 },
    { type: 'sale', date: '2026-06-30', amount: 31.00 },
    { type: 'sale', date: '2026-07-02', amount: 33.00 },
    { type: 'sale', date: '2026-07-03', amount: 34.00 },
    { type: 'sale', date: '2026-07-05', amount: 45.00 },
    { type: 'sale', date: '2026-07-06', amount: 30.00 },
    { type: 'payment', date: '2026-07-08', amount: 258.00, notes: 'Pagamento recebido' },
    { type: 'sale', date: '2026-07-09', amount: 39.00 },
    { type: 'sale', date: '2026-07-10', amount: 35.00 },
    { type: 'sale', date: '2026-07-11', amount: 30.00 },
    { type: 'sale', date: '2026-07-15', amount: 34.00 },
    { type: 'sale', date: '2026-07-16', amount: 34.00 },
    { type: 'sale', date: '2026-07-17', amount: 34.00 },
    { type: 'sale', date: '2026-07-13', amount: 51.00 },
    { type: 'payment', date: '2026-07-17', amount: 257.00, notes: 'Pagamento recebido' },
    { type: 'sale', date: '2026-07-18', amount: 34.00 },
    { type: 'sale', date: '2026-07-19', amount: 38.00 }
  ];

  console.log(`[+] Processando ${dataList.length} lançamentos para ${soniaName}...`);

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
    } else if (entry.type === 'payment') {
      await prisma.payment.create({
        data: {
          customerId: customer.id,
          date: entryDate,
          amount: entry.amount,
          paymentMethod: 'DINHEIRO',
          notes: entry.notes || 'Pagamento retroativo'
        }
      });
    }
  }

  console.log('[OK] Importação concluída com sucesso!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
