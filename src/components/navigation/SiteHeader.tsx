"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { ClientPwaInstall } from "@/components/ClientPwaInstall";
import { formatCurrency } from "@/lib/format/currency";

const navLinks = [
  { href: "#inicio", label: "Início" },
  { href: "#cardapio", label: "Cardápio" },
  { href: "#combos", label: "Combos" },
  { href: "#monte", label: "Monte o seu" },
  { href: "#contato", label: "Contato" },
] as const;

export function SiteHeader() {
  const { totalItems, totalPrice, openCartDrawer } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled || menuOpen ? "dna-glass border-x-0 border-t-0" : "border-b border-transparent"
      }`}
    >
      <div className="dna-shell flex h-16 items-center justify-between gap-4 lg:h-20">
        <a href="#inicio" className="flex shrink-0 items-center gap-3" aria-label="DNA do Açaí, início">
          <Image
            src="/images/logo-dna-acai.png"
            alt=""
            width={48}
            height={48}
            priority
            className="size-10 object-contain lg:size-12"
          />
        </a>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-8 text-[0.95rem] font-medium text-dna-cream/75">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a className="transition-colors hover:text-dna-cream" href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCartDrawer}
            className="relative grid size-11 place-items-center rounded-full text-dna-cream transition-colors hover:bg-white/8"
            aria-label={
              totalItems > 0
                ? `Sacola: ${totalItems} ${totalItems === 1 ? "item" : "itens"}, ${formatCurrency(totalPrice)}`
                : "Sacola vazia"
            }
          >
            <BagIcon />
            {totalItems > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-dna-leaf px-1 text-[0.7rem] font-bold leading-5 text-white">
                {totalItems}
              </span>
            ) : null}
          </button>

          <a href="#cardapio" className="dna-btn dna-btn-primary hidden min-h-11 px-5 text-[0.95rem] lg:inline-flex">
            Pedir agora
          </a>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-11 place-items-center rounded-full text-dna-cream transition-colors hover:bg-white/8 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="menu-mobile"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          >
            <span className="grid gap-1.5" aria-hidden="true">
              <span
                className={`block h-0.5 w-5 rounded bg-current transition-transform ${menuOpen ? "translate-y-2 rotate-45" : ""}`}
              />
              <span className={`block h-0.5 w-5 rounded bg-current transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
              <span
                className={`block h-0.5 w-5 rounded bg-current transition-transform ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`}
              />
            </span>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav id="menu-mobile" aria-label="Menu" className="dna-shell pb-5 lg:hidden">
          <ul className="grid gap-1 border-t border-dna-cream/10 pt-3">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="dna-title flex min-h-12 items-center text-2xl text-dna-cream"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#cardapio"
            onClick={() => setMenuOpen(false)}
            className="dna-btn dna-btn-primary mt-4 w-full"
          >
            Pedir agora
          </a>
          <ClientPwaInstall className="mt-4 grid" noteClassName="text-dna-cream/70" />
        </nav>
      ) : null}
    </header>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
      <path
        d="M6 8h12l-1 12H7L6 8Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M9 8V6.5a3 3 0 0 1 6 0V8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}
