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

export async function extractBarcodeWithAI(base64Image: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "GEMINI_API_KEY não configurada." };
    }

    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "You are a precise barcode scanner. Extract the numeric barcode (EAN-13, EAN-8, Code-128, UPC) or QR code from this image. Look closely at the numbers printed directly under the barcode lines if present. Return ONLY the digits or code string with no extra text or spaces. If no barcode digits are visible, return NONE."
                },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: cleanBase64
                  }
                }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      // Fallback to gemini-2.0-flash if 1.5-flash returns error
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: "You are a precise barcode scanner. Extract the numeric barcode (EAN-13, EAN-8, Code-128, UPC) or QR code from this image. Look closely at the numbers printed directly under the barcode lines if present. Return ONLY the digits or code string with no extra text or spaces. If no barcode digits are visible, return NONE."
                  },
                  {
                    inlineData: {
                      mimeType: "image/jpeg",
                      data: cleanBase64
                    }
                  }
                ]
              }
            ]
          })
        }
      );
    }

    if (!response.ok) {
      return { success: false, error: "Falha na requisição da API Gemini." };
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Extract barcode digits (prefer 8 to 14 digit sequence typical of EAN-13, EAN-8, UPC, or any digit group)
    const digitMatch = rawText.match(/\d{8,14}/) || rawText.match(/\d{4,14}/) || rawText.match(/\d+/);
    const cleanDigits = digitMatch ? digitMatch[0] : "";

    if (cleanDigits && cleanDigits.toUpperCase() !== "NONE") {
      return { success: true, barcode: cleanDigits };
    }

    return { success: false, error: "Código de barras não identificado pela IA na foto." };
  } catch (error) {
    console.error("Error in extractBarcodeWithAI:", error);
    return { success: false, error: "Erro no serviço de IA." };
  }
}
