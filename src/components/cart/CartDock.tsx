"use client";

import { useCart } from "@/components/cart/CartProvider";
import { useCustomizer } from "@/components/builder/CustomizerProvider";
import { formatCurrency } from "@/lib/format/currency";

// Atalho persistente para a sacola: barra inferior no celular, pílula no
// canto no desktop. Some quando não há itens ou há um diálogo aberto.
export function CartDock() {
  const { totalItems, totalPrice, isCartDrawerOpen, openCartDrawer } = useCart();
  const { customizingProduct } = useCustomizer();

  if (totalItems === 0 || isCartDrawerOpen || customizingProduct) return null;

  return (
    <div className="dna-fade-in fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:inset-x-auto lg:right-8 lg:bottom-8 lg:p-0">
      <button
        type="button"
        onClick={openCartDrawer}
        className="dna-btn dna-btn-primary min-h-14 w-full justify-between gap-6 px-5 text-left lg:w-auto"
      >
        <span className="flex items-center gap-3">
          <span className="grid size-7 place-items-center rounded-full bg-white/20 text-sm tabular-nums">
            {totalItems}
          </span>
          Ver sacola
        </span>
        <span className="dna-price text-lg">{formatCurrency(totalPrice)}</span>
      </button>
    </div>
  );
}
