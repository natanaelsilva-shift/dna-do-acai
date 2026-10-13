"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { CreateOrderPayload } from "@/data/orders";
import { useCart } from "@/components/cart/CartProvider";
import { useStore } from "@/components/store/StoreProvider";
import {
  initialCheckoutForm,
  paymentLabels,
  type CheckoutForm,
  type SubmitState,
} from "@/lib/checkout/form";

type CheckoutContextValue = {
  checkout: CheckoutForm;
  canCheckout: boolean;
  orderTotal: number;
  submitState: SubmitState;
  submitMessage: string;
  updateCheckoutField: <Key extends keyof CheckoutForm>(
    field: Key,
    value: CheckoutForm[Key],
  ) => void;
  submitOrder: () => Promise<void>;
};

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

// O payload enviado a /api/orders é o contrato com o banco, o painel admin e a
// comanda impressa. Não alterar o formato sem revisar esses consumidores.
export function CheckoutProvider({ children }: { children: ReactNode }) {
  const { isStoreOpen } = useStore();
  const { cartItems, totalItems, totalPrice, clearCart } = useCart();
  const [checkout, setCheckout] = useState<CheckoutForm>(initialCheckoutForm);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const orderTotal = totalPrice;
  const canCheckout =
    totalItems > 0 &&
    checkout.customerName.trim().length > 0 &&
    checkout.customerPhone.trim().length > 0 &&
    (checkout.deliveryMethod === "pickup" || checkout.address.trim().length > 0);

  function buildOrderPayload(): CreateOrderPayload {
    return {
      customerName: checkout.customerName,
      customerPhone: checkout.customerPhone,
      deliveryMethod: checkout.deliveryMethod,
      address: checkout.address,
      neighborhood: checkout.neighborhood,
      paymentMethod: checkout.paymentMethod,
      paymentLabel: paymentLabels[checkout.paymentMethod],
      changeFor: checkout.changeFor,
      notes: checkout.notes,
      items: cartItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.quantity,
        customization: item.customization ?? [],
      })),
      subtotal: totalPrice,
      deliveryFee: null,
      total: orderTotal,
    };
  }

  async function submitOrder() {
    if (!isStoreOpen) {
      setSubmitState("error");
      setSubmitMessage("No momento estamos fechados. Volte em breve 💜");
      return;
    }

    if (!canCheckout || submitState === "submitting") {
      return;
    }

    setSubmitState("submitting");
    setSubmitMessage("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildOrderPayload()),
      });
      const responseBody = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(responseBody.error ?? "Não foi possível enviar o pedido.");
      }

      clearCart();
      setCheckout(initialCheckoutForm);
      setSubmitState("success");
      setSubmitMessage(
        "Pedido enviado com sucesso! Em breve entraremos em contato pelo WhatsApp.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      setSubmitState("error");
      setSubmitMessage(
        message.includes("Banco de dados não configurado")
          ? "Não foi possível enviar o pedido porque o banco de dados ainda não foi configurado."
          : message || "Não foi possível enviar o pedido. Tente novamente.",
      );
    }
  }

  function updateCheckoutField<Key extends keyof CheckoutForm>(
    field: Key,
    value: CheckoutForm[Key],
  ) {
    setCheckout((currentCheckout) => ({
      ...currentCheckout,
      [field]: value,
    }));
  }

  const value: CheckoutContextValue = {
    checkout,
    canCheckout,
    orderTotal,
    submitState,
    submitMessage,
    updateCheckoutField,
    submitOrder,
  };

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout() {
  const context = useContext(CheckoutContext);

  if (!context) {
    throw new Error("useCheckout precisa estar dentro de <CheckoutProvider>.");
  }

  return context;
}
