import type { CreateOrderPayload } from "@/data/orders";
import { paymentLabels } from "@/lib/checkout/form";

export class OrderValidationError extends Error {}

function textField(value: unknown, label: string, max: number) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max) throw new OrderValidationError(`${label}: informe até ${max} caracteres.`);
  return value.trim();
}

export function cashAmount(value: string): number | null {
  const normalized = value.trim().replace(/^R\$\s*/i, "");
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized.replace(",", ".")) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function validateCheckout(value: Record<string, unknown>, subtotal: number) {
  const customerName = textField(value.customerName, "Nome", 120);
  const customerPhone = textField(value.customerPhone, "Telefone", 30);
  if (customerName.length < 2) throw new OrderValidationError("Informe seu nome com pelo menos 2 caracteres.");
  const digits = customerPhone.replace(/\D/g, "");
  if (!/^[\d\s()+-]+$/.test(customerPhone) || !/^(?:55)?\d{10,11}$/.test(digits)) throw new OrderValidationError("Informe um telefone válido com DDD.");
  const deliveryMethod = value.deliveryMethod;
  const paymentMethod = value.paymentMethod;
  if (deliveryMethod !== "delivery" && deliveryMethod !== "pickup") throw new OrderValidationError("Escolha entrega ou retirada.");
  if (paymentMethod !== "pix" && paymentMethod !== "card" && paymentMethod !== "cash") throw new OrderValidationError("Escolha uma forma de pagamento válida.");
  let address = textField(value.address, "Endereço", 300);
  const neighborhood = textField(value.neighborhood, "Bairro", 120);
  const number = textField(value.addressNumber, "Número", 20);
  const complement = textField(value.addressComplement, "Complemento", 120);
  const reference = textField(value.addressReference, "Referência", 180);
  if (deliveryMethod === "delivery") {
    if (address.length < 3) throw new OrderValidationError("Informe o endereço de entrega.");
    if (!neighborhood) throw new OrderValidationError("Informe o bairro de entrega.");
    // Aceita também o contrato anterior: número informado junto do endereço.
    if (!number && !/\d|\bs\/?n\b/i.test(address)) throw new OrderValidationError("Informe o número do endereço ou S/N.");
    address = [address, number && `nº ${number}`, complement, reference && `Referência: ${reference}`].filter(Boolean).join(", ");
  }
  let changeFor = textField(value.changeFor, "Troco", 30);
  if (paymentMethod === "cash" && changeFor) {
    const amount = cashAmount(changeFor);
    if (amount === null || amount < subtotal) throw new OrderValidationError("O valor para troco deve ser igual ou maior que o total do pedido.");
    changeFor = (amount / 100).toFixed(2).replace(".", ",");
  } else changeFor = "";
  return {
    customerName, customerPhone, deliveryMethod, paymentMethod, paymentLabel: paymentLabels[paymentMethod],
    address: deliveryMethod === "delivery" ? address : "", neighborhood: deliveryMethod === "delivery" ? neighborhood : "",
    changeFor, notes: textField(value.notes, "Observações", 1000),
  } satisfies Omit<CreateOrderPayload, "items" | "subtotal" | "deliveryFee" | "total">;
}
