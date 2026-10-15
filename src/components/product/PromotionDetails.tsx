"use client";

import type { Product } from "@/data/menu";
import { getPromotionWindow, promotion } from "@/data/promotion";
import { usePromotionClock } from "@/components/store/PromotionProvider";
import { getPromotionStatus } from "@/lib/catalog/pricing";
import { formatCurrency } from "@/lib/format/currency";

const date = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function PromotionDetails({ product }: { product: Product }) {
  const { now } = usePromotionClock();
  const promoPrice = promotion.prices[product.id];
  if (promoPrice === undefined) return null;
  const window = getPromotionWindow();
  return (
    <aside className="rounded-xl border border-[#103d2c]/15 bg-[#eaf8ef] p-4 text-sm text-[#103d2c]">
      <p className="font-bold">Promoção de 72 horas · {getPromotionStatus(now)}</p>
      <dl className="mt-2 grid gap-1 sm:grid-cols-2">
        <div><dt className="inline">Preço normal: </dt><dd className="inline font-bold">{formatCurrency(product.price)}</dd></div>
        <div><dt className="inline">Preço promocional: </dt><dd className="inline font-bold">{formatCurrency(promoPrice)}</dd></div>
        <div><dt className="inline">Início: </dt><dd className="inline">{date(window.startAt)}</dd></div>
        <div><dt className="inline">Fim: </dt><dd className="inline">{date(window.endAt)}</dd></div>
      </dl>
      <p className="mt-2 text-xs">Horário de São Paulo. Campanha centralizada; o preço normal retorna automaticamente.</p>
    </aside>
  );
}
