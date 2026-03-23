"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { Delivery, DeliveryStatus } from "./types";
import { cookies } from "next/headers";

export async function addDriver(name: string, password?: string) {
  const driver = await prisma.driver.create({
    data: {
      name,
      password: password || "1234",
      totalFeesEarned: 0
    }
  });
  revalidatePath("/restaurant");
  return driver;
}

export async function getDrivers() {
  return prisma.driver.findMany({
    orderBy: { name: 'asc' }
  });
}

export async function addDelivery(data: Partial<Delivery>) {
  const delivery = await prisma.delivery.create({
    data: {
      orderNumber: data.orderNumber || "SN",
      customerName: data.customerName || "Consumidor",
      address: data.address || "Não informado",
      totalAmount: data.totalAmount || 0,
      deliveryFee: data.deliveryFee || 0,
      status: data.status || "PENDENTE",
      driverId: data.driverId,
      deliveryPerson: data.deliveryPerson,
      paymentMethod: data.paymentMethod || "Não informado",
      observations: data.observations || ""
    }
  });
  
  revalidatePath("/");
  revalidatePath("/restaurant");
  revalidatePath("/driver");
  return delivery;
}

export async function updateDeliveryStatus(id: string, status: DeliveryStatus, driverId?: string) {
  const delivery = await prisma.delivery.findUnique({ where: { id } });
  if (!delivery) return;

  const oldStatus = delivery.status;
  
  await prisma.$transaction(async (tx) => {
    await tx.delivery.update({
      where: { id },
      data: {
        status,
        deliveredAt: status === "ENTREGUE" ? new Date() : undefined
      }
    });

    if (status === "ENTREGUE" && oldStatus !== "ENTREGUE") {
      const targetDriverId = driverId || delivery.driverId;
      if (targetDriverId) {
        await tx.driver.update({
          where: { id: targetDriverId },
          data: { totalFeesEarned: { increment: delivery.deliveryFee } }
        });
      }
    }
  });

  revalidatePath("/restaurant");
  revalidatePath("/driver");
}

export async function reassignDelivery(deliveryId: string, newDriverId: string) {
  const driver = await prisma.driver.findUnique({ where: { id: newDriverId } });
  if (!driver) return;

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      driverId: driver.id,
      deliveryPerson: driver.name,
      status: "EM ROTA"
    }
  });
  
  revalidatePath("/restaurant");
  revalidatePath("/driver");
}

export async function clearDeliveries() {
  await prisma.delivery.deleteMany();
  await prisma.driver.updateMany({
    data: { totalFeesEarned: 0 }
  });
  revalidatePath("/restaurant");
  revalidatePath("/driver");
}

export async function updateObservations(id: string, text: string) {
  await prisma.delivery.update({
    where: { id },
    data: { observations: text }
  });
  revalidatePath("/restaurant");
}

export async function getDeliveries() {
  return prisma.delivery.findMany({
    orderBy: { scannedAt: 'desc' },
    include: { driver: true }
  });
}

export async function getSummary() {
  const [counts, sums] = await Promise.all([
    prisma.delivery.groupBy({
      by: ['status'],
      _count: { _all: true }
    }),
    prisma.delivery.aggregate({
      _sum: { totalAmount: true, deliveryFee: true }
    })
  ]);

  const stats = {
    pending: counts.find((c) => c.status === "PENDENTE")?._count._all || 0,
    onRoute: counts.find((c) => c.status === "EM ROTA")?._count._all || 0,
    delivered: counts.find((c) => c.status === "ENTREGUE")?._count._all || 0,
    totalValue: sums._sum.totalAmount || 0,
    totalFees: sums._sum.deliveryFee || 0
  };

  return stats;
}

export async function loginDriver(name: string, password?: string) {
  const driver = await prisma.driver.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      password: password
    }
  });

  if (driver) {
    const cookieStore = await cookies();
    cookieStore.set("driver_id", driver.id, { path: "/", maxAge: 60 * 60 * 24 });
    cookieStore.set("driver_name", driver.name, { path: "/", maxAge: 60 * 60 * 24 });
    return { success: true, driverId: driver.id };
  }
  return { success: false };
}

export async function getSessionDriver() {
  const cookieStore = await cookies();
  const id = cookieStore.get("driver_id")?.value;
  const name = cookieStore.get("driver_name")?.value;
  return id ? { id, name: name || "" } : null;
}

// ADMIN ACTIONS
export async function loginAdmin(emailOrPass: string, password?: string) {
  // Check master password (for legacy single input)
  if (!password) {
    if (emailOrPass === process.env.ADMIN_PASSWORD || emailOrPass === "admin_pratali") {
      const cookieStore = await cookies();
      cookieStore.set("admin_session", "true", { path: "/", maxAge: 60 * 60 * 8 });
      return { success: true };
    }
    return { success: false };
  }

  // Check individual admin login
  const admin = await prisma.admin.findUnique({
    where: { email: emailOrPass }
  });

  if (admin && admin.password === password) {
    const cookieStore = await cookies();
    cookieStore.set("admin_session", "true", { path: "/", maxAge: 60 * 60 * 8 });
    cookieStore.set("admin_name", admin.name, { path: "/", maxAge: 60 * 60 * 8 });
    return { success: true };
  }
  
  return { success: false };
}

export async function getSessionAdmin() {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value === "true";
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_session");
  revalidatePath("/restaurant");
}
