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

    const saleDate = dateStr ? new Date(dateStr) : new Date();

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
    await prisma.creditSale.delete({
      where: { id: saleId },
    });
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

    const paymentDate = dateStr ? new Date(dateStr) : new Date();

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
