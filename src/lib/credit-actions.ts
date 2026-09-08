"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";

// CUSTOMER ACTIONS

export async function addCustomer(
  name: string,
  phone?: string,
  address?: string,
  bestPaymentDay?: number,
  creditLimit?: number
) {
  try {
    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        bestPaymentDay: bestPaymentDay && bestPaymentDay > 0 ? bestPaymentDay : null,
        creditLimit: creditLimit || 0,
      },
    });
    revalidatePath("/restaurant");
    return { success: true, customer };
  } catch (error: any) {
    console.error("Error adding customer:", error);
    if (error.code === "P2002") {
      return { success: false, error: "Já existe um cliente cadastrado com este nome." };
    }
    return { success: false, error: "Erro ao cadastrar cliente. Tente novamente." };
  }
}

export async function editCustomer(
  id: string,
  name: string,
  phone?: string,
  address?: string,
  bestPaymentDay?: number,
  creditLimit?: number
) {
  try {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        bestPaymentDay: bestPaymentDay && bestPaymentDay > 0 ? bestPaymentDay : null,
        creditLimit: creditLimit || 0,
      },
    });
    revalidatePath("/restaurant");
    return { success: true, customer };
  } catch (error: any) {
    console.error("Error editing customer:", error);
    if (error.code === "P2002") {
      return { success: false, error: "Já existe outro cliente cadastrado com este nome." };
    }
    return { success: false, error: "Erro ao editar cliente." };
  }
}

export async function getCustomers() {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        sales: {
          select: {
            totalAmount: true,
          },
        },
        payments: {
          select: {
            amount: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Calcula os totais dinamicamente
    const mapped = customers.map((c) => {
      const totalSales = c.sales.reduce((sum, s) => sum + s.totalAmount, 0);
      const totalPayments = c.payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = totalSales - totalPayments;
      
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        bestPaymentDay: c.bestPaymentDay,
        creditLimit: c.creditLimit,
        totalSales,
        totalPayments,
        balance,
        createdAt: c.createdAt,
      };
    });

    return mapped;
  } catch (error) {
    console.error("Error listing customers:", error);
    return [];
  }
}

export async function deleteCustomer(id: string) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          include: {
            items: true,
          },
        },
      },
    });

    if (customer && customer.sales.length > 0) {
      for (const sale of customer.sales) {
        if (sale.gplusId) {
          await prisma.deletedGPlusSale.upsert({
            where: { gplusId: sale.gplusId },
            create: { gplusId: sale.gplusId },
            update: {},
          });
        }

        const match = sale.notes?.match(/Comanda\s*#?(\d+)/i);
        const comandaNum = match ? `#${match[1]}` : (sale.gplusId ? `#${sale.gplusId}` : `Fiado (${customer.name})`);

        let itemsSummary = "";
        if (sale.items && sale.items.length > 0) {
          itemsSummary = sale.items.map(i => `${i.quantity}x ${i.description}`).join(', ');
        }

        const obsText = sale.notes
          ? `${sale.notes} [Cliente ${customer.name} excluído]`
          : (itemsSummary ? `${itemsSummary} [Cliente ${customer.name} excluído]` : `Venda fiado do cliente ${customer.name} (excluído)`);

        await prisma.deletedDelivery.create({
          data: {
            orderNumber: comandaNum,
            customerName: customer.name,
            address: customer.address || "Venda a Prazo (Cliente Deletado)",
            totalAmount: sale.totalAmount,
            deliveryFee: 0,
            status: "FIADO",
            observations: obsText,
            scannedAt: sale.date,
          },
        });
      }
    }

    await prisma.customer.delete({
      where: { id },
    });
    revalidatePath("/restaurant");
    return { success: true };
  } catch (error) {
    console.error("Error deleting customer:", error);
    return { success: false, error: "Erro ao excluir cliente." };
  }
}

// CREDIT SALE ACTIONS

export async function addCreditSale(
  customerId: string,
  dateStr: string,
  items: { description: string; quantity: number; unitPrice: number }[],
  notes?: string
) {
  try {
    if (items.length === 0) {
      return { success: false, error: "A venda deve conter pelo menos um item." };
    }

    const saleDate = dateStr 
      ? (dateStr.includes("T") ? new Date(dateStr) : new Date(`${dateStr}T12:00:00`))
      : new Date();

    // Calcula o total
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const sale = await prisma.$transaction(async (tx) => {
      // 1. Cria o cabeçalho da venda
      const newSale = await tx.creditSale.create({
        data: {
          customerId,
          date: saleDate,
          totalAmount,
          notes: notes?.trim() || null,
          status: "PENDENTE",
        },
      });

      // 2. Cria os itens associados
      const itemsData = items.map((item) => ({
        saleId: newSale.id,
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
      }));

      await tx.creditSaleItem.createMany({
        data: itemsData,
      });

      return newSale;
    });

    revalidatePath("/restaurant");
    return { success: true, sale };
  } catch (error) {
    console.error("Error adding credit sale:", error);
    return { success: false, error: "Erro ao registrar venda a prazo." };
  }
}

