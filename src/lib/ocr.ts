import Tesseract from 'tesseract.js';

export async function processReceipt(imageBufferOrUrl: string | File) {
  try {
    const { data: { text } } = await Tesseract.recognize(
      imageBufferOrUrl,
      'por',
      { logger: m => console.log(m) }
    );

    console.log("OCR Result RAW:", text);

    // Regex processing - More robust and explicit for requested fields
    const orderMatch = text.match(/Delivery\s*#\s*(\d+)/i) || text.match(/DELIVERY\s*#\s*(\d+)/i) || text.match(/#\s*(\d+)/);
    const orderNumber = orderMatch ? orderMatch[1] : `ORD-${Date.now().toString().slice(-4)}`;

    const addressMatch = text.match(/End:\s*(.*)/i);
    const address = addressMatch ? addressMatch[1].trim() : "Não detectado";

    const customerMatch = text.match(/Cliente:\s*(.*)/i);
    const customer = customerMatch ? customerMatch[1].trim() : "Não detectado";

    const feeMatch = text.match(/Taxa entrega\s*R?\$?\s*([\d\.\,]+)/i) || text.match(/Taxa\s+entrega.*?([\d\.\,]+)/i);
    let deliveryFee = 0;
    if (feeMatch) {
      deliveryFee = parseFloat(feeMatch[1].replace(',', '.'));
    }

    const totalMatch = text.match(/Total a pagar\s*R?\$?\s*([\d\.\,]+)/i) || text.match(/Total.*?([\d\.\,]+)/i);
    let totalAmount = 0;
    if (totalMatch) {
      totalAmount = parseFloat(totalMatch[1].replace(',', '.'));
    }

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
