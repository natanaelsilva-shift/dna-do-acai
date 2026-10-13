"use client";

import { CustomizerDialog } from "@/components/builder/CustomizerDialog";
import { CartDock } from "@/components/cart/CartDock";
import { CartSheet } from "@/components/cart/CartSheet";

// Camadas globais da loja, disponíveis para qualquer seção.
export function StoreOverlays() {
  return (
    <>
      <CartDock />
      <CartSheet />
      <CustomizerDialog />
    </>
  );
}
