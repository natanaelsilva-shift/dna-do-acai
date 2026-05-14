export const ORDER_DELIVERY_FEE = 600;

export const WHATSAPP_BUSINESS_PHONE_NUMBER = "5562991102715";

export const ORDER_STATUSES = [
  "Novo",
  "Em preparo",
  "Saiu para entrega",
  "Finalizado",
  "Cancelado",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type DeliveryMethod = "delivery" | "pickup";

export type PaymentMethod = "pix" | "card" | "cash";

export type OrderCustomizationLine = {
  groupTitle: string;
  options: string;
  optionsList?: string[];
  price: number;
};

export type OrderItem = {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customization?: OrderCustomizationLine[];
};

export type CreateOrderPayload = {
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  address: string;
  neighborhood: string;
  paymentMethod: PaymentMethod;
  paymentLabel: string;
  changeFor: string;
  notes: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
};

export type OrderRecord = {
  id: string;
  order_number: number;
  created_at: string;
  updated_at: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_method: DeliveryMethod;
  address: string | null;
  neighborhood: string | null;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: PaymentMethod;
  payment_label: string;
  change_for: string | null;
  notes: string | null;
  status: OrderStatus;
  whatsapp_business_phone: string;
  whatsapp_payload: Record<string, unknown> | null;
};

export function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}
