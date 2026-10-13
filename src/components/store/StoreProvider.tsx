"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Category, ComplementGroup, Product } from "@/data/menu";
import { getStoreStatusLabel, type StoreStatusPayload } from "@/data/store-status";
import { CartProvider } from "@/components/cart/CartProvider";
import { CheckoutProvider } from "@/components/checkout/CheckoutProvider";
import { CustomizerProvider } from "@/components/builder/CustomizerProvider";
import { useCatalog } from "@/hooks/useCatalog";
import { useStoreStatus } from "@/lib/store-status/client";

type StoreContextValue = {
  categories: Category[];
  complementGroups: ComplementGroup[];
  products: Product[];
  isStoreOpen: boolean;
  storeStatusLabel: string;
};

const StoreContext = createContext<StoreContextValue | null>(null);

// Raiz da loja do cliente: catálogo, status da loja, carrinho, personalizador
// e checkout ficam disponíveis para qualquer seção (hero, builder, cardápio).
export function StoreProvider({
  children,
  initialStoreStatus,
}: {
  children: ReactNode;
  initialStoreStatus?: StoreStatusPayload;
}) {
  const storeState = useStoreStatus({
    initialStatus: initialStoreStatus,
    poll: true,
  });
  const { categories, complementGroups, products } = useCatalog();
  const isStoreOpen = storeState.status === "open";
  const storeStatusLabel = getStoreStatusLabel(storeState.status);

  const value = useMemo<StoreContextValue>(
    () => ({ categories, complementGroups, products, isStoreOpen, storeStatusLabel }),
    [categories, complementGroups, products, isStoreOpen, storeStatusLabel],
  );

  return (
    <StoreContext.Provider value={value}>
      <CartProvider>
        <CustomizerProvider>
          <CheckoutProvider>{children}</CheckoutProvider>
        </CustomizerProvider>
      </CartProvider>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error("useStore precisa estar dentro de <StoreProvider>.");
  }

  return context;
}
