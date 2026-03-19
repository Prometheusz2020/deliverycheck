import Tesseract from 'tesseract.js';

export async function processReceipt(imageBufferOrUrl: string | File) {
  try {
    const { data: { text } } = await Tesseract.recognize(
      imageBufferOrUrl,
      'por',
      { logger: m => console.log(m) }
    );

    console.log("OCR Result RAW:", text);

    // Regex processing
    const orderMatch = text.match(/DELIVERY\s*#(\d+)/i) || text.match(/#\s*(\d+)/);
    const orderNumber = orderMatch ? orderMatch[1] : `ORD-${Date.now().toString().slice(-4)}`;

    const addressMatch = text.match(/End:\s*(.*)/i);
    const address = addressMatch ? addressMatch[1].trim() : "Não detectado";

    const customerMatch = text.match(/Cliente:\s*(.*)/i);
    const customer = customerMatch ? customerMatch[1].trim() : "Não detectado";

    const totalMatch = text.match(/Total a pagar\s*([\d\.\,]+)/i) || text.match(/Total\s*([\d\.\,]+)/i);
    let totalAmount = 0;
    if (totalMatch) {
      totalAmount = parseFloat(totalMatch[1].replace(',', '.'));
    }

    // Extraction for delivery fee (taxa de entrega)
    // Often listed as "ENTREGA" or "TAXA"
    const feeMatch = text.match(/(?:ENTREGA|TAXA).*?([\d\.\,]+)\s*$/im) || text.match(/[\d\.\,]+\s+(?:ENTREGA|TAXA)/i);
    let deliveryFee = 0;
    if (feeMatch) {
      deliveryFee = parseFloat(feeMatch[1].replace(',', '.'));
    }

    const payMatch = text.match(/Formas de Pagamento\s*(.*)/i);
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
