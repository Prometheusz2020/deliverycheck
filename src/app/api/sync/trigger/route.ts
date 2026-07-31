import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const syncToken = searchParams.get("syncToken");

    // Chamada do agente local com syncToken para verificar se há comandos pendentes
    if (syncToken && syncToken === process.env.SYNC_TOKEN) {
      const pending = await prisma.syncCommand.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json({ success: true, pendingCommand: pending || null });
    }

    // Chamada da UI para verificar o último status de sincronização
    const lastCommand = await prisma.syncCommand.findFirst({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, lastCommand: lastCommand || null });
  } catch (err) {
    console.error("Sync Trigger GET Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { syncToken, action, commandId, daysBack } = body;

    // 1. Atualização do Agente Local ao concluir ou falhar um comando
    if (syncToken && syncToken === process.env.SYNC_TOKEN) {
      if (action === "COMPLETE" && commandId) {
        const updated = await prisma.syncCommand.update({
          where: { id: commandId },
          data: { status: "COMPLETED" },
        });
        return NextResponse.json({ success: true, message: "Comando marcado como concluído", command: updated });
      }
      if (action === "START" && commandId) {
        const updated = await prisma.syncCommand.update({
          where: { id: commandId },
          data: { status: "PROCESSING" },
        });
        return NextResponse.json({ success: true, message: "Comando marcado como em processamento", command: updated });
      }
    }

    // 2. Solicitação enviada pelo Painel Web do Restaurante
    const days = daysBack ? Number(daysBack) : 7;
    const newCommand = await prisma.syncCommand.create({
      data: {
        status: "PENDING",
        daysBack: days,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Solicitação de sincronização (${days} dias) enviada com sucesso!`,
      command: newCommand,
    });
  } catch (err) {
    console.error("Sync Trigger POST Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
