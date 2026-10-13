import { CupBuilder } from "@/components/builder/CupBuilder";

export function MonteSection() {
  return (
    <section id="monte" aria-labelledby="monte-title" className="relative bg-dna-acai pb-section pt-6 lg:pt-10">
      <div className="dna-shell">
        <header className="mb-10 max-w-3xl lg:mb-14">
          <h2 id="monte-title" className="dna-display text-[clamp(3rem,9vw,8rem)] uppercase">
            Monte do seu jeito.
          </h2>
          <p className="dna-lede mt-4 text-dna-cream/75">
            Escolha o tamanho, marque os complementos e veja o seu copo ganhar
            forma. O preço acompanha cada escolha.
          </p>
        </header>
        <CupBuilder />
      </div>
    </section>
  );
}
