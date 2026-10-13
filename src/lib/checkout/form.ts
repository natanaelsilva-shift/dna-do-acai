import type { DeliveryMethod, PaymentMethod } from "@/data/orders";

export type CheckoutForm = {
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  address: string;
  neighborhood: string;
  paymentMethod: PaymentMethod;
  changeFor: string;
  notes: string;
};

export type SubmitState = "idle" | "submitting" | "success" | "error";

export const paymentLabels: Record<PaymentMethod, string> = {
  pix: "Pix",
  card: "Cartão na entrega",
  cash: "Dinheiro",
};

export const initialCheckoutForm: CheckoutForm = {
  customerName: "",
  customerPhone: "",
  deliveryMethod: "delivery",
  address: "",
  neighborhood: "",
  paymentMethod: "pix",
  changeFor: "",
  notes: "",
};