export async function getCustomerDetails(customerId: string) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        sales: {
          orderBy: { date: "desc" },
          include: {
            items: true,
          },
        },
        payments: {
          orderBy: { date: "desc" },
        },
      },
    });

    if (!customer) return null;

    const totalSales = customer.sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPayments = customer.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = totalSales - totalPayments;

    return {
      ...customer,
      totalSales,
      totalPayments,
      balance,
    };
  } catch (error) {
    console.error("Error getting customer details:", error);
    return null;
  }
}

export async function deleteCreditSale(saleId: string) {
  try {
    const sale = await prisma.creditSale.findUnique({
      where: { id: saleId },
      include: { customer: true },
    });

    if (sale) {
      if (sale.gplusId) {
        await prisma.deletedGPlusSale.upsert({
          where: { gplusId: sale.gplusId },
          create: { gplusId: sale.gplusId },
          update: {},
        });
      }

      // Extrai o número da comanda das notas (ex: "Comanda #123") ou usa o gplusId
      const match = sale.notes?.match(/Comanda\s*#?(\d+)/i);
      const comandaNum = match ? `#${match[1]}` : (sale.gplusId ? `#${sale.gplusId}` : `Fiado ${sale.customer?.name || ''}`);

      await prisma.deletedDelivery.create({
        data: {
          orderNumber: comandaNum,
          customerName: sale.customer?.name || "Cliente Fiado",
          address: sale.customer?.address || "Venda a Prazo",
          totalAmount: sale.totalAmount,
          deliveryFee: 0,
          status: "FIADO",
          observations: sale.notes || `Venda a prazo excluída (${sale.customer?.name || 'Consumidor'})`,
          scannedAt: sale.date,
        },
      });

      await prisma.creditSale.delete({
        where: { id: saleId },
      });
    }

    revalidatePath("/restaurant");
    return { success: true };
  } catch (error) {
    console.error("Error deleting credit sale:", error);
    return { success: false, error: "Erro ao excluir venda." };
  }
}

// PAYMENT ACTIONS

export async function addPayment(
  customerId: string,
  dateStr: string,
  amount: number,
  paymentMethod: string,
  notes?: string
) {
  try {
    if (amount <= 0) {
      return { success: false, error: "O valor do pagamento deve ser maior que zero." };
    }

    const paymentDate = dateStr 
      ? (dateStr.includes("T") ? new Date(dateStr) : new Date(`${dateStr}T12:00:00`))
      : new Date();

    const payment = await prisma.payment.create({
      data: {
        customerId,
        date: paymentDate,
        amount,
        paymentMethod,
        notes: notes?.trim() || null,
      },
    });

    revalidatePath("/restaurant");
    return { success: true, payment };
  } catch (error) {
    console.error("Error adding payment:", error);
    return { success: false, error: "Erro ao registrar pagamento." };
  }
}

export async function deletePayment(paymentId: string) {
  try {
    await prisma.payment.delete({
      where: { id: paymentId },
    });
    revalidatePath("/restaurant");
    return { success: true };
  } catch (error) {
    console.error("Error deleting payment:", error);
    return { success: false, error: "Erro ao excluir pagamento." };
  }
}

export async function getRecentCreditSales(limit: number = 100) {
  try {
    const sales = await prisma.creditSale.findMany({
      take: limit,
      orderBy: { date: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return sales.map(s => {
      const match = s.notes?.match(/Comanda\s*#(\d+)/i);
      const comandaNum = match ? match[1] : (s.gplusId ? "GPlus" : "Manual");

      return {
        id: s.id,
        customerId: s.customerId,
        customerName: s.customer?.name || "Desconhecido",
        totalAmount: s.totalAmount,
        date: s.date.toISOString(),
        orderNumber: comandaNum,
        gplusId: s.gplusId
      };
    });
  } catch (error) {
    console.error("Error getting recent credit sales:", error);
    return [];
  }
}

export async function getHistoricalCreditStats(selectedYearInput?: number) {
  try {
    const currentYear = new Date().getFullYear();

    const [sales, payments] = await Promise.all([
      prisma.creditSale.findMany({
        select: { date: true, totalAmount: true }
      }),
      prisma.payment.findMany({
        select: { date: true, amount: true }
      })
    ]);

    // Anos disponíveis
    const yearsSet = new Set<number>();
    yearsSet.add(currentYear);

    sales.forEach(s => {
      if (s.date) yearsSet.add(new Date(s.date).getFullYear());
    });
    payments.forEach(p => {
      if (p.date) yearsSet.add(new Date(p.date).getFullYear());
    });

    const availableYears = Array.from(yearsSet).sort((a, b) => a - b);
    const targetYear = selectedYearInput || (availableYears.includes(currentYear) ? currentYear : availableYears[availableYears.length - 1]);

    // Mês a Mês do Ano Selecionado (12 meses fixed)
    const monthNamesShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const monthNamesFull = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const yearMonths = monthNamesShort.map((shortName, idx) => ({
      monthIndex: idx,
      shortName,
      fullName: monthNamesFull[idx],
      year: targetYear,
      periodKey: `${targetYear}-${String(idx + 1).padStart(2, '0')}`,
      salesTotal: 0,
      paymentsTotal: 0,
      netBalance: 0,
      salesCount: 0,
      paymentsCount: 0
    }));

    // Agrupamento temporal completo (Evolução Histórica Multi-Anos)
    const timelineMap: Record<string, {
      periodKey: string;
      label: string;
      year: number;
      monthIndex: number;
      salesTotal: number;
      paymentsTotal: number;
      netBalance: number;
      salesCount: number;
      paymentsCount: number;
    }> = {};

    sales.forEach(s => {
      const d = new Date(s.date);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const amt = s.totalAmount || 0;

      // Se for do ano alvo
      if (yr === targetYear && yearMonths[mo]) {
        yearMonths[mo].salesTotal += amt;
        yearMonths[mo].salesCount += 1;
      }

      // Timeline geral
      const key = `${yr}-${String(mo + 1).padStart(2, '0')}`;
      if (!timelineMap[key]) {
        timelineMap[key] = {
          periodKey: key,
          label: `${monthNamesShort[mo]}/${String(yr).slice(-2)}`,
          year: yr,
          monthIndex: mo,
          salesTotal: 0,
          paymentsTotal: 0,
          netBalance: 0,
          salesCount: 0,
          paymentsCount: 0
        };
      }
      timelineMap[key].salesTotal += amt;
      timelineMap[key].salesCount += 1;
    });

    payments.forEach(p => {
      const d = new Date(p.date);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const amt = p.amount || 0;

      // Se for do ano alvo
      if (yr === targetYear && yearMonths[mo]) {
        yearMonths[mo].paymentsTotal += amt;
        yearMonths[mo].paymentsCount += 1;
      }

      // Timeline geral
      const key = `${yr}-${String(mo + 1).padStart(2, '0')}`;
      if (!timelineMap[key]) {
        timelineMap[key] = {
          periodKey: key,
          label: `${monthNamesShort[mo]}/${String(yr).slice(-2)}`,
          year: yr,
          monthIndex: mo,
          salesTotal: 0,
          paymentsTotal: 0,
          netBalance: 0,
          salesCount: 0,
          paymentsCount: 0
        };
      }
      timelineMap[key].paymentsTotal += amt;
      timelineMap[key].paymentsCount += 1;
    });

    // Calcular saldos líquidos
    yearMonths.forEach(m => {
      m.netBalance = m.salesTotal - m.paymentsTotal;
    });

    const historicalTimeline = Object.values(timelineMap)
      .map(item => ({
        ...item,
        netBalance: item.salesTotal - item.paymentsTotal
      }))
      .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

    // Métricas do Ano Selecionado
    const yearSalesTotal = yearMonths.reduce((acc, m) => acc + m.salesTotal, 0);
    const yearPaymentsTotal = yearMonths.reduce((acc, m) => acc + m.paymentsTotal, 0);
    const yearNetBalance = yearSalesTotal - yearPaymentsTotal;
    const avgMonthlySales = yearSalesTotal / 12;

    let bestSalesMonth = yearMonths[0];
    yearMonths.forEach(m => {
      if (m.salesTotal > bestSalesMonth.salesTotal) {
        bestSalesMonth = m;
      }
    });

    return {
      availableYears,
      targetYear,
      months: yearMonths,
      historicalTimeline,
      summary: {
        yearSalesTotal,
        yearPaymentsTotal,
        yearNetBalance,
        avgMonthlySales,
        bestSalesMonth: bestSalesMonth.salesTotal > 0 ? bestSalesMonth.fullName : "Nenhum"
      }
    };
  } catch (error) {
    console.error("Error in getHistoricalCreditStats:", error);
    return {
      availableYears: [new Date().getFullYear()],
      targetYear: new Date().getFullYear(),
      months: [],
      historicalTimeline: [],
      summary: {
        yearSalesTotal: 0,
        yearPaymentsTotal: 0,
        yearNetBalance: 0,
        avgMonthlySales: 0,
        bestSalesMonth: "-"
      }
    };
  }
}

