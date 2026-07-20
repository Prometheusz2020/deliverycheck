require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mixiricaName = "MIXIRICA";

  // Busca ou cria o cliente
  let customer = await prisma.customer.findFirst({
    where: {
      name: {
        equals: mixiricaName,
        mode: 'insensitive'
      }
    }
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: { name: mixiricaName }
    });
    console.log(`[+] Cliente '${mixiricaName}' criado.`);
  } else {
    console.log(`[+] Cliente '${customer.name}' encontrado com ID: ${customer.id}`);
  }

  // Limpa histórico antigo desse cliente para evitar duplicidade ao re-executar
  const deletedSales = await prisma.creditSale.deleteMany({ where: { customerId: customer.id } });
  const deletedPayments = await prisma.payment.deleteMany({ where: { customerId: customer.id } });
  console.log(`[Clean] Removidos ${deletedSales.count} vendas e ${deletedPayments.count} pagamentos anteriores.`);

  // Lista de lançamentos informados pelo usuário
  const dataList = [
    { type: 'payment', date: '2026-01-01', amount: 1225.50, notes: 'Pagamento retroativo' },
    { type: 'sale', date: '2026-05-09', amount: 36.00 },
    { type: 'sale', date: '2026-05-10', amount: 70.00 },
    { type: 'sale', date: '2026-05-11', amount: 32.00 },
    { type: 'sale', date: '2026-05-11', amount: 36.00 },
    { type: 'sale', date: '2026-05-12', amount: 36.00 },
    { type: 'sale', date: '2026-05-12', amount: 35.00 },
    { type: 'sale', date: '2026-05-13', amount: 35.00 },
    { type: 'sale', date: '2026-05-13', amount: 36.00 },
    { type: 'sale', date: '2026-05-14', amount: 30.00 },
    { type: 'sale', date: '2026-05-14', amount: 36.00 },
    { type: 'sale', date: '2026-05-15', amount: 36.00 },
    { type: 'sale', date: '2026-05-15', amount: 35.00 },
    { type: 'sale', date: '2026-05-16', amount: 44.00 },
    { type: 'sale', date: '2026-05-18', amount: 36.00 },
    { type: 'sale', date: '2026-05-18', amount: 35.00 },
    { type: 'sale', date: '2026-05-19', amount: 36.00 },
    { type: 'sale', date: '2026-05-19', amount: 35.00 },
    { type: 'sale', date: '2026-05-20', amount: 35.00 },
    { type: 'sale', date: '2026-05-20', amount: 36.00 },
    { type: 'sale', date: '2026-05-21', amount: 35.00 },
    { type: 'sale', date: '2026-05-21', amount: 30.00 },
    { type: 'sale', date: '2026-05-22', amount: 36.00 },
    { type: 'sale', date: '2026-05-23', amount: 36.00 },
    { type: 'sale', date: '2026-05-25', amount: 36.00 },
    { type: 'sale', date: '2026-05-26', amount: 36.00 },
    { type: 'sale', date: '2026-05-26', amount: 35.00 },
    { type: 'sale', date: '2026-05-27', amount: 36.00 },
    { type: 'sale', date: '2026-05-27', amount: 35.00 },
    { type: 'sale', date: '2026-05-28', amount: 35.00 },
    { type: 'sale', date: '2026-05-29', amount: 36.00 },
    { type: 'sale', date: '2026-05-29', amount: 38.00 },
    { type: 'sale', date: '2026-06-01', amount: 36.00 },
    { type: 'sale', date: '2026-06-01', amount: 38.00 },
    { type: 'sale', date: '2026-06-02', amount: 36.00 },
    { type: 'sale', date: '2026-06-02', amount: 38.00 },
    { type: 'sale', date: '2026-06-03', amount: 38.00 },
    { type: 'sale', date: '2026-06-04', amount: 26.00 },
    { type: 'sale', date: '2026-06-05', amount: 36.00 },
    { type: 'sale', date: '2026-06-05', amount: 40.00 },
    { type: 'sale', date: '2026-06-05', amount: 33.00 },
    { type: 'sale', date: '2026-06-06', amount: 36.00 },
    { type: 'sale', date: '2026-06-06', amount: 38.00 },
    { type: 'sale', date: '2026-06-07', amount: 32.00 },
    { type: 'sale', date: '2026-06-08', amount: 44.00 },
    { type: 'sale', date: '2026-06-09', amount: 36.00 },
    { type: 'sale', date: '2026-06-09', amount: 40.00 },
    { type: 'sale', date: '2026-06-10', amount: 38.00 },
    { type: 'sale', date: '2026-06-10', amount: 36.00 },
    { type: 'sale', date: '2026-06-11', amount: 38.00 },
    { type: 'sale', date: '2026-06-11', amount: 36.00 },
    { type: 'sale', date: '2026-06-12', amount: 36.00 },
    { type: 'sale', date: '2026-06-13', amount: 44.00 },
    { type: 'sale', date: '2026-06-15', amount: 31.00 },
    { type: 'sale', date: '2026-06-15', amount: 44.00 },
    { type: 'sale', date: '2026-06-16', amount: 38.00 },
    { type: 'sale', date: '2026-06-16', amount: 36.00 },
    { type: 'sale', date: '2026-06-17', amount: 40.00 },
    { type: 'sale', date: '2026-06-17', amount: 36.00 },
    { type: 'sale', date: '2026-06-18', amount: 40.00 },
    { type: 'sale', date: '2026-06-18', amount: 36.00 },
    { type: 'sale', date: '2026-06-19', amount: 36.00 },
    { type: 'sale', date: '2026-06-19', amount: 40.00 },
    { type: 'sale', date: '2026-06-20', amount: 36.00 },
    { type: 'sale', date: '2026-06-22', amount: 40.00 },
    { type: 'sale', date: '2026-06-22', amount: 36.00 },
    { type: 'sale', date: '2026-06-24', amount: 40.00 },
    { type: 'sale', date: '2026-06-24', amount: 30.00 },
    { type: 'sale', date: '2026-06-25', amount: 30.00 },
    { type: 'sale', date: '2026-06-25', amount: 37.00 },
    { type: 'sale', date: '2026-06-26', amount: 40.00 },
    { type: 'sale', date: '2026-06-27', amount: 116.00 },
    { type: 'sale', date: '2026-06-27', amount: 29.00 },
    { type: 'sale', date: '2026-06-28', amount: 35.00 },
    { type: 'sale', date: '2026-06-29', amount: 40.00 },
    { type: 'sale', date: '2026-06-29', amount: 36.00 },
    { type: 'sale', date: '2026-06-30', amount: 36.00 },
    { type: 'sale', date: '2026-06-30', amount: 37.00 },
    { type: 'sale', date: '2026-07-01', amount: 61.00 },
    { type: 'sale', date: '2026-07-02', amount: 36.00 },
    { type: 'sale', date: '2026-07-02', amount: 37.00 },
    { type: 'sale', date: '2026-07-03', amount: 73.00 },
    { type: 'sale', date: '2026-07-04', amount: 36.00 },
    { type: 'sale', date: '2026-07-04', amount: 30.00 },
    { type: 'sale', date: '2026-07-05', amount: 42.00 },
    { type: 'sale', date: '2026-07-06', amount: 29.00 },
    { type: 'sale', date: '2026-07-07', amount: 31.00 },
    { type: 'sale', date: '2026-07-07', amount: 36.00 },
    { type: 'sale', date: '2026-07-08', amount: 36.00 },
    { type: 'sale', date: '2026-07-08', amount: 34.00 },
    { type: 'sale', date: '2026-07-11', amount: 38.00 },
    { type: 'sale', date: '2026-07-15', amount: 38.00 },
    { type: 'sale', date: '2026-07-15', amount: 36.00 },
    { type: 'sale', date: '2026-07-16', amount: 38.00 },
    { type: 'sale', date: '2026-07-16', amount: 36.00 },
    { type: 'sale', date: '2026-07-17', amount: 36.00 },
    { type: 'sale', date: '2026-07-17', amount: 38.00 },
    { type: 'sale', date: '2026-07-18', amount: 25.00 },
    { type: 'sale', date: '2026-07-19', amount: 40.00 }
  ];

  console.log(`[+] Processando ${dataList.length} lançamentos para ${mixiricaName}...`);

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
