
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding data...')

  // Clear existing
  await prisma.delivery.deleteMany()
  await prisma.admin.deleteMany()
  await prisma.driver.deleteMany()

  // Create Admins
  const admins = [
    { name: 'Ernani', email: 'ernani@gmail.com', password: '123' },
    { name: 'Geovani', email: 'geovani@gmail.com', password: '123' },
  ]

  for (const admin of admins) {
    await prisma.admin.upsert({
      where: { email: admin.email },
      update: {},
      create: admin,
    })
    console.log(`Admin ${admin.name} created/updated.`)
  }

  // Create Drivers
  const drivers = [
    { name: 'Lamartine', password: '123' },
    { name: 'Ju Braga', password: '123' },
    { name: 'Douglas', password: '123' },
    { name: 'Richard', password: '123' },
  ]

  for (const driver of drivers) {
    await prisma.driver.upsert({
      where: { name: driver.name },
      update: { password: driver.password },
      create: driver,
    })
    console.log(`Driver ${driver.name} created/updated.`)
  }

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
