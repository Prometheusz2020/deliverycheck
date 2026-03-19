export type DeliveryStatus = "PENDENTE" | "EM ROTA" | "ENTREGUE" | "CANCELADO";

export interface Driver {
  id: string;
  name: string;
  password?: string; // Simple text password for local use
  totalFeesEarned: number;
}

export interface Delivery {
  id: string;
  orderNumber: string;
  customerName?: string;
  address?: string;
  totalAmount?: number;
  deliveryFee?: number;
  status: DeliveryStatus;
  driverId?: string;
  deliveryPerson?: string; // Current name of driver
  scannedAt: string;
  deliveredAt?: string;
  paymentMethod?: string;
  observations?: string;
}

export type DeliverySummary = {
  pending: number;
  onRoute: number;
  delivered: number;
  totalValue: number;
  totalFees: number;
};
