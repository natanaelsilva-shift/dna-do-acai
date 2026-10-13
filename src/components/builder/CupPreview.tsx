import { heroAssets, type ImageAsset } from "@/data/experience";

export type PreviewIngredient = {
  id: string;
  label: string;
  asset?: ImageAsset;
};

type PreviewExtra = {
  id: string;
  label: string;
  quantity: number;
};

// Preview que reage às escolhas. Hoje: foto real do copo + escala por tamanho
// + complementos sinalizados ao redor. Quando os recortes fotográficos
// existirem (data/experience.ts), cada complemento vira uma camada sobre o
// copo sem mudar este contrato.
export function CupPreview({
  size,
  scale,
  ingredients,
  extras,
  freeCount,
  freeLimit,
}: {
  size: string;
  scale: number;
  ingredients: PreviewIngredient[];
  extras: PreviewExtra[];
  freeCount: number;
  freeLimit: number;
}) {
  return (
    <figure className="relative mx-auto flex aspect-[4/5] w-full max-w-[34rem] items-center justify-center overflow-hidden rounded-[2rem] bg-[radial-gradient(70%_60%_at_50%_45%,rgb(109_42_122/0.9)_0%,rgb(42_18_48/0.95)_60%,var(--color-dna-night)_100%)] max-lg:aspect-[5/4] max-lg:max-w-none">
      <span
        aria-hidden="true"
        className="dna-display pointer-events-none absolute inset-x-0 top-[6%] text-center text-[clamp(6rem,24vw,13rem)] text-dna-cream/[0.07] transition-[letter-spacing] duration-500"
      >
        {size}
      </span>

      <div
        className="relative h-[86%] transition-transform duration-500 ease-[var(--ease-dna)] motion-reduce:transition-none"
        style={{ transform: `scale(${scale})`, transformOrigin: "50% 92%" }}
      >
        <div className="ax-cup-mask relative aspect-[9/16] h-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- pôster já otimizado em AVIF/WebP */}
          <img
            src={heroAssets.poster.webpSmall}
            width={480}
            height={853}
            alt={`Copo de ${size} ml montado`}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        </div>
        {ingredients
          .filter((ingredient) => ingredient.asset)
          .map((ingredient, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- recorte do manifesto
            <img
              key={ingredient.id}
              src={ingredient.asset!.src}
              width={ingredient.asset!.width}
              height={ingredient.asset!.height}
              alt=""
              className="dna-layer-in absolute left-1/2 w-1/2 -translate-x-1/2"
              style={{ top: `${6 + index * 4}%` }}
            />
          ))}
      </div>

      <ul
        aria-label="Complementos escolhidos"
        className="absolute inset-y-0 left-0 flex w-[34%] flex-col justify-center gap-3 pl-4 sm:pl-6"
      >
        {ingredients.map((ingredient) => (
          <li key={ingredient.id} className="dna-layer-in flex items-center gap-2 text-sm font-semibold sm:text-base">
            <span className="truncate">{ingredient.label}</span>
            <span className="h-px flex-1 bg-dna-cream/35" aria-hidden="true" />
            <span className="size-1.5 shrink-0 rounded-full bg-dna-sprout" aria-hidden="true" />
          </li>
        ))}
      </ul>

      <ul
        aria-label="Extras"
        className="absolute inset-y-0 right-0 flex w-[30%] flex-col justify-center gap-3 pr-4 text-right sm:pr-6"
      >
        {extras.map((extra) => (
          <li key={extra.id} className="dna-layer-in text-sm font-semibold sm:text-base">
            <span className="text-dna-sprout">+{extra.quantity}</span> {extra.label}
          </li>
        ))}
      </ul>

      <figcaption className="absolute inset-x-0 bottom-4 text-center text-sm text-dna-cream/70">
        {freeCount} de {freeLimit} complementos grátis escolhidos
      </figcaption>
    </figure>
  );
}
