import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { syncToken, creditSale } = await req.json();

    // Verificação de segurança
    if (syncToken !== process.env.SYNC_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!creditSale || !creditSale.gplusId || !creditSale.customerName) {
      return NextResponse.json({ error: "Missing credit sale data" }, { status: 400 });
    }

    const { gplusId, customerName, totalAmount, date, notes, orderNumber } = creditSale;

    // Se o pedido foi cancelado no GPlus, removemos do fiado se já existir na nuvem
    if (creditSale.status === "CANCELADO") {
      const existing = await prisma.creditSale.findUnique({
        where: { gplusId },
      });

      if (existing) {
        await prisma.creditSale.delete({
          where: { id: existing.id },
        });
        return NextResponse.json({ success: true, message: `Venda cancelada comanda #${orderNumber} removida do fiado` });
      }

      return NextResponse.json({ success: true, message: `Venda cancelada comanda #${orderNumber} ignorada pois não constava no fiado` });
    }

    // Verifica se a venda a prazo já foi importada anteriormente
    const existing = await prisma.creditSale.findUnique({
      where: { gplusId },
    });

    if (existing) {
      return NextResponse.json({ success: true, message: `Comanda #${orderNumber} já integrada anteriormente`, sale: existing });
    }

    // Busca ou cria o cliente com o nome informado no GPlus
    const trimmedName = customerName.trim();
    let customer = await prisma.customer.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: "insensitive", // busca case-insensitive para evitar duplicidade por acentos/caixa alta
        },
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: trimmedName,
        },
      });
      console.log(`[Sync API] Novo cliente cadastrado automaticamente: ${trimmedName}`);
    }

    // Cria a venda a prazo em transação
    const saleDate = date ? new Date(date) : new Date();
    const createdSale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.creditSale.create({
        data: {
          customerId: customer!.id,
          date: saleDate,
          totalAmount: totalAmount,
          notes: notes || `Sincronizado do GPlus (Comanda #${orderNumber})`,
          status: "PENDENTE",
          gplusId: gplusId,
        },
      });

      // Cria um item genérico correspondente ao valor total da comanda
      await tx.creditSaleItem.create({
        data: {
          saleId: newSale.id,
          description: `Consumo Comanda #${orderNumber}`,
          quantity: 1,
          unitPrice: totalAmount,
          totalPrice: totalAmount,
        },
      });

      return newSale;
    });

    return NextResponse.json({ success: true, created: true, sale: createdSale });
  } catch (err) {
    console.error("Sync Credit Sale API Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
