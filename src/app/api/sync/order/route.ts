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

    // Busca pedido de hoje com o mesmo número para evitar duplicidade ou atualizar dados
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.delivery.findFirst({
      where: {
        orderNumber: order.orderNumber,
        scannedAt: { gte: today }
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
            status: order.status || existing.status,
          }
        });
        return NextResponse.json({ success: true, message: "Pedido atualizado", delivery: updated });
      }
      return NextResponse.json({ success: true, message: "Pedido já finalizado/entregue" });
    }

    // Criar novo registro de entrega
    const delivery = await prisma.delivery.create({
      data: {
        orderNumber: order.orderNumber,
        customerName: order.customerName || "Consumidor",
        address: order.address || "Endereço não informado",
        totalAmount: order.totalAmount || 0,
        deliveryFee: 0,
        status: order.status || "PENDENTE",
        observations: "Importado do GPlus",
      },
    });

    return NextResponse.json({ success: true, created: true, delivery });
  } catch (err) {
    console.error("Sync API Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
