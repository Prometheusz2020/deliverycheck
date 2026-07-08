require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const deliveries = await prisma.delivery.findMany({
    orderBy: { scannedAt: 'desc' },
    take: 15
  });

  console.log('[+] Last 15 synced deliveries:');
  deliveries.forEach(d => {
    console.log(`Order: ${d.orderNumber}`);
    console.log(`  Customer: ${d.customerName}`);
    console.log(`  Amount: ${d.totalAmount}`);
    console.log(`  Payment Method: ${d.paymentMethod}`);
    console.log(`  Observations: ${d.observations}`);
    console.log('--------------------------------------------------');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
