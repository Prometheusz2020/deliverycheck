"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "./db";

export async function loginGPlusUser(usuario: string, senha: string) {
  try {
    if (!usuario || !senha) {
      return { success: false, error: "Usuário e senha são obrigatórios." };
    }

    const cleanUsuario = usuario.trim();
    let tenant = await prisma.loginGPlus.findUnique({
      where: { usuario: cleanUsuario }
    });

    // If no user exists in DB yet, create initial account for the first login attempt
    const count = await prisma.loginGPlus.count();
    if (count === 0 && !tenant) {
      tenant = await prisma.loginGPlus.create({
        data: {
          usuario: cleanUsuario,
          senha: senha,
          nome: cleanUsuario,
          isActive: true
        }
      });
    }

    if (!tenant) {
      return { success: false, error: "Usuário não encontrado. Se for seu primeiro acesso, selecione 'Cadastrar nova empresa'." };
    }

    if (tenant.senha !== senha || !tenant.isActive) {
      return { success: false, error: "Senha incorreta ou conta inativa." };
    }

    const cookieStore = await cookies();
    cookieStore.set("gplus_tenant_id", tenant.id, { path: "/", maxAge: 60 * 60 * 24 * 7 });
    cookieStore.set("gplus_tenant_user", tenant.usuario, { path: "/", maxAge: 60 * 60 * 24 * 7 });
    if (tenant.nome) {
      cookieStore.set("gplus_tenant_name", tenant.nome, { path: "/", maxAge: 60 * 60 * 24 * 7 });
    }

    return { success: true, tenant: { id: tenant.id, usuario: tenant.usuario, nome: tenant.nome } };
  } catch (error) {
    console.error("Login GPlus error:", error);
    return { success: false, error: "Erro interno ao realizar login." };
  }
}

export async function createGPlusTenantAccount(usuario: string, senha: string, nome?: string) {
  try {
    if (!usuario || !senha) {
      return { success: false, error: "Usuário e senha são obrigatórios." };
    }

    const cleanUsuario = usuario.trim();
    const existing = await prisma.loginGPlus.findUnique({
      where: { usuario: cleanUsuario }
    });

    if (existing) {
      return { success: false, error: "Este nome de usuário já está em uso." };
    }

    const tenant = await prisma.loginGPlus.create({
      data: {
        usuario: cleanUsuario,
        senha: senha,
        nome: nome?.trim() || cleanUsuario,
        isActive: true
      }
    });

    const cookieStore = await cookies();
    cookieStore.set("gplus_tenant_id", tenant.id, { path: "/", maxAge: 60 * 60 * 24 * 7 });
    cookieStore.set("gplus_tenant_user", tenant.usuario, { path: "/", maxAge: 60 * 60 * 24 * 7 });
    if (tenant.nome) {
      cookieStore.set("gplus_tenant_name", tenant.nome, { path: "/", maxAge: 60 * 60 * 24 * 7 });
    }

    return { success: true, tenant: { id: tenant.id, usuario: tenant.usuario, nome: tenant.nome } };
  } catch (error) {
    console.error("Create GPlus account error:", error);
    return { success: false, error: "Erro ao criar conta de login." };
  }
}

export async function getGPlusSession() {
  try {
    const cookieStore = await cookies();
    const id = cookieStore.get("gplus_tenant_id")?.value;
    const user = cookieStore.get("gplus_tenant_user")?.value;
    const name = cookieStore.get("gplus_tenant_name")?.value;

    if (!id || !user) return null;
    return { id, usuario: user, nome: name || user };
  } catch (error) {
    return null;
  }
}

export async function logoutGPlusUser() {
  const cookieStore = await cookies();
  cookieStore.delete("gplus_tenant_id");
  cookieStore.delete("gplus_tenant_user");
  cookieStore.delete("gplus_tenant_name");
  revalidatePath("/produtos-gplus");
}

export interface GPlusProductInput {
  id?: string;
  loginGPlusId?: string | null;
  nome: string;
  grupo?: string | null;
  valor: number;
  codigoDeBarras?: string | null;
}

export async function getGPlusProducts(search?: string, loginGPlusId?: string) {
  try {
    const whereConditions: any = {};

    if (loginGPlusId) {
      whereConditions.loginGPlusId = loginGPlusId;
    }

    if (search && search.trim() !== "") {
      whereConditions.OR = [
        { nome: { contains: search, mode: "insensitive" } },
        { grupo: { contains: search, mode: "insensitive" } },
        { codigoDeBarras: { contains: search, mode: "insensitive" } },
      ];
    }

    const products = await prisma.produtoGPlus.findMany({
      where: Object.keys(whereConditions).length > 0 ? whereConditions : undefined,
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

    if (data.codigoDeBarras && data.codigoDeBarras.trim() !== "") {
      const existingWithCode = await prisma.produtoGPlus.findFirst({
        where: {
          codigoDeBarras: data.codigoDeBarras.trim(),
          ...(data.id ? { id: { not: data.id } } : {}),
        },
      });

      if (existingWithCode) {
        return {
          success: false,
          error: `O código de barras "${data.codigoDeBarras.trim()}" já está cadastrado no produto "${existingWithCode.nome}".`,
        };
      }
    }

    const payload = {
      loginGPlusId: data.loginGPlusId || null,
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
  products: Array<{ nome: string; grupo?: string | null; valor: number; codigoDeBarras?: string | null; loginGPlusId?: string | null }>,
  clearExisting: boolean,
  loginGPlusId?: string
) {
  try {
    if (!Array.isArray(products) || products.length === 0) {
      return { success: false, error: "Nenhum produto válido fornecido para importação." };
    }

    // Process and validate inputs
    const validatedProducts = products
      .filter((p) => p && p.nome && p.nome.trim() !== "")
      .map((p) => ({
        loginGPlusId: p.loginGPlusId || loginGPlusId || null,
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
        await tx.produtoGPlus.deleteMany(loginGPlusId ? { where: { loginGPlusId } } : undefined);
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
      return { success: false, error: "GEMINI_API_KEY não configurada no servidor." };
    }

    const matchMime = base64Image.match(/^data:(image\/\w+);base64,/);
    const mimeType = matchMime ? matchMime[1] : "image/jpeg";
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const promptText = "You are a precise barcode scanner. Look closely at this image. Extract the numeric barcode (EAN-13, EAN-8, Code-128, UPC, QR Code) or the numbers printed directly under the barcode vertical lines. Return ONLY the numeric digits of the code with no spaces or text. If no barcode digits are found, return NONE.";

    const buildPayload = () => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: cleanBase64
                }
              }
            ]
          }
        ]
      })
    });

    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      buildPayload()
    );

    if (!response.ok) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        buildPayload()
      );
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API Error Response:", errText);
      return { success: false, error: `Falha na API Gemini (${response.status})` };
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    const digitMatch = rawText.match(/\d{8,14}/) || rawText.match(/\d{4,14}/) || rawText.match(/\d+/);
    const cleanDigits = digitMatch ? digitMatch[0] : "";

    if (cleanDigits && cleanDigits.toUpperCase() !== "NONE") {
      return { success: true, barcode: cleanDigits };
    }

    return { success: false, error: "Código de barras não identificado na foto." };
  } catch (error: any) {
    console.error("Error in extractBarcodeWithAI:", error);
    return { success: false, error: error.message || "Erro no serviço de IA." };
  }
}
