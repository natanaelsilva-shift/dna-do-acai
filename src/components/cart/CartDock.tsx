"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { useCustomizer } from "@/components/builder/CustomizerProvider";
import { formatCurrency } from "@/lib/format/currency";

// Atalho persistente para a sacola: barra inferior no celular, pílula no
// canto no desktop. Some quando não há itens ou há um diálogo aberto.
export function CartDock() {
  const { totalItems, totalPrice, isCartDrawerOpen, openCartDrawer } = useCart();
  const { customizingProduct } = useCustomizer();
  const builderInView = useBuilderInView();

  if (totalItems === 0 || isCartDrawerOpen || customizingProduct) return null;

  // No celular o builder tem a própria barra fixa de "Adicionar à sacola";
  // o dock sai de cena para não cobri-la.
  const hideOnMobile = builderInView ? "max-lg:hidden" : "";

  return (
    <div className={`dna-fade-in ${hideOnMobile} fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:inset-x-auto lg:right-8 lg:bottom-8 lg:p-0`}>
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

function useBuilderInView() {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const builder = document.getElementById("monte");
    if (!builder) return;

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: "0px 0px -15% 0px",
    });
    observer.observe(builder);
    return () => observer.disconnect();
  }, []);

  return inView;
}
