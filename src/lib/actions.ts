"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { Delivery, DeliveryStatus, DeliveryStatsReport } from "./types";

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
      totalAmount: (data.totalAmount && !isNaN(data.totalAmount)) ? data.totalAmount : 0,
      deliveryFee: (data.deliveryFee && !isNaN(data.deliveryFee)) ? data.deliveryFee : 0,
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

export async function processDriverOrderInput(orderNumber: string, driverId: string, driverName: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const trimmedNumber = orderNumber.trim();

  // Tenta encontrar um pedido existente vindo do GPlus (ou outro) que ainda não tem motorista
  const existing = await prisma.delivery.findFirst({
    where: {
      orderNumber: { equals: trimmedNumber, mode: 'insensitive' },
      scannedAt: { gte: today },
      status: "PENDENTE"
    }
  });

  if (existing) {
    // Atribui ao motorista atual
    const updated = await prisma.delivery.update({
      where: { id: existing.id },
      data: {
        driverId: driverId,
        deliveryPerson: driverName,
        status: "EM ROTA"
      }
    });
    
    revalidatePath("/");
    revalidatePath("/restaurant");
    revalidatePath("/driver");
    return { success: true, action: "ASSIGNED", delivery: updated };
  }

  // Se não existir, retornamos um erro para o motoboy verificar no servidor local
  return { success: false, error: "Pedido não encontrado no servidor. Verifique o número ou aguarde a sincronização." };
}

export async function updateDeliveryStatus(id: string, status: DeliveryStatus, driverId?: string) {
  const delivery = await prisma.delivery.findUnique({ where: { id } });
  if (!delivery) return;

  const oldStatus = delivery.status;
  
  await prisma.$transaction(async (tx) => {
    let driverName = undefined;
    if (driverId) {
      const dr = await tx.driver.findUnique({ where: { id: driverId } });
      if (dr) {
        driverName = dr.name;
      }
    }

    await tx.delivery.update({
      where: { id },
      data: {
        status,
        driverId: driverId || undefined,
        deliveryPerson: driverName || undefined,
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

export async function bulkCompleteDeliveries(deliveryIds: string[], driverId: string) {
  await prisma.$transaction(async (tx) => {
    const deliveries = await tx.delivery.findMany({
      where: { id: { in: deliveryIds } }
    });

    const notDeliveredYet = deliveries.filter(d => d.status !== "ENTREGUE");
    const totalFees = notDeliveredYet.reduce((sum, d) => sum + (d.deliveryFee || 0), 0);

    await tx.delivery.updateMany({
      where: { id: { in: deliveryIds } },
      data: {
        status: "ENTREGUE",
        deliveredAt: new Date()
      }
    });

    if (totalFees > 0) {
      await tx.driver.update({
        where: { id: driverId },
        data: { totalFeesEarned: { increment: totalFees } }
      });
    }
  });

  revalidatePath("/restaurant");
  revalidatePath("/driver");
  return { success: true };
}

export async function reassignDelivery(deliveryId: string, newDriverId: string) {
  if (newDriverId === "unassigned" || !newDriverId) {
    await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        driverId: null,
        deliveryPerson: null,
        status: "PENDENTE"
      }
    });
    revalidatePath("/restaurant");
    revalidatePath("/driver");
    return;
  }

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

export async function bulkAssignDeliveries(deliveryIds: string[], newDriverId: string) {
  const driver = await prisma.driver.findUnique({ where: { id: newDriverId } });
  if (!driver) return { success: false, error: "Motorista não encontrado." };

  await prisma.delivery.updateMany({
    where: {
      id: { in: deliveryIds }
    },
    data: {
      driverId: driver.id,
      deliveryPerson: driver.name,
      status: "EM ROTA"
    }
  });

  revalidatePath("/restaurant");
  revalidatePath("/driver");
  return { success: true };
}

export async function deleteDelivery(id: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { id },
  });

  if (delivery) {
    await prisma.deletedDelivery.create({
      data: {
        orderNumber: delivery.orderNumber,
        customerName: delivery.customerName,
        address: delivery.address,
        totalAmount: delivery.totalAmount,
        deliveryFee: delivery.deliveryFee,
        status: delivery.status,
        deliveryPerson: delivery.deliveryPerson,
        paymentMethod: delivery.paymentMethod,
        observations: delivery.observations,
        itemsCount: delivery.itemsCount,
        scannedAt: delivery.scannedAt,
      },
    });

    await prisma.delivery.delete({ where: { id } });
  }

  revalidatePath("/restaurant");
  revalidatePath("/driver");
}

function parseDateRange(dateStr?: string) {
  if (!dateStr) return undefined;
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const [year, month, day] = parts;
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);
    return { gte: start, lte: end };
  }
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  return { gte: start, lte: end };
}

