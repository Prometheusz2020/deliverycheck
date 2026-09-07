import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { syncToken, order } = await req.json();

    // Verificação de segurança
    if (syncToken !== process.env.SYNC_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!order || !order.orderNumber) {
      return NextResponse.json({ error: "Missing order data" }, { status: 400 });
    }

    const rawOrderNum = String(order.orderNumber).trim();
    const cleanOrderNum = rawOrderNum.replace(/^#/, "").trim();

    // Ignora comandas que foram excluídas manualmente no site
    const deletedDeliveries = await prisma.deletedDelivery.findMany({
      select: { orderNumber: true }
    });

    const isDeletedOnWeb = deletedDeliveries.some(d => {
      const dRaw = d.orderNumber.trim();
      const dClean = dRaw.replace(/^#/, "").trim();
      return dRaw === rawOrderNum || (cleanOrderNum.length > 0 && dClean === cleanOrderNum);
    });

    if (isDeletedOnWeb) {
      return NextResponse.json({ success: true, message: "Ignorado pois foi excluído no site pelo usuário" });
    }

    // Ignora comandas que estão sem valor (<= 0), pois são lançamentos incompletos/com erro
    if (order.totalAmount !== undefined && order.totalAmount !== null && order.totalAmount <= 0) {
      return NextResponse.json({ success: true, message: "Ignorado por estar sem valor" });
    }

    // Função auxiliar para verificar se o endereço é de entrega válido (não balcão, mesa, etc.)
    const hasValidAddress = (addr?: string) => {
      if (!addr) return false;
      const clean = addr.trim().toLowerCase();
      const invalidKeywords = [
        "", "0", "s/e", "se", "s/n", "sn", "n/a", "na", "null", "undefined", "*", ".", "---",
        "nao informado", "não informado", "nao informada", "não informada",
        "balcao", "balcão", "mesa", "retirada", "consumo local", "estabelecimento"
      ];
      if (invalidKeywords.includes(clean)) return false;
      if (clean === "s/e, -" || clean.startsWith("s/e,") || clean.replace(/[^a-z0-9]/g, "") === "se") return false;
      return true;
    };

    if (!hasValidAddress(order.address) && order.status !== "CANCELADO") {
      return NextResponse.json({ success: true, message: "Ignorado por ser consumo local/balcão (sem endereço)" });
    }

    // Processamento de datas (seja de hoje ou histórico)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let orderDate = new Date();
    let isHistorical = false;

    if (order.date) {
      if (typeof order.date === "string") {
        const datePart = order.date.split("T")[0];
        const [year, month, day] = datePart.split("-").map(Number);
        orderDate = new Date(year, month - 1, day, 12, 0, 0, 0);
      } else {
        orderDate = new Date(order.date);
      }
      
      const orderDateMidnight = new Date(orderDate);
      orderDateMidnight.setHours(0, 0, 0, 0);
      if (orderDateMidnight < today) {
        isHistorical = true;
      }
    }

    const orderDayStart = new Date(orderDate);
    orderDayStart.setHours(0, 0, 0, 0);
    const orderDayEnd = new Date(orderDate);
    orderDayEnd.setHours(23, 59, 59, 999);

    // Busca pedido dessa mesma data com o mesmo número para evitar duplicidade
    const existing = await prisma.delivery.findFirst({
      where: {
        orderNumber: order.orderNumber,
        scannedAt: { gte: orderDayStart, lte: orderDayEnd }
      },
    });

    if (existing) {
      // Se já existe e não está finalizado (ENTREGUE), ou está sendo cancelado, atualizamos os dados
      if (existing.status !== "ENTREGUE" || order.status === "CANCELADO") {
        const updated = await prisma.delivery.update({
          where: { id: existing.id },
          data: {
            customerName: order.customerName,
            address: order.address,
            totalAmount: order.totalAmount,
            paymentMethod: order.paymentMethod || existing.paymentMethod,
            status: order.status === "CANCELADO" ? "CANCELADO" : (isHistorical ? "ENTREGUE" : existing.status),
            itemsCount: order.itemsCount !== undefined ? Number(order.itemsCount) : existing.itemsCount,
          }
        });
        return NextResponse.json({ success: true, message: "Pedido atualizado", delivery: updated });
      }
      return NextResponse.json({ success: true, message: "Pedido já finalizado/entregue" });
    }

    // Criar novo registro de entrega (de hoje ou histórico)
    const delivery = await prisma.delivery.create({
      data: {
        orderNumber: order.orderNumber,
        customerName: order.customerName || "Consumidor",
        address: order.address || "Endereço não informado",
        totalAmount: order.totalAmount || 0,
        paymentMethod: order.paymentMethod || null,
        deliveryFee: 0,
        status: order.status === "CANCELADO" ? "CANCELADO" : (isHistorical ? "ENTREGUE" : (order.status || "PENDENTE")),
        observations: isHistorical ? "Histórico Importado do GPlus" : "Importado do GPlus",
        itemsCount: order.itemsCount !== undefined ? Number(order.itemsCount) : 1,
        scannedAt: orderDate,
        deliveredAt: isHistorical ? orderDate : undefined,
      },
    });

    return NextResponse.json({ success: true, created: true, delivery });
  } catch (err) {
    console.error("Sync API Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
