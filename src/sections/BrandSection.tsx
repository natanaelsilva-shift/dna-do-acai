import { cupImages } from "@/data/product-visuals";

// Benefícios com as mesmas afirmações que a loja já fazia no site anterior.
const benefits = [
  { title: "Açaí cremoso", text: "Cremoso de verdade, em copos bem servidos." },
  { title: "Ingredientes selecionados", text: "Combinações caprichadas para um copo bonito." },
  { title: "Monte do seu jeito", text: "Do tamanho aos complementos, sai como você pediu." },
  { title: "Pedido rápido", text: "Poucos toques para pedir e contato direto pelo WhatsApp." },
] as const;

export function BrandSection() {
  return (
    <section aria-labelledby="dna-title" className="dna-paper relative overflow-hidden py-section">
      <div className="dna-shell grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-20">
        <div>
          <h2 id="dna-title" className="dna-display text-[clamp(3.5rem,11vw,10rem)] uppercase text-dna-acai">
            Isso é DNA.
          </h2>
          <p className="dna-title mt-6 max-w-[22ch] text-[clamp(1.6rem,3.2vw,2.6rem)] text-dna-ink">
            A gente acredita que açaí bom é aquele que tem a sua cara.
          </p>
          <p className="dna-lede mt-6 text-dna-ink/70">
            Do tamanho aos complementos,
            <br />
            você escolhe.
            <br />A gente prepara.
          </p>
        </div>

        <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[2rem] bg-[radial-gradient(70%_60%_at_50%_40%,var(--color-dna-berry)_0%,var(--color-dna-acai)_55%,var(--color-dna-night)_100%)] lg:max-w-none">
          <div className="ax-cup-mask absolute inset-x-[8%] bottom-[-6%] top-[2%]">
            {/* eslint-disable-next-line @next/next/no-img-element -- pôster já otimizado */}
            <img
              src={cupImages.brand.src}
              width={cupImages.brand.width}
              height={cupImages.brand.height}
              alt="Copo de açaí DNA montado com leite condensado e morango"
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          </div>
        </div>
      </div>

      <ul className="dna-shell mt-16 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
        {benefits.map((benefit) => (
          <li key={benefit.title} className="border-t-2 border-dna-leaf pt-4">
            <h3 className="dna-title text-xl text-dna-ink">{benefit.title}</h3>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-dna-ink/70">{benefit.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
