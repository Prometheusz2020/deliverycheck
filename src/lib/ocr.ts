import Tesseract from 'tesseract.js';

export async function processReceipt(imageBufferOrUrl: string | File) {
  try {
    const { data: { text } } = await Tesseract.recognize(
      imageBufferOrUrl,
      'por',
      { logger: m => console.log(m) }
    );

    console.log("OCR Result RAW:", text);

    // Regex processing - Focus on everything after "Delivery" and look near "Skina Beer"
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let orderNumber = `ID-${Date.now().toString().slice(-4)}`;

    // 1. Try traditional "Delivery" keyword anywhere
    const deliveryLineMatch = text.match(/Delivery\s*(.*)/i);
    if (deliveryLineMatch) {
      orderNumber = deliveryLineMatch[1].trim();
    } 
    // 2. Try looking specifically after "Skina Beer" (for cases where # is misread)
    else {
      const skinaIndex = lines.findIndex(l => l.toUpperCase().includes("SKINA BEER") || l.toUpperCase().includes("SKINA"));
      if (skinaIndex !== -1 && skinaIndex < lines.length - 1) {
        orderNumber = lines[skinaIndex + 1]; // Pegar a linha seguinte
      }
    }

    const addressMatch = text.match(/End:\s*(.*)/i);
    const address = addressMatch ? addressMatch[1].trim() : "Não detectado";

    const customerMatch = text.match(/Cliente:\s*(.*)/i);
    const customer = customerMatch ? customerMatch[1].trim() : "Não detectado";

    const feeMatch = text.match(/Taxa entrega\s*R?\$?\s*([\d\.\,]+)/i) || text.match(/Taxa\s+entrega.*?([\d\.\,]+)/i);
    let deliveryFee = 0;
    if (feeMatch) {
      deliveryFee = parseFloat(feeMatch[1].replace(',', '.'));
    }

    // Total a pagar removido temporariamente conforme solicitado
    const totalAmount = 0;

    const payMatch = text.match(/Forma de pagamento:\s*(.*)/i) || text.match(/Forma de pagamento\s*(.*)/i) || text.match(/Pagamento:\s*(.*)/i);
    const paymentMethod = payMatch ? payMatch[1].trim() : "Não detectado";

    return {
      orderNumber,
      address,
      customerName: customer,
      totalAmount,
      deliveryFee,
      paymentMethod
    };
  } catch (err) {
    console.error("OCR Error:", err);
    return null;
  }
}