export async function getDeletedDeliveries(dateStr?: string) {
  let where: any = {};
  const range = parseDateRange(dateStr);
  if (range) {
    where.deletedAt = range;
  }

  return prisma.deletedDelivery.findMany({
    where,
    orderBy: { deletedAt: 'desc' },
  });
}

export async function restoreDelivery(id: string) {
  const deleted = await prisma.deletedDelivery.findUnique({
    where: { id },
  });

  if (deleted) {
    let matchedCustomer = null;
    if (deleted.customerName) {
      matchedCustomer = await prisma.customer.findFirst({
        where: {
          name: { equals: deleted.customerName, mode: 'insensitive' }
        }
      });
    }

    if (deleted.status === "FIADO" && matchedCustomer) {
      await prisma.creditSale.create({
        data: {
          customerId: matchedCustomer.id,
          date: deleted.scannedAt || new Date(),
          totalAmount: deleted.totalAmount || 0,
          notes: deleted.observations || `Comanda fiado restaurada (${deleted.orderNumber})`,
          status: "PENDENTE",
          items: {
            create: [
              {
                description: `Consumo Restaurado (${deleted.orderNumber})`,
                quantity: 1,
                unitPrice: deleted.totalAmount || 0,
                totalPrice: deleted.totalAmount || 0,
              }
            ]
          }
        }
      });
    } else {
      await prisma.delivery.create({
        data: {
          orderNumber: deleted.orderNumber,
          customerName: deleted.customerName || "Consumidor",
          address: deleted.address || "Não informado",
          totalAmount: deleted.totalAmount || 0,
          deliveryFee: deleted.deliveryFee || 0,
          status: deleted.status && deleted.status !== "FIADO" ? deleted.status : "PENDENTE",
          deliveryPerson: deleted.deliveryPerson,
          paymentMethod: deleted.paymentMethod,
          observations: deleted.observations,
          itemsCount: deleted.itemsCount || 1,
          scannedAt: deleted.scannedAt || new Date(),
        },
      });
    }

    await prisma.deletedDelivery.delete({ where: { id } });
  }

  revalidatePath("/restaurant");
  revalidatePath("/driver");
}

