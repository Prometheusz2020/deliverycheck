export type DeliveryStatus = "PENDENTE" | "EM ROTA" | "ENTREGUE" | "CANCELADO";

export interface Driver {
  id: string;
  name: string;
  password?: string; // Simple text password for local use
  totalFeesEarned: number;
  isActive?: boolean;
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
  scannedAt: Date | string;
  deliveredAt?: Date | string;
  paymentMethod?: string;
  observations?: string;
  itemsCount?: number;
}

export type DeliverySummary = {
  pending: number;
  onRoute: number;
  delivered: number;
  totalValue: number;
  totalFees: number;
};

export interface DriverStatItem {
  driverId: string;
  driverName: string;
  isActive: boolean;
  totalDeliveries: number;
  deliveredCount: number;
  totalAmount: number;
  totalFees: number;
  itemsCount: number;
  sharePercentage: number;
}

export interface PaymentStatItem {
  method: string;
  count: number;
  totalAmount: number;
}

export interface TimeSeriesStatItem {
  label: string;
  count: number;
  deliveredCount: number;
  totalAmount: number;
}

export interface DeliveryStatsReport {
  period: "day" | "month";
  dateStr: string;
  title: string;
  totalOrders: number;
  deliveredOrders: number;
  onRouteOrders: number;
  pendingOrders: number;
  canceledOrders: number;
  totalAmount: number;
  totalFees: number;
  avgTicket: number;
  totalItems: number;
  completionRate: number;
  drivers: DriverStatItem[];
  paymentMethods: PaymentStatItem[];
  timeline: TimeSeriesStatItem[];
}

