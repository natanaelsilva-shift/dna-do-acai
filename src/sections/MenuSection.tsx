"use client";

import type { Product } from "@/data/menu";
import { featuredProductIds } from "@/data/product-visuals";
import { ProductCard } from "@/components/product/ProductCard";
import { useStore } from "@/components/store/StoreProvider";
import { usePromotionClock } from "@/components/store/PromotionProvider";
import { formatPromotionRemaining, isPromotionActive } from "@/lib/catalog/pricing";

// Texto de vitrine por categoria do catálogo. Categorias novas (ex.:
// batidinhas, quando forem cadastradas) aparecem automaticamente com o nome
// do catálogo e o mesmo visual — nenhum produto é criado aqui.
const categoryPresentation: Record<string, { anchor: string; title: string; lede: string }> = {
  "monte-seu-acai": {
    anchor: "tamanhos",
    title: "Monte seu açaí",
    lede: "Escolha o tamanho. Os complementos você marca no passo seguinte.",
  },
  "acai-puro": {
    anchor: "acai-puro",
    title: "Açaí puro",
    lede: "Só açaí, cremoso e gelado, sem complementos.",
  },
  combos: {
    anchor: "combos",
    title: "Combo é melhor.",
    lede: "Dois ou três copos no mesmo pedido, cada um montado do seu jeito.",
  },
};

export function MenuSection() {
  const { categories, products, isStoreOpen, storeStatusLabel, storeUnavailableMessage } = useStore();
  const { now } = usePromotionClock();
  const hasPromotion = products.some((product) => isPromotionActive(product, now));

  const featured = featuredProductIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));

  const groups = categories
    .map((category) => {
      const presentation = categoryPresentation[category.id];
      return {
        id: category.id,
        anchor: presentation?.anchor ?? category.id,
        title: presentation?.title ?? category.name,
        lede: presentation?.lede ?? category.description,
        products: products.filter((product) => product.categoryId === category.id),
      };
    })
    .filter((group) => group.products.length > 0);

  return (
    <section id="cardapio" aria-labelledby="cardapio-title" className="relative bg-dna-night pt-section">
      <div className="dna-shell">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="cardapio-title" className="dna-display text-[clamp(3rem,9vw,8rem)] uppercase">
              Cardápio
            </h2>
            <p className="dna-lede mt-3 text-dna-cream/70">
              Preços de cada copo já com os complementos grátis. Extras você
              escolhe ao personalizar.
            </p>
          </div>
          <p
            className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              isStoreOpen ? "bg-dna-leaf/20 text-dna-sprout" : "bg-red-500/15 text-red-300"
            }`}
          >
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${isStoreOpen ? "bg-dna-sprout" : "bg-red-400"}`}
            />
            {storeStatusLabel}
          </p>
        </header>

        {hasPromotion ? (
          <p data-promotion-countdown className="mt-6 w-fit rounded-xl border border-[#c8f542]/30 bg-[#c8f542]/10 px-4 py-3 text-sm text-[#c8f542]">
            <strong>OFERTA POR TEMPO LIMITADO</strong>
            <span className="ml-2 inline-block tabular-nums">Promoção termina em: {formatPromotionRemaining(now)}</span>
          </p>
        ) : null}

        {!isStoreOpen ? (
          <p className="mt-6 rounded-[var(--radius-panel)] bg-dna-acai px-5 py-4 font-semibold">
            {storeUnavailableMessage}
          </p>
        ) : null}
      </div>

      <nav
        aria-label="Categorias do cardápio"
        className="dna-glass sticky top-16 z-30 mt-10 border-x-0 lg:top-20"
      >
        <ul className="dna-shell flex gap-2 overflow-x-auto py-3 [scrollbar-width:none]">
          {featured.length > 0 ? (
            <li>
              <a href="#favoritos" className="dna-chip whitespace-nowrap">
                Favoritos
              </a>
            </li>
          ) : null}
          {groups.map((group) => (
            <li key={group.id}>
              <a href={`#${group.anchor}`} className="dna-chip whitespace-nowrap">
                {group.title.replace(/\.$/, "")}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {featured.length > 0 ? (
        <div id="favoritos" className="scroll-mt-36 pt-16 lg:pt-24">
          <div className="dna-shell">
            <h3 className="dna-display text-[clamp(2.5rem,6vw,5.5rem)] uppercase">
              Os favoritos da DNA.
            </h3>
          </div>
          <ul className="dna-shell mt-4 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-6 [scrollbar-width:none] lg:grid lg:grid-cols-3 lg:gap-8 lg:overflow-visible">
            {featured.map((product, index) => (
              <li key={product.id} className="w-[82%] shrink-0 snap-center sm:w-[46%] lg:w-auto">
                <ProductCard product={product} variant="feature" priority={index === 0} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {groups.map((group) => (
        <div key={group.id} id={group.anchor} className="scroll-mt-36 pt-16 lg:pt-24">
          <div className="dna-shell">
            <h3 className="dna-display text-[clamp(2.5rem,6vw,5.5rem)] uppercase">{group.title}</h3>
            {group.lede ? <p className="dna-lede mt-3 text-dna-cream/70">{group.lede}</p> : null}
            <ul className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.products.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </section>
  );
}
