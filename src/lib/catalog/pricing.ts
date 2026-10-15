import type { Product } from "@/data/menu";
import { getPromotionWindow, promotion, type PromotionWindow } from "@/data/promotion";

export const PROMOTION_EXPIRED_MESSAGE =
  "A promoção deste item terminou e o valor do seu pedido foi atualizado.";

export function getPromotionStatus(now: number, window = getPromotionWindow()) {
  if (now < Date.parse(window.startAt)) return "Agendada";
  if (now < Date.parse(window.endAt)) return "Ativa";
  return "Encerrada";
}

export function isPromotionActive(
  product: Pick<Product, "id" | "price">,
  now: number,
  window: PromotionWindow = getPromotionWindow(),
) {
  const price = promotion.prices[product.id];
  return Number.isInteger(price) && price >= 0 && price < product.price &&
    Number.isFinite(now) && now >= Date.parse(window.startAt) && now < Date.parse(window.endAt);
}

export function getEffectivePrice(
  product: Pick<Product, "id" | "price">,
  now = Date.now(),
  window: PromotionWindow = getPromotionWindow(),
) {
  return isPromotionActive(product, now, window) ? promotion.prices[product.id] : product.price;
}

export function formatPromotionRemaining(now: number, window = getPromotionWindow()) {
  const minutes = Math.max(0, Math.ceil((Date.parse(window.endAt) - now) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes % 60).padStart(2, "0")}min`;
}
