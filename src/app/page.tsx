import Image from "next/image";
import { ClientPwaInstall } from "@/components/ClientPwaInstall";
import { HeroMedia } from "@/components/HeroMedia";
import { MenuCatalog } from "@/components/MenuCatalog";
import { categories, productImages } from "@/data/menu";
import { getStoreStatus } from "@/lib/store-status/server";

export const dynamic = "force-dynamic";

const aboutFeatures = [
  {
    icon: "delivery",
    title: "Delivery rápido",
    description: "Pedidos preparados com agilidade para chegar no ponto certo.",
  },
  {
    icon: "ingredients",
    title: "Ingredientes selecionados",
    description: "Combinações caprichadas para um copo bonito e bem servido.",
  },
  {
    icon: "whatsapp",
    title: "Atendimento pelo WhatsApp",
    description: "Contato direto para acompanhar seu pedido com praticidade.",
  },
  {
    icon: "apps",
    title: "iFood e 99Food",
    description: "Peça também pelos principais apps de delivery da região.",
  },
] as const;

const homeImages = {
  about: {
    src: productImages.dnaSupremo,
    alt: "Copo de 500ml da DNA do Açaí",
    position: "50% 44%",
  },
} as const;

const brandLogo = {
  src: "/images/logo-dna-acai.png",
  alt: "Logo da DNA do Açaí",
} as const;

