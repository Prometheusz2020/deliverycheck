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

    const { gplusId, customerName, gplusCustomerId, totalAmount, date, notes, orderNumber, items } = creditSale;

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
      include: { items: true }
    });

    if (existing) {
      // Se a venda existe, mas o payload enviado tem itens detalhados E a venda existente só tem o item genérico, atualiza os itens
      if (items && items.length > 0) {
        const hasOnlyGeneric = existing.items.length === 1 && existing.items[0].description.startsWith('Consumo Comanda #');
        if (hasOnlyGeneric) {
          await prisma.$transaction(async (tx) => {
            // Remove o item genérico antigo
            await tx.creditSaleItem.deleteMany({
              where: { saleId: existing.id }
            });
            // Cria os novos itens detalhados
            const itemsData = items.map((item: any) => ({
              saleId: existing.id,
              description: String(item.description || 'Consumo').trim(),
              quantity: Number(item.quantity) || 1,
              unitPrice: Number(item.unitPrice) || 0,
              totalPrice: Number(item.totalPrice) || 0,
            }));
            await tx.creditSaleItem.createMany({
              data: itemsData,
            });
          });
          console.log(`[Sync API] Comanda #${orderNumber} atualizada com os itens detalhados consumidos`);
          return NextResponse.json({ success: true, message: `Comanda #${orderNumber} atualizada com itens detalhados`, sale: existing });
        }
      }
      return NextResponse.json({ success: true, message: `Comanda #${orderNumber} já integrada anteriormente`, sale: existing });
    }

    // Limpa caracteres '#F' ou '#f' (e espaços extras) do nome do cliente enviado pelo GPlus
    const cleanedName = customerName.replace(/#F/gi, "").replace(/\s+/g, " ").trim();
    let customer = null;

    // 1. Tenta buscar pelo gplusId
    if (gplusCustomerId) {
      customer = await prisma.customer.findUnique({
        where: { gplusId: Number(gplusCustomerId) },
      });
    }

    // 2. Fallback: tenta buscar pelo nome limpo (case-insensitive)
    if (!customer) {
      customer = await prisma.customer.findFirst({
        where: {
          name: {
            equals: cleanedName,
            mode: "insensitive", // busca case-insensitive para evitar duplicidade por acentos/caixa alta
          },
        },
      });
    }

    // 3. Se ainda não existir, cria o cliente com o ID do GPlus
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: cleanedName,
          gplusId: gplusCustomerId ? Number(gplusCustomerId) : null,
        },
      });
      console.log(`[Sync API] Novo cliente cadastrado automaticamente: ${cleanedName} (GPlus ID: ${gplusCustomerId})`);
    } else if (gplusCustomerId && !customer.gplusId) {
      // Se o cliente existia mas não tinha o gplusId preenchido, atualiza
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { gplusId: Number(gplusCustomerId) },
      });
      console.log(`[Sync API] Cliente '${cleanedName}' atualizado com GPlus ID: ${gplusCustomerId}`);
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

      // Se houver itens detalhados na comanda, cria-os; caso contrário, cria o item genérico de consumo
      if (items && items.length > 0) {
        const itemsData = items.map((item: any) => ({
          saleId: newSale.id,
          description: String(item.description || 'Consumo').trim(),
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          totalPrice: Number(item.totalPrice) || 0,
        }));
        await tx.creditSaleItem.createMany({
          data: itemsData,
        });
      } else {
        await tx.creditSaleItem.create({
          data: {
            saleId: newSale.id,
            description: `Consumo Comanda #${orderNumber}`,
            quantity: 1,
            unitPrice: totalAmount,
            totalPrice: totalAmount,
          },
        });
      }

      return newSale;
    });

    return NextResponse.json({ success: true, created: true, sale: createdSale });
  } catch (err) {
    console.error("Sync Credit Sale API Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
