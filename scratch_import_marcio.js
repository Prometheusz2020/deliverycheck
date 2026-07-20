require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const marcioName = "MARCIO DA ENCAIXE";
  const gplusId = 2130;

  // Busca ou cria o cliente
  let customer = await prisma.customer.findFirst({
    where: {
      name: {
        equals: marcioName,
        mode: 'insensitive'
      }
    }
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: { 
        name: marcioName,
        gplusId: gplusId
      }
    });
    console.log(`[+] Cliente '${marcioName}' criado com GPlus ID: ${gplusId}.`);
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
    { type: 'sale', date: '2026-06-04', amount: 29.00 },
    { type: 'sale', date: '2026-06-06', amount: 29.00 },
    { type: 'sale', date: '2026-06-07', amount: 29.00 },
    { type: 'sale', date: '2026-06-13', amount: 29.00 },
    { type: 'sale', date: '2026-06-14', amount: 29.00 },
    { type: 'sale', date: '2026-06-20', amount: 29.00 },
    { type: 'sale', date: '2026-06-21', amount: 29.00 },
    { type: 'sale', date: '2026-06-27', amount: 29.00 },
    { type: 'sale', date: '2026-06-28', amount: 29.00 },
    { type: 'sale', date: '2026-07-04', amount: 29.00 },
    { type: 'sale', date: '2026-07-05', amount: 29.00 },
    { type: 'sale', date: '2026-07-11', amount: 29.00 },
    { type: 'sale', date: '2026-07-12', amount: 29.00 },
    { type: 'payment', date: '2026-07-15', amount: 260.00, notes: 'Pagamento recebido' },
    { type: 'sale', date: '2026-07-18', amount: 29.00 },
    { type: 'sale', date: '2026-07-19', amount: 29.00 }
  ];

  console.log(`[+] Processando ${dataList.length} lançamentos para ${marcioName}...`);

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