function AboutFeatureIcon({
  icon,
}: {
  icon: (typeof aboutFeatures)[number]["icon"];
}) {
  if (icon === "delivery") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
        <path
          d="M4 7h10v9H4zM14 10h3.8l2.2 2.5V16h-6z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (icon === "ingredients") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
        <path
          d="M5 13c5.8-.3 9.4-3.5 11-8 2.5 4 1.9 9.1-1.6 12.1C11.2 19.8 6.9 18.9 5 13Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M5 13c1.4 1 3.8 1.5 6.5-.2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  if (icon === "whatsapp") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
        <path
          d="M7.2 18.2 4 19l.9-3.1a7.5 7.5 0 1 1 2.3 2.3Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M9.4 8.7c.3 2.5 2 4.4 4.6 5.2l1.2-1.1 1.8.8c-.3 1.4-1.3 2.1-2.8 2-3.2-.4-5.6-2.5-6.5-5.7-.3-1.3.3-2.4 1.5-3Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        d="M6 5h12v14H6z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9 9h6M9 12h6M9 15h3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default async function Home() {
  const initialStoreStatus = await getStoreStatus().catch(() => undefined);

  return (
    <main className="min-h-screen overflow-x-clip bg-[#fffaf0] text-[#16221a]">
      <header className="relative z-20 border-b border-[#d7a948]/20 bg-[#071a14] text-white">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-8 md:py-4">
          <div className="flex items-center justify-between gap-4">
            <a href="#" className="group flex items-center gap-3" aria-label="DNA do Açaí">
              <Image
                src={brandLogo.src}
                alt={brandLogo.alt}
                width={72}
                height={72}
                priority
                className="size-14 shrink-0 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.32)] transition duration-300 group-hover:scale-[1.03] md:size-16"
              />
            </a>

            <nav className="hidden items-center gap-8 text-sm font-medium text-white/80 md:flex">
              <a className="transition hover:text-[#f8e8b5]" href="#cardapio">
                Cardápio
              </a>
              <a className="transition hover:text-[#f8e8b5]" href="#sobre">
                Sobre
              </a>
              <a className="transition hover:text-[#f8e8b5]" href="#pedido">
                Pedido
              </a>
            </nav>

            <a
              href="#cardapio"
              className="hidden min-h-11 items-center border border-[#d7a948] bg-[#d7a948] px-4 py-2 text-sm font-semibold text-[#103d2c] transition hover:bg-[#f1cf77] md:inline-flex"
            >
              Pedir agora
            </a>

            <ClientPwaInstall className="hidden md:grid md:justify-items-end" />

            <details className="group relative md:hidden">
              <summary
                className="grid size-11 cursor-pointer list-none place-items-center border border-[#d7a948]/70 bg-[#103d2c]/78 text-[#f8e8b5] backdrop-blur transition group-open:bg-[#d7a948] group-open:text-[#103d2c] [&::-webkit-details-marker]:hidden"
                aria-label="Abrir menu"
              >
                <span className="grid gap-1.5" aria-hidden="true">
                  <span className="block h-0.5 w-5 bg-current transition group-open:translate-y-2 group-open:rotate-45" />
                  <span className="block h-0.5 w-5 bg-current transition group-open:opacity-0" />
                  <span className="block h-0.5 w-5 bg-current transition group-open:-translate-y-2 group-open:-rotate-45" />
                </span>
              </summary>
              <nav className="absolute right-0 mt-3 grid w-[min(17rem,calc(100vw-2rem))] gap-1 border border-[#d7a948]/45 bg-[#fffaf0] p-2 text-sm font-semibold text-[#103d2c] shadow-[0_18px_48px_rgba(16,61,44,0.24)]">
                <a className="min-h-11 px-3 py-3 transition hover:bg-[#f3ead2]" href="#cardapio">
                  Cardápio
                </a>
                <a className="min-h-11 px-3 py-3 transition hover:bg-[#f3ead2]" href="#sobre">
                  Sobre
                </a>
                <a className="min-h-11 px-3 py-3 transition hover:bg-[#f3ead2]" href="#pedido">
                  Pedido
                </a>
              </nav>
            </details>
          </div>

          <ClientPwaInstall
            className="mt-3 grid md:hidden"
            noteClassName="text-[#f8e8b5]/80"
          />
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#061a14] text-white">
        <div className="absolute inset-0 bg-[linear-gradient(132deg,#061a14_0%,#103d2c_38%,#4b164c_72%,#07150f_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(215,169,72,0.08),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.28)_100%)]" />

        <div className="relative z-10 flex min-h-[calc(100svh-97px)] items-center justify-center px-4 py-6 md:px-8 md:py-8 max-md:min-h-0">
          <HeroMedia />
        </div>
      </section>

      <section className="border-y border-[#d7a948]/35 bg-[#4b164c]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-px px-4 py-4 text-[#f8e8b5] min-[360px]:grid-cols-2 md:grid-cols-3 md:px-8">
          {categories.map((category) => (
            <a
              key={category.id}
              href="#cardapio"
              className="min-h-14 border border-[#d7a948]/30 px-3 py-4 text-center text-xs font-semibold uppercase tracking-[0.08em] transition hover:bg-[#d7a948] hover:text-[#103d2c] sm:text-sm sm:tracking-[0.12em]"
            >
              {category.name}
            </a>
          ))}
        </div>
      </section>

      <MenuCatalog initialStoreStatus={initialStoreStatus} />

      <section
        id="sobre"
        className="relative overflow-hidden border-y border-[#d7a948]/35 bg-[#0f2d23] px-4 py-14 text-white md:px-8 md:py-20"
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,61,44,0.98)_0%,rgba(75,22,76,0.92)_58%,rgba(22,34,26,0.98)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[#f8e8b5]/40" />

        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:items-center">
          <div className="motion-safe:[animation:dna-about-fade_700ms_ease-out_both]">
            <div className="group relative h-[340px] overflow-hidden rounded-[8px] border border-[#d7a948]/40 bg-[linear-gradient(160deg,#09261c_0%,#421145_56%,#0f2d23_100%)] shadow-[0_28px_80px_rgba(0,0,0,0.32)] transition duration-500 hover:-translate-y-1 hover:border-[#f8e8b5]/65 hover:shadow-[0_34px_96px_rgba(0,0,0,0.42)] sm:h-[430px] lg:h-[520px]">
              <Image
                src={homeImages.about.src}
                alt={homeImages.about.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 560px"
                className="object-contain p-8 drop-shadow-[0_30px_42px_rgba(0,0,0,0.4)] transition duration-700 group-hover:scale-[1.04] sm:p-10 lg:p-12"
                style={{ objectPosition: homeImages.about.position }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,250,240,0.14)_0%,rgba(16,61,44,0)_42%,rgba(0,0,0,0.28)_100%)]" />
              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#d7a948]/35 bg-[#103d2c]/82 px-4 py-3 text-sm text-[#f8e8b5] shadow-[0_18px_42px_rgba(0,0,0,0.24)] backdrop-blur">
                <span className="font-semibold uppercase tracking-[0.14em]">
                  Açaí cremoso
                </span>
                <span className="text-white/80">Copo bem servido DNA</span>
              </div>
            </div>
          </div>

          <div className="motion-safe:[animation:dna-about-fade_850ms_ease-out_120ms_both]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7a948] md:text-sm md:tracking-[0.22em]">
              Sobre a DNA do Açaí
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.02] text-white sm:text-5xl lg:text-6xl">
              DNA DO AÇAÍ
            </h2>
            <p className="mt-4 max-w-2xl text-xl font-semibold leading-8 text-[#f8e8b5] sm:text-2xl">
              Mais que um açaí, uma experiência cheia de sabor.
            </p>

            <div className="mt-6 max-w-2xl space-y-4 text-base leading-7 text-white/78">
              <p>
                Trabalhamos com ingredientes selecionados, copos bem servidos e
                um açaí cremoso de verdade.
              </p>
              <p>
                Monte do seu jeito ou escolha nossos combos especiais. Entrega
                rápida, qualidade e muito sabor em cada pedido.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {aboutFeatures.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-[8px] border border-[#d7a948]/28 bg-white/[0.06] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.16)] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-[#d7a948]/55 hover:bg-white/[0.09]"
                >
                  <div className="grid size-10 place-items-center rounded-[8px] border border-[#d7a948]/45 bg-[#d7a948] text-[#103d2c]">
                    <AboutFeatureIcon icon={feature.icon} />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold uppercase tracking-[0.08em] text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/68">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#cardapio"
                className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-[#d7a948] bg-[#d7a948] px-6 text-sm font-semibold uppercase tracking-[0.08em] text-[#103d2c] shadow-[0_16px_34px_rgba(215,169,72,0.22)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#f1cf77] hover:shadow-[0_20px_42px_rgba(215,169,72,0.3)]"
              >
                Pedir agora
              </a>
              <a
                href="#cardapio"
                className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-[#f8e8b5]/35 px-6 text-sm font-semibold uppercase tracking-[0.08em] text-[#f8e8b5] transition duration-300 hover:-translate-y-0.5 hover:border-[#d7a948] hover:bg-[#d7a948]/12 hover:text-white"
              >
                Ver cardápio
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer
        id="pedido"
        className="relative overflow-hidden bg-[#071a14] px-4 py-10 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] text-white md:px-8 lg:pb-10"
      >
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(16,61,44,0.98)_0%,rgba(75,22,76,0.78)_62%,rgba(7,26,20,0.98)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[#d7a948]/45" />

        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-2xl gap-4">
            <Image
              src={brandLogo.src}
              alt={brandLogo.alt}
              width={88}
              height={88}
              className="size-16 shrink-0 object-contain drop-shadow-[0_16px_36px_rgba(0,0,0,0.28)]"
            />
            <div>
              <p className="text-base font-semibold uppercase tracking-[0.18em] text-[#d7a948]">
                DNA DO AÇAÍ
              </p>
              <p className="mt-2 text-base leading-7 text-white/78">
                Obrigado por visitar a DNA do Açaí 💜
                <br />
                Esperamos adoçar seu dia com muito sabor!
              </p>
            </div>
          </div>
          <a
            href="#cardapio"
            className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-[#d7a948] bg-[#d7a948] px-6 text-sm font-semibold uppercase tracking-[0.08em] text-[#103d2c] shadow-[0_16px_34px_rgba(215,169,72,0.2)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#f1cf77] hover:shadow-[0_20px_42px_rgba(215,169,72,0.28)]"
          >
            Montar pedido
          </a>
        </div>
      </footer>
    </main>
  );
}
