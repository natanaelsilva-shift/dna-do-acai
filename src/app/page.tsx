import Image from "next/image";
import { MenuCatalog } from "@/components/MenuCatalog";
import { categories, heroImage, products } from "@/data/menu";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);

export default function Home() {
  const comboProducts = products.filter((product) => product.categoryId === "combos");

  return (
    <main className="min-h-screen overflow-hidden bg-[#fffaf0] text-[#16221a]">
      <header className="absolute left-0 right-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
          <a href="#" className="group flex items-center gap-3" aria-label="DNA do Açaí">
            <span className="grid size-11 place-items-center border border-[#d7a948] bg-[#103d2c] text-sm font-semibold text-[#f8e8b5]">
              DNA
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-[#f8e8b5]">
                DNA do
              </span>
              <span className="block text-xl font-semibold text-white">Açaí</span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-medium text-white/80 md:flex">
            <a className="transition hover:text-[#f8e8b5]" href="#cardapio">
              Cardápio
            </a>
            <a className="transition hover:text-[#f8e8b5]" href="#combos">
              Combos
            </a>
            <a className="transition hover:text-[#f8e8b5]" href="#pedido">
              Pedido
            </a>
          </nav>

          <a
            href="#cardapio"
            className="border border-[#d7a948] bg-[#d7a948] px-4 py-2 text-sm font-semibold text-[#103d2c] transition hover:bg-[#f1cf77]"
          >
            Pedir agora
          </a>
        </div>
      </header>

      <section className="relative min-h-[82vh] bg-[#103d2c]">
        <Image
          src={heroImage}
          alt="Açaí com frutas frescas"
          fill
          loading="eager"
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,61,44,0.96)_0%,rgba(75,22,76,0.78)_48%,rgba(16,61,44,0.22)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,rgba(215,169,72,0.32),transparent_28%)]" />

        <div className="relative z-10 mx-auto flex min-h-[82vh] max-w-7xl items-end px-5 pb-14 pt-32 md:px-8 lg:pb-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#f8e8b5]">
              Açaí cremoso e geladinho
            </p>
            <h1 className="mt-5 max-w-2xl text-5xl font-semibold leading-[1.02] text-white md:text-6xl lg:text-7xl">
              DNA do Açaí
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/85">
              Monte seu açaí do seu jeito, escolha o açaí puro ou aproveite os
              combos DNA para compartilhar.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#cardapio"
                className="inline-flex min-h-12 items-center justify-center bg-[#d7a948] px-6 text-sm font-semibold text-[#103d2c] transition hover:bg-[#f1cf77]"
              >
                Ver cardápio
              </a>
              <a
                href="#combos"
                className="inline-flex min-h-12 items-center justify-center border border-white/35 px-6 text-sm font-semibold text-white transition hover:border-[#f8e8b5] hover:text-[#f8e8b5]"
              >
                Ver combos
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#d7a948]/35 bg-[#4b164c]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 py-4 text-[#f8e8b5] md:grid-cols-3 md:px-8">
          {categories.map((category) => (
            <a
              key={category.id}
              href="#cardapio"
              className="min-h-16 border border-[#d7a948]/30 px-4 py-4 text-center text-sm font-semibold uppercase tracking-[0.14em] transition hover:bg-[#d7a948] hover:text-[#103d2c]"
            >
              {category.name}
            </a>
          ))}
        </div>
      </section>

      <MenuCatalog />

      <section
        id="combos"
        className="border-y border-[#d7a948]/35 bg-[#103d2c] px-5 py-14 text-white md:px-8"
      >
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d7a948]">
              Combos DNA
            </p>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">
              Opções reais da loja para dividir ou pedir em grupo.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {comboProducts.map((product) => (
              <a
                key={product.id}
                href="#cardapio"
                className="min-h-28 border border-[#d7a948]/45 p-4 text-sm text-[#f8e8b5] transition hover:bg-[#d7a948] hover:text-[#103d2c]"
              >
                <span className="block font-semibold">{product.name}</span>
                <span className="mt-2 block text-lg font-semibold">
                  {formatCurrency(product.price)}
                </span>
                <span className="mt-2 block leading-5">{product.description}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer id="pedido" className="bg-[#16221a] px-5 py-8 text-white md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d7a948]">
              DNA do Açaí
            </p>
            <p className="mt-2 text-sm text-white/70">
              Monte seu açaí, escolha açaí puro ou aproveite os combos DNA.
            </p>
          </div>
          <a
            href="#cardapio"
            className="inline-flex min-h-11 items-center justify-center border border-[#d7a948] px-5 text-sm font-semibold text-[#f8e8b5] transition hover:bg-[#d7a948] hover:text-[#103d2c]"
          >
            Montar pedido
          </a>
        </div>
      </footer>
    </main>
  );
}
