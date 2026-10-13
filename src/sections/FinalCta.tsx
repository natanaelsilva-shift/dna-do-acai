import { heroAssets } from "@/data/experience";

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-title"
      className="relative isolate flex min-h-[88svh] items-end overflow-hidden bg-dna-night py-section lg:items-center"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_70%_50%,rgb(109_42_122/0.55)_0%,transparent_70%)]" />
        <picture>
          <source type="image/avif" srcSet={heroAssets.poster.avif} />
          <img
            src={heroAssets.poster.webp}
            width={heroAssets.poster.width}
            height={heroAssets.poster.height}
            alt=""
            loading="lazy"
            decoding="async"
            className="ax-cup-mask absolute right-[-22%] top-[4%] h-[62%] w-auto max-w-none opacity-70 sm:right-[-6%] lg:right-[4%] lg:top-1/2 lg:h-[115%] lg:-translate-y-1/2 lg:opacity-90"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-t from-dna-night via-dna-night/50 to-transparent lg:bg-gradient-to-r lg:from-dna-night lg:via-dna-night/70" />
      </div>

      <div className="dna-shell">
        <h2 id="cta-title" className="dna-display max-w-[10ch] text-[clamp(3.5rem,11vw,10.5rem)] uppercase">
          Já escolheu o seu?
        </h2>
        <p className="dna-lede mt-5 text-dna-cream/80">Monte agora o seu DNA.</p>
        <a href="#monte" className="dna-btn dna-btn-primary mt-8 min-h-14 px-8 text-lg">
          Quero meu açaí
        </a>
      </div>
    </section>
  );
}
