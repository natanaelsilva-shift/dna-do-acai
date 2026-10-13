import Image from "next/image";
import type { Product } from "@/data/menu";
import { cupImages, productVisuals, type CupKind } from "@/data/product-visuals";

// Composição fotográfica do produto: um copo, ou dois/três copos lado a lado
// para combos. Copos de trás ficam menores e mais escuros (profundidade).
export function ProductArt({
  product,
  priority = false,
  className = "",
}: {
  product: Product;
  priority?: boolean;
  className?: string;
}) {
  const visual = productVisuals[product.id];

  if (!visual) {
    return product.image.startsWith("/images/") ? (
      <div className={`relative overflow-hidden rounded-[1.25rem] ${className}`}>
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 360px, 80vw"
          className="object-cover"
          style={{ objectPosition: product.imagePosition }}
        />
      </div>
    ) : null;
  }

  const count = visual.cups.length;

  // Copos em posição absoluta: a composição nunca define a largura do card
  // (em flex, três copos lado a lado estouravam a tela no celular).
  return (
    <div className={`relative ${className}`} role="img" aria-label={product.name}>
      {visual.cups.map((kind, index) => {
        const isCenter = count === 1 || (count === 3 && index === 1);
        const behind = count > 1 && !isCenter;
        // Deslocamento em % da largura do próprio copo.
        const offset =
          count === 1 ? 0 : count === 2 ? (index === 0 ? -34 : 34) : (index - 1) * 58;

        return (
          <Cup
            key={`${kind}-${index}`}
            kind={kind}
            priority={priority && index === 0}
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              height: `${(behind ? 84 : 100) * visual.scale * cupImages[kind].frame}%`,
              transform: `translateX(${offset - 50}%)`,
              zIndex: behind ? 1 : 2,
              filter: behind ? "brightness(0.78)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function Cup({
  kind,
  priority,
  style,
}: {
  kind: CupKind;
  priority: boolean;
  style: React.CSSProperties;
}) {
  const image = cupImages[kind];

  return (
    <div
      className={`relative shrink-0 drop-shadow-[0_28px_28px_rgb(10_4_12/0.55)] ${image.masked ? "ax-cup-mask" : ""}`}
      style={{ aspectRatio: `${image.width} / ${image.height}`, ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- asset local já em WebP no tamanho de uso */}
      <img
        src={image.src}
        width={image.width}
        height={image.height}
        alt=""
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="size-full object-cover"
      />
    </div>
  );
}
