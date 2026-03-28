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
      // Se já existe e ainda está pendente, atualizamos os dados (caso tenha mudado algo no GPlus)
      if (existing.status === "PENDENTE") {
        const updated = await prisma.delivery.update({
          where: { id: existing.id },
          data: {
            customerName: order.customerName,
            address: order.address,
            totalAmount: order.totalAmount,
          }
        });
        return NextResponse.json({ success: true, message: "Pedido atualizado", delivery: updated });
      }
      return NextResponse.json({ success: true, message: "Pedido já está em rota ou entregue" });
    }

    // Criar novo registro de entrega
    const delivery = await prisma.delivery.create({
      data: {
        orderNumber: order.orderNumber,
        customerName: order.customerName || "Consumidor",
        address: order.address || "Endereço não informado",
        totalAmount: order.totalAmount || 0,
        deliveryFee: 0,
        status: "PENDENTE",
        observations: "Importado do GPlus",
      },
    });

    return NextResponse.json({ success: true, created: true, delivery });
  } catch (err) {
    console.error("Sync API Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
