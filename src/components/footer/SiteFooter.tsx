import Image from "next/image";
import { ClientPwaInstall } from "@/components/ClientPwaInstall";
import { WHATSAPP_BUSINESS_PHONE_NUMBER } from "@/data/orders";

// Contato e informações da loja. O link de WhatsApp é só para falar com a
// loja — o pedido continua sendo enviado pelo checkout do site.
export function SiteFooter() {
  return (
    <footer
      id="contato"
      className="border-t border-dna-cream/10 bg-dna-night pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-16 lg:pb-12"
    >
      <div className="dna-shell grid gap-12 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-4">
            <Image src="/images/logo-dna-acai.png" alt="" width={64} height={64} className="size-16 object-contain" />
            <p className="dna-title text-3xl uppercase">DNA do Açaí</p>
          </div>
          <p className="mt-4 text-dna-cream/70">Açaí de verdade, do seu jeito.</p>
          <ClientPwaInstall className="mt-6 grid w-fit" noteClassName="text-dna-cream/60" />
        </div>

        <div>
          <h2 className="dna-title text-xl">Contato</h2>
          <ul className="mt-4 space-y-3 text-dna-cream/80">
            <li>
              <a
                className="underline-offset-4 hover:text-dna-cream hover:underline"
                href={`https://wa.me/${WHATSAPP_BUSINESS_PHONE_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp (62) 99110-2715
              </a>
            </li>
            <li>
              <a
                className="underline-offset-4 hover:text-dna-cream hover:underline"
                href="https://www.instagram.com/dnadoacai/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram @dnadoacai
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="dna-title text-xl">Horário</h2>
          <p className="mt-4 text-dna-cream/80">Das 14h até a madrugada.</p>
          <p className="mt-3 text-dna-cream/60">Também no iFood e no 99Food.</p>
        </div>
      </div>

      <p className="dna-shell mt-14 text-sm text-dna-cream/40">
        © {new Date().getFullYear()} DNA do Açaí
      </p>
    </footer>
  );
}
