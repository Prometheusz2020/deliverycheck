require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const joseName = "JOSE";

  // Busca ou cria o cliente
  let customer = await prisma.customer.findFirst({
    where: {
      name: {
        equals: joseName,
        mode: 'insensitive'
      }
    }
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: { name: joseName }
    });
    console.log(`[+] Cliente '${joseName}' criado.`);
  } else {
    console.log(`[+] Cliente '${customer.name}' encontrado com ID: ${customer.id}`);
  }

  // Limpa histórico antigo desse cliente para evitar duplicidade ao re-executar
  const deletedSales = await prisma.creditSale.deleteMany({ where: { customerId: customer.id } });
  const deletedPayments = await prisma.payment.deleteMany({ where: { customerId: customer.id } });
  console.log(`[Clean] Removidos ${deletedSales.count} vendas e ${deletedPayments.count} pagamentos anteriores.`);

  // Lista de lançamentos informados pelo usuário
  const dataList = [
    { type: 'sale', date: '2026-06-20', amount: 35.00 },
    { type: 'sale', date: '2026-06-21', amount: 35.00 },
    { type: 'sale', date: '2026-06-22', amount: 35.00 },
    { type: 'sale', date: '2026-06-23', amount: 35.00 },
    { type: 'sale', date: '2026-06-24', amount: 35.00 },
    { type: 'sale', date: '2026-06-25', amount: 35.00 },
    { type: 'sale', date: '2026-06-26', amount: 35.00 },
    { type: 'sale', date: '2026-06-27', amount: 35.00 },
    { type: 'sale', date: '2026-06-28', amount: 35.00 },
    { type: 'sale', date: '2026-06-29', amount: 35.00 },
    { type: 'sale', date: '2026-06-30', amount: 35.00 },
    { type: 'sale', date: '2026-07-01', amount: 35.00 },
    { type: 'sale', date: '2026-07-02', amount: 35.00 },
    { type: 'sale', date: '2026-07-03', amount: 35.00 },
    { type: 'sale', date: '2026-07-04', amount: 35.00 },
    { type: 'sale', date: '2026-07-05', amount: 35.00 },
    { type: 'sale', date: '2026-07-06', amount: 35.00 },
    { type: 'sale', date: '2026-07-07', amount: 35.00 },
    { type: 'sale', date: '2026-07-08', amount: 35.00 },
    { type: 'sale', date: '2026-07-09', amount: 35.00 },
    { type: 'sale', date: '2026-07-10', amount: 35.00 },
    { type: 'payment', date: '2026-07-10', amount: 735.00, notes: 'Pagamento recebido' },
    { type: 'sale', date: '2026-07-11', amount: 35.00 },
    { type: 'sale', date: '2026-07-12', amount: 35.00 },
    { type: 'sale', date: '2026-07-13', amount: 35.00 },
    { type: 'sale', date: '2026-07-14', amount: 35.00 },
    { type: 'sale', date: '2026-07-15', amount: 35.00 },
    { type: 'sale', date: '2026-07-16', amount: 35.00 }, // Corrigido typo '16/jan' -> 16/jul
    { type: 'sale', date: '2026-07-17', amount: 35.00 },
    { type: 'sale', date: '2026-07-18', amount: 35.00 },
    { type: 'sale', date: '2026-07-19', amount: 35.00 }
  ];

  console.log(`[+] Processando ${dataList.length} lançamentos...`);

  for (const entry of dataList) {
    const entryDate = new Date(`${entry.date}T12:00:00`);

    if (entry.type === 'sale') {
      const sale = await prisma.creditSale.create({
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
      console.log(`[Venda] Criada venda de R$ ${entry.amount.toFixed(2)} em ${entry.date}`);
    } else if (entry.type === 'payment') {
      const payment = await prisma.payment.create({
        data: {
          customerId: customer.id,
          date: entryDate,
          amount: entry.amount,
          paymentMethod: 'DINHEIRO',
          notes: entry.notes || 'Pagamento retroativo'
        }
      });
      console.log(`[Pagamento] Criado pagamento de R$ ${entry.amount.toFixed(2)} em ${entry.date}`);
    }
  }

  console.log('[OK] Importação concluída com sucesso!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
