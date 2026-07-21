"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";

export interface GPlusProductInput {
  id?: string;
  nome: string;
  grupo?: string | null;
  valor: number;
  codigoDeBarras?: string | null;
}

export async function getGPlusProducts(search?: string) {
  try {
    const products = await prisma.produtoGPlus.findMany({
      where: search
        ? {
            OR: [
              { nome: { contains: search, mode: "insensitive" } },
              { grupo: { contains: search, mode: "insensitive" } },
              { codigoDeBarras: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { nome: "asc" },
    });
    return { success: true, products };
  } catch (error) {
    console.error("Error getting GPlus products:", error);
    return { success: false, error: "Erro ao buscar produtos.", products: [] };
  }
}

export async function createOrUpdateProduct(data: GPlusProductInput) {
  try {
    if (!data.nome || data.nome.trim() === "") {
      return { success: false, error: "O nome do produto é obrigatório." };
    }
    if (data.valor < 0) {
      return { success: false, error: "O valor do produto não pode ser negativo." };
    }

    const payload = {
      nome: data.nome.trim(),
      grupo: data.grupo?.trim() || null,
      valor: Number(data.valor),
      codigoDeBarras: data.codigoDeBarras?.trim() || null,
    };

    let product;
    if (data.id) {
      product = await prisma.produtoGPlus.update({
        where: { id: data.id },
        data: payload,
      });
    } else {
      product = await prisma.produtoGPlus.create({
        data: payload,
      });
    }

    revalidatePath("/produtos-gplus");
    return { success: true, product };
  } catch (error) {
    console.error("Error saving product:", error);
    return { success: false, error: "Erro ao salvar o produto." };
  }
}

export async function deleteProduct(id: string) {
  try {
    await prisma.produtoGPlus.delete({
      where: { id },
    });
    revalidatePath("/produtos-gplus");
    return { success: true };
  } catch (error) {
    console.error("Error deleting product:", error);
    return { success: false, error: "Erro ao excluir o produto." };
  }
}

export async function importGPlusProducts(
  products: Array<{ nome: string; grupo?: string | null; valor: number; codigoDeBarras?: string | null }>,
  clearExisting: boolean
) {
  try {
    if (!Array.isArray(products) || products.length === 0) {
      return { success: false, error: "Nenhum produto válido fornecido para importação." };
    }

    // Process and validate inputs
    const validatedProducts = products
      .filter((p) => p && p.nome && p.nome.trim() !== "")
      .map((p) => ({
        nome: p.nome.trim(),
        grupo: p.grupo?.trim() || null,
        valor: Math.max(0, Number(p.valor || 0)),
        codigoDeBarras: p.codigoDeBarras ? String(p.codigoDeBarras).trim() : null,
      }));

    if (validatedProducts.length === 0) {
      return { success: false, error: "Nenhum produto com nome válido foi encontrado após a validação." };
    }

    const result = await prisma.$transaction(async (tx) => {
      if (clearExisting) {
        await tx.produtoGPlus.deleteMany({});
      }

      const createdCount = await tx.produtoGPlus.createMany({
        data: validatedProducts,
      });

      return createdCount;
    });

    revalidatePath("/produtos-gplus");
    return { success: true, count: result.count };
  } catch (error) {
    console.error("Error importing products:", error);
    return { success: false, error: "Erro ao realizar a importação em lote." };
  }
}
