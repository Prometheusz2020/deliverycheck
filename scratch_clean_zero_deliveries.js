require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Encontra todas as entregas de hoje com valor <= 0 ou nulo
  const zeroDeliveries = await prisma.delivery.findMany({
    where: {
      scannedAt: { gte: today },
      OR: [
        { totalAmount: { lte: 0 } },
        { totalAmount: null }
      ]
    }
  });

  console.log('[+] Encontradas entregas zeradas/nulas para hoje:');
  zeroDeliveries.forEach(d => {
    console.log(`ID: ${d.id} | Comanda: ${d.orderNumber} | Cliente: ${d.customerName} | Valor: ${d.totalAmount}`);
  });

  if (zeroDeliveries.length > 0) {
    const ids = zeroDeliveries.map(d => d.id);
    const deleteResult = await prisma.delivery.deleteMany({
      where: {
        id: { in: ids }
      }
    });
    console.log(`[OK] Deletadas ${deleteResult.count} entregas zeradas do banco de dados.`);
  } else {
    console.log('[-] Nenhuma entrega zerada encontrada para hoje.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
