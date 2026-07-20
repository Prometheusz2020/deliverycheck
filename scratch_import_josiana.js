require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const customerName = "JOSIANA";
  const gplusId = 284;

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
    { type: 'sale', date: '2026-06-22', amount: 23.00 },
    { type: 'sale', date: '2026-06-24', amount: 23.00 },
    { type: 'sale', date: '2026-07-07', amount: 23.00 },
    { type: 'sale', date: '2026-07-08', amount: 23.00 },
    { type: 'payment', date: '2026-07-08', amount: 92.00, notes: 'Pagamento recebido' },
    { type: 'sale', date: '2026-07-15', amount: 23.00 },
    { type: 'sale', date: '2026-07-16', amount: 23.00 },
    { type: 'sale', date: '2026-07-17', amount: 16.00 }
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
