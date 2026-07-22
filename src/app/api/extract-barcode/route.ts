import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "GEMINI_API_KEY não configurada nas variáveis de ambiente da Vercel/Servidor."
      });
    }

    const body = await req.json();
    const { base64Image } = body;

    if (!base64Image) {
      return NextResponse.json({ success: false, error: "Nenhuma imagem foi fornecida." });
    }

    const matchMime = base64Image.match(/^data:(image\/\w+);base64,/);
    const mimeType = matchMime ? matchMime[1] : "image/jpeg";
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const promptText = "Analyze this image very carefully. Your job is to extract the barcode digits (EAN-13, EAN-8, UPC, Code 128, QR Code, or any numerical code printed under or near the barcode lines). Read the numbers written at the bottom or top of the barcode lines. Return ONLY the raw numeric digits with no spaces, letters, or explanation. If no barcode digits are visible, return NONE.";

    const buildPayload = () => ({
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
    });

    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-flash-latest"
    ];

    let response: Response | null = null;
    let usedModel = "";
    let lastError = "";

    for (const model of modelsToTry) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPayload())
          }
        );
        if (res.ok) {
          response = res;
          usedModel = model;
          break;
        } else {
          const errData = await res.text();
          console.warn(`[Gemini Try ${model} Failed]:`, res.status, errData);
          lastError = `Modelo ${model}: HTTP ${res.status}`;
        }
      } catch (err: any) {
        lastError = err.message || "Erro de conexão";
      }
    }

    if (!response || !response.ok) {
      console.error("❌ [Gemini API Final Error]:", lastError);
      return NextResponse.json({
        success: false,
        error: `Falha na API Gemini (${lastError || "Sem resposta do serviço"})`
      });
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!rawText || rawText.toUpperCase().includes("NONE")) {
      return NextResponse.json({
        success: false,
        error: "Código de barras não identificado na foto."
      });
    }

    const digitsOnly = rawText.replace(/[^0-9]/g, "");

    if (digitsOnly && digitsOnly.length >= 4) {
      console.log(`✅ [Gemini API Success]: ${digitsOnly} (Modelo: ${usedModel})`);
      return NextResponse.json({ success: true, barcode: digitsOnly });
    }

    return NextResponse.json({
      success: false,
      error: "Código de barras não identificado claramente na foto."
    });
  } catch (error: any) {
    console.error("Error in /api/extract-barcode:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno ao processar a imagem com IA." },
      { status: 500 }
    );
  }
}
