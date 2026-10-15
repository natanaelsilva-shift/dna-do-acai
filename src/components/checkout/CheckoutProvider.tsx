"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import type { CreateOrderPayload, OrderItem } from "@/data/orders";
import { usePromotionClock } from "@/components/store/PromotionProvider";
import { useCart } from "@/components/cart/CartProvider";
import { useStore } from "@/components/store/StoreProvider";
import {
  initialCheckoutForm,
  type CheckoutForm,
  type SubmitState,
} from "@/lib/checkout/form";
import { validateCheckout } from "@/lib/checkout/validation";
import { refreshCatalog } from "@/hooks/useCatalog";

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
  const { isStoreOpen, storeUnavailableMessage } = useStore();
  const { cartItems, totalItems, totalPrice, clearCart, priceNotice, acknowledgePrices, applyQuote } = useCart();
  const { synchronize } = usePromotionClock();
  const [checkout, setCheckout] = useState<CheckoutForm>(initialCheckoutForm);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const inFlight = useRef(false);
  const attempt = useRef<{ body: string; id: string } | null>(null);

  const orderTotal = totalPrice;
  const canCheckout =
    totalItems > 0 &&
    checkout.customerName.trim().length > 0 &&
    checkout.customerPhone.trim().length > 0 &&
    (checkout.deliveryMethod === "pickup" || checkout.address.trim().length > 0);

  function buildOrderPayload(): CreateOrderPayload {
    return {
      ...validateCheckout(checkout, totalPrice),
      items: cartItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.quantity,
        customization: item.customization ?? [],
        selections: item.selections,
        comboSelections: item.comboSelections,
      })),
      subtotal: totalPrice,
      deliveryFee: null,
      total: orderTotal,
    };
  }

  async function submitOrder() {
    if (!isStoreOpen) {
      setSubmitState("error");
      setSubmitMessage(storeUnavailableMessage);
      return;
    }

    if (inFlight.current) {
      return;
    }

    if (priceNotice) {
      setSubmitState("error");
      setSubmitMessage(`${priceNotice} Confira o total e confirme novamente.`);
      acknowledgePrices();
      return;
    }

    inFlight.current = true;
    setSubmitState("submitting");
    setSubmitMessage("");

    try {
      const payload = buildOrderPayload();
      const body = JSON.stringify(payload);
      if (attempt.current?.body !== body) attempt.current = { body, id: crypto.randomUUID() };
      payload.requestId = attempt.current.id;
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responseBody = (await response.json()) as {
        error?: string; code?: string;
        quote?: { items: OrderItem[]; serverTime: number };
      };

      if (response.status === 409 && responseBody.code === "PRICE_CHANGED" && responseBody.quote) {
        await refreshCatalog();
        synchronize(responseBody.quote.serverTime);
        applyQuote(responseBody.quote.items, responseBody.quote.serverTime);
      }

      if (!response.ok) {
        throw new Error(responseBody.error ?? "Não foi possível enviar o pedido.");
      }

      clearCart();
      attempt.current = null;
      setCheckout(initialCheckoutForm);
      setSubmitState("success");
      setSubmitMessage(
        "Pedido enviado com sucesso! Em breve entraremos em contato pelo WhatsApp.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      setSubmitState("error");
      setSubmitMessage(message || "Não foi possível enviar o pedido. Tente novamente.");
    } finally {
      inFlight.current = false;
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
