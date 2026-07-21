import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Helper function to validate sync token
function isAuthorized(req: Request) {
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("syncToken");
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const token = queryToken || bearerToken;
  
  return token === process.env.SYNC_TOKEN;
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const products = await prisma.produtoGPlus.findMany({
      orderBy: { nome: "asc" },
    });

    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error("API GET products error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body.syncToken || req.headers.get("Authorization")?.replace("Bearer ", "");
    
    if (token !== process.env.SYNC_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { products, clearExisting } = body;

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({ error: "Invalid products array" }, { status: 400 });
    }

    // Process inputs
    const validatedProducts = products
      .filter((p: any) => p && p.nome && String(p.nome).trim() !== "")
      .map((p: any) => ({
        nome: String(p.nome).trim(),
        grupo: p.grupo ? String(p.grupo).trim() : null,
        valor: Math.max(0, Number(p.valor || 0)),
        codigoDeBarras: p.codigoDeBarras || p.codigo_de_barras ? String(p.codigoDeBarras || p.codigo_de_barras).trim() : null,
      }));

    if (validatedProducts.length === 0) {
      return NextResponse.json({ error: "No valid products to import" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (clearExisting) {
        await tx.produtoGPlus.deleteMany({});
      }

      const created = await tx.produtoGPlus.createMany({
        data: validatedProducts,
      });

      return created;
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("API POST products error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
