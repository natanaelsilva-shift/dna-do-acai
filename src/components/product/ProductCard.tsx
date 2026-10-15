"use client";

import type { Product } from "@/data/menu";
import { productVisuals } from "@/data/product-visuals";
import { useCustomizer } from "@/components/builder/CustomizerProvider";
import { useCart } from "@/components/cart/CartProvider";
import { ProductArt } from "@/components/product/ProductArt";
import { isComboProduct } from "@/lib/catalog/customization";
import { formatCurrency } from "@/lib/format/currency";
import { usePromotionClock } from "@/components/store/PromotionProvider";
import { getEffectivePrice, isPromotionActive } from "@/lib/catalog/pricing";
import { promotion } from "@/data/promotion";

type Variant = "standard" | "feature";

export function ProductCard({
  product,
  variant = "standard",
  priority = false,
}: {
  product: Product;
  variant?: Variant;
  priority?: boolean;
}) {
  const { addProduct } = useCustomizer();
  const { getProductQuantity, decrementCartItem } = useCart();
  const quantity = getProductQuantity(product.id);
  const visual = productVisuals[product.id];
  const combo = isComboProduct(product);
  const feature = variant === "feature";
  const { now } = usePromotionClock();
  const onPromotion = isPromotionActive(product, now);
  const originalPrice = onPromotion ? product.price
    : promotion.prices[product.id] === undefined ? product.originalPrice : undefined;

  // O espaço para a foto vazar acima do card fica no padding do wrapper (e não
  // em margem no card): com h-full dentro do grid, margem faria o card invadir
  // a seção seguinte.
  return (
    <div className={`flex h-full flex-col ${feature ? "pt-16 lg:pt-24" : "pt-14"}`}>
    <article data-product-id={product.id} data-promotion={onPromotion} className="dna-card group flex flex-1 flex-col transition-transform duration-500 ease-[var(--ease-dna)] hover:-translate-y-1">
      <div
        className={`pointer-events-none relative shrink-0 transition-transform duration-500 ease-[var(--ease-dna)] group-hover:-translate-y-2 group-hover:scale-[1.03] motion-reduce:transform-none ${
          feature ? "-mt-16 h-80 lg:-mt-24 lg:h-[26rem]" : "-mt-14 h-72"
        }`}
      >
        {visual?.size ? (
          <span
            aria-hidden="true"
            className={`dna-display pointer-events-none absolute inset-x-0 bottom-4 text-center text-dna-cream/[0.07] ${
              feature ? "text-[9rem] lg:text-[12rem]" : "text-[7.5rem]"
            }`}
          >
            {visual.size}
          </span>
        ) : null}
        <ProductArt product={product} priority={priority} className="relative h-full" />
        {onPromotion ? <span className="dna-promo-badge absolute bottom-2 left-5">PROMOÇÃO</span> : null}
      </div>

      <div className="flex flex-1 flex-col p-5 pt-4 sm:p-6 sm:pt-5">
        {visual?.tagline ? (
          <p className="text-sm font-semibold text-dna-sprout">{visual.tagline}</p>
        ) : null}
        <h3 className={`dna-title mt-1 ${feature ? "text-3xl lg:text-4xl" : "text-2xl"}`}>
          {product.name}
        </h3>
        <p className="mt-2 line-clamp-3 text-[0.95rem] leading-relaxed text-dna-cream/70">
          {product.description}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-6">
          <div>
            {originalPrice ? (
              <p className={`text-sm text-dna-cream/70 line-through ${onPromotion ? "decoration-red-400 decoration-2" : ""}`}>
                {formatCurrency(originalPrice)}
              </p>
            ) : null}
            <p className={`dna-price ${onPromotion ? "dna-promo-price" : ""} ${feature ? "text-3xl" : "text-2xl"}`}>
              {formatCurrency(getEffectivePrice(product, now))}
            </p>
            {product.customizable && quantity > 0 ? (
              <p className="mt-1 text-xs font-semibold text-dna-sprout">
                {quantity} {combo ? (quantity === 1 ? "combo" : "combos") : quantity === 1 ? "copo" : "copos"} na sacola
              </p>
            ) : null}
          </div>

          {product.customizable ? (
            <button
              type="button"
              onClick={() => addProduct(product)}
              className="dna-btn dna-btn-cream shrink-0"
            >
              {combo ? "Montar combo" : "Personalizar"}
            </button>
          ) : quantity > 0 ? (
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-dna-night/50 p-1">
              <button
                type="button"
                onClick={() => decrementCartItem(product.id)}
                aria-label={`Remover ${product.name}`}
                className="grid size-11 place-items-center rounded-full text-xl transition-colors hover:bg-white/10"
              >
                −
              </button>
              <span className="w-6 text-center font-semibold tabular-nums">{quantity}</span>
              <button
                type="button"
                onClick={() => addProduct(product)}
                aria-label={`Adicionar mais ${product.name}`}
                className="grid size-11 place-items-center rounded-full bg-dna-cream text-xl text-dna-ink transition-transform active:scale-95"
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => addProduct(product)}
              aria-label={`Adicionar ${product.name}`}
              className="dna-btn dna-btn-primary shrink-0"
            >
              Adicionar
            </button>
          )}
        </div>
      </div>
    </article>
    </div>
  );
}