export async function permanentDeleteDelivery(id: string) {
  await prisma.deletedDelivery.delete({ where: { id } });
  revalidatePath("/restaurant");
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

export async function getDeliveries(dateStr?: string) {
  let where: any = {};
  const range = parseDateRange(dateStr);
  if (range) {
    where.scannedAt = range;
  }

  return prisma.delivery.findMany({
    where,
    orderBy: { scannedAt: 'asc' },
    include: { driver: true }
  });
}

export async function getSummary(dateStr?: string) {
  let where: any = {};
  const range = parseDateRange(dateStr);
  if (range) {
    where.scannedAt = range;
  }

  const [counts, sums] = await Promise.all([
    prisma.delivery.groupBy({
      by: ['status'],
      where,
      _count: { _all: true }
    }),
    prisma.delivery.aggregate({
      where,
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

export async function logoutDriver() {
  const cookieStore = await cookies();
  cookieStore.delete("driver_id");
  cookieStore.delete("driver_name");
}

export async function toggleDriverActive(id: string, active: boolean) {
  const driver = await prisma.driver.update({
    where: { id },
    data: { isActive: active }
  });
  revalidatePath("/restaurant");
  revalidatePath("/driver");
  return driver;
}

export async function getDeliveryStatsReport(params: {
  period: "day" | "month";
  dateStr?: string; // YYYY-MM-DD for day, YYYY-MM for month
}): Promise<DeliveryStatsReport> {
  const period = params.period || "day";
  const now = new Date();

  let start: Date;
  let end: Date;
  let titleStr = "";

  if (period === "day") {
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();

    if (params.dateStr) {
      const parts = params.dateStr.split("-").map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        year = parts[0];
        month = parts[1] - 1;
        day = parts[2];
      }
    }
    start = new Date(year, month, day, 0, 0, 0, 0);
    end = new Date(year, month, day, 23, 59, 59, 999);
    titleStr = `Relatório Diário - ${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
  } else {
    let year = now.getFullYear();
    let month = now.getMonth();

    if (params.dateStr) {
      const parts = params.dateStr.split("-").map(Number);
      if (parts.length >= 2 && !parts.some(isNaN)) {
        year = parts[0];
        month = parts[1] - 1;
      }
    }
    start = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    end = new Date(year, month, lastDayOfMonth, 23, 59, 59, 999);
    
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    titleStr = `Relatório Mensal - ${monthNames[month]} de ${year}`;
  }

  const [deliveries, drivers] = await Promise.all([
    prisma.delivery.findMany({
      where: {
        scannedAt: { gte: start, lte: end }
      },
      include: { driver: true }
    }),
    prisma.driver.findMany({ orderBy: { name: 'asc' } })
  ]);

  const totalOrders = deliveries.length;
  let deliveredOrders = 0;
  let onRouteOrders = 0;
  let pendingOrders = 0;
  let canceledOrders = 0;
  let totalAmount = 0;
  let totalFees = 0;
  let totalItems = 0;

  const paymentMap: Record<string, { count: number; totalAmount: number }> = {};
  const driverMap: Record<string, {
    driverId: string;
    driverName: string;
    isActive: boolean;
    totalDeliveries: number;
    deliveredCount: number;
    totalAmount: number;
    totalFees: number;
    itemsCount: number;
  }> = {};

  // Inicializa mapa de motoristas com todos cadastrados
  for (const dr of drivers) {
    driverMap[dr.id] = {
      driverId: dr.id,
      driverName: dr.name,
      isActive: dr.isActive,
      totalDeliveries: 0,
      deliveredCount: 0,
      totalAmount: 0,
      totalFees: 0,
      itemsCount: 0
    };
  }

  const timelineMap: Record<string, { count: number; deliveredCount: number; totalAmount: number }> = {};

  deliveries.forEach((d) => {
    const amt = d.totalAmount || 0;
    const fee = d.deliveryFee || 0;
    const items = d.itemsCount || 1;

    if (d.status === "ENTREGUE") {
      deliveredOrders++;
      totalAmount += amt;
      totalFees += fee;
      totalItems += items;
    } else if (d.status === "EM ROTA") {
      onRouteOrders++;
      totalAmount += amt;
      totalFees += fee;
    } else if (d.status === "PENDENTE") {
      pendingOrders++;
    } else if (d.status === "CANCELADO") {
      canceledOrders++;
    }

    // Métricas por Motoboy
    let targetDriverId = d.driverId;
    if (!targetDriverId && d.deliveryPerson) {
      const matched = drivers.find(dr => dr.name.toLowerCase() === d.deliveryPerson?.toLowerCase());
      if (matched) targetDriverId = matched.id;
    }

    if (targetDriverId && driverMap[targetDriverId]) {
      const drObj = driverMap[targetDriverId];
      drObj.totalDeliveries++;
      if (d.status === "ENTREGUE") {
        drObj.deliveredCount++;
        drObj.totalAmount += amt;
        drObj.totalFees += fee;
        drObj.itemsCount += items;
      }
    } else if (d.deliveryPerson) {
      // Caso motoboy não esteja no banco
      const key = `unknown_${d.deliveryPerson}`;
      if (!driverMap[key]) {
        driverMap[key] = {
          driverId: key,
          driverName: d.deliveryPerson,
          isActive: false,
          totalDeliveries: 0,
          deliveredCount: 0,
          totalAmount: 0,
          totalFees: 0,
          itemsCount: 0
        };
      }
      driverMap[key].totalDeliveries++;
      if (d.status === "ENTREGUE") {
        driverMap[key].deliveredCount++;
        driverMap[key].totalAmount += amt;
        driverMap[key].totalFees += fee;
        driverMap[key].itemsCount += items;
      }
    }

    // Formas de Pagamento
    const pMethod = d.paymentMethod?.trim() || "Não informado";
    if (!paymentMap[pMethod]) {
      paymentMap[pMethod] = { count: 0, totalAmount: 0 };
    }
    paymentMap[pMethod].count++;
    if (d.status === "ENTREGUE") {
      paymentMap[pMethod].totalAmount += amt;
    }

    // Timeline (Hora no Dia ou Dia no Mês)
    const scanDate = new Date(d.scannedAt);
    let labelKey = "";
    if (period === "day") {
      const hour = scanDate.getHours();
      labelKey = `${String(hour).padStart(2, '0')}:00`;
    } else {
      const dayNum = scanDate.getDate();
      const monthNum = scanDate.getMonth() + 1;
      labelKey = `${String(dayNum).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}`;
    }

    if (!timelineMap[labelKey]) {
      timelineMap[labelKey] = { count: 0, deliveredCount: 0, totalAmount: 0 };
    }
    timelineMap[labelKey].count++;
    if (d.status === "ENTREGUE") {
      timelineMap[labelKey].deliveredCount++;
      timelineMap[labelKey].totalAmount += amt;
    }
  });

  const validDeliveredForCalc = deliveredOrders > 0 ? deliveredOrders : 1;
  const driverStats = Object.values(driverMap)
    .filter(dr => dr.totalDeliveries > 0 || dr.isActive)
    .map(dr => ({
      ...dr,
      sharePercentage: parseFloat(((dr.deliveredCount / validDeliveredForCalc) * 100).toFixed(1))
    }))
    .sort((a, b) => b.deliveredCount - a.deliveredCount);

  const paymentStats = Object.entries(paymentMap).map(([method, data]) => ({
    method,
    count: data.count,
    totalAmount: data.totalAmount
  })).sort((a, b) => b.count - a.count);

  const timelineStats = Object.entries(timelineMap).map(([label, data]) => ({
    label,
    count: data.count,
    deliveredCount: data.deliveredCount,
    totalAmount: data.totalAmount
  })).sort((a, b) => a.label.localeCompare(b.label));

  const avgTicket = deliveredOrders > 0 ? totalAmount / deliveredOrders : 0;
  const completionRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;

  const dateStrFormatted = period === "day" 
    ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
    : `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;

  return {
    period,
    dateStr: dateStrFormatted,
    title: titleStr,
    totalOrders,
    deliveredOrders,
    onRouteOrders,
    pendingOrders,
    canceledOrders,
    totalAmount,
    totalFees,
    avgTicket,
    totalItems,
    completionRate,
    drivers: driverStats,
    paymentMethods: paymentStats,
    timeline: timelineStats
  };
}

export async function getHistoricalDeliveryStats(selectedYearInput?: number) {
  try {
    const currentYear = new Date().getFullYear();
    const deliveries = await prisma.delivery.findMany({
      select: { scannedAt: true, totalAmount: true, status: true, deliveryFee: true, itemsCount: true }
    });

    const yearsSet = new Set<number>();
    yearsSet.add(currentYear);
    deliveries.forEach(d => {
      if (d.scannedAt) yearsSet.add(new Date(d.scannedAt).getFullYear());
    });

    const availableYears = Array.from(yearsSet).sort((a, b) => a - b);
    const targetYear = selectedYearInput || (availableYears.includes(currentYear) ? currentYear : availableYears[availableYears.length - 1]);

    const monthNamesShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const monthNamesFull = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const yearMonths = monthNamesShort.map((shortName, idx) => ({
      monthIndex: idx,
      shortName,
      fullName: monthNamesFull[idx],
      year: targetYear,
      periodKey: `${targetYear}-${String(idx + 1).padStart(2, '0')}`,
      salesTotal: 0,
      deliveredCount: 0,
      totalOrders: 0,
      totalFees: 0,
      itemsCount: 0
    }));

    const timelineMap: Record<string, {
      periodKey: string;
      label: string;
      year: number;
      monthIndex: number;
      salesTotal: number;
      deliveredCount: number;
      totalOrders: number;
      totalFees: number;
      itemsCount: number;
    }> = {};

    deliveries.forEach(d => {
      const dateObj = new Date(d.scannedAt);
      const yr = dateObj.getFullYear();
      const mo = dateObj.getMonth();
      const amt = d.totalAmount || 0;
      const fee = d.deliveryFee || 0;
      const items = d.itemsCount || 1;
      const isDelivered = d.status === "ENTREGUE";

      if (yr === targetYear && yearMonths[mo]) {
        yearMonths[mo].totalOrders++;
        if (isDelivered) {
          yearMonths[mo].deliveredCount++;
          yearMonths[mo].salesTotal += amt;
          yearMonths[mo].totalFees += fee;
          yearMonths[mo].itemsCount += items;
        }
      }

      const key = `${yr}-${String(mo + 1).padStart(2, '0')}`;
      if (!timelineMap[key]) {
        timelineMap[key] = {
          periodKey: key,
          label: `${monthNamesShort[mo]}/${String(yr).slice(-2)}`,
          year: yr,
          monthIndex: mo,
          salesTotal: 0,
          deliveredCount: 0,
          totalOrders: 0,
          totalFees: 0,
          itemsCount: 0
        };
      }
      timelineMap[key].totalOrders++;
      if (isDelivered) {
        timelineMap[key].deliveredCount++;
        timelineMap[key].salesTotal += amt;
        timelineMap[key].totalFees += fee;
        timelineMap[key].itemsCount += items;
      }
    });

    const historicalTimeline = Object.values(timelineMap).sort((a, b) => a.periodKey.localeCompare(b.periodKey));

    const yearSalesTotal = yearMonths.reduce((acc, m) => acc + m.salesTotal, 0);
    const yearDeliveredCount = yearMonths.reduce((acc, m) => acc + m.deliveredCount, 0);
    const yearTotalOrders = yearMonths.reduce((acc, m) => acc + m.totalOrders, 0);
    const yearTotalFees = yearMonths.reduce((acc, m) => acc + m.totalFees, 0);
    const avgMonthlySales = yearSalesTotal / 12;

    let bestMonth = yearMonths[0];
    yearMonths.forEach(m => {
      if (m.salesTotal > bestMonth.salesTotal) {
        bestMonth = m;
      }
    });

    return {
      availableYears,
      targetYear,
      months: yearMonths,
      historicalTimeline,
      summary: {
        yearSalesTotal,
        yearDeliveredCount,
        yearTotalOrders,
        yearTotalFees,
        avgMonthlySales,
        bestMonth: bestMonth.salesTotal > 0 ? bestMonth.fullName : "Nenhum"
      }
    };
  } catch (error) {
    console.error("Error in getHistoricalDeliveryStats:", error);
    return {
      availableYears: [new Date().getFullYear()],
      targetYear: new Date().getFullYear(),
      months: [],
      historicalTimeline: [],
      summary: {
        yearSalesTotal: 0,
        yearDeliveredCount: 0,
        yearTotalOrders: 0,
        yearTotalFees: 0,
        avgMonthlySales: 0,
        bestMonth: "-"
      }
    };
  }
}


