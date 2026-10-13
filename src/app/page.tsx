import { SiteFooter } from "@/components/footer/SiteFooter";
import { AcaiExperience } from "@/components/acai-experience/AcaiExperience";
import { SiteHeader } from "@/components/navigation/SiteHeader";
import { StoreOverlays } from "@/components/store/StoreOverlays";
import { StoreProvider } from "@/components/store/StoreProvider";
import { getStoreStatus } from "@/lib/store-status/server";
import { BrandSection } from "@/sections/BrandSection";
import { DnaWave } from "@/sections/DnaWave";
import { FinalCta } from "@/sections/FinalCta";
import { MenuSection } from "@/sections/MenuSection";
import { MonteSection } from "@/sections/MonteSection";

export const dynamic = "force-dynamic";

// Esconde a cena da intro antes do primeiro paint (só quando há movimento).
const introPendingScript =
  "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('dna-intro-pending')}}catch(e){}";

// Dados estruturados só com informações confirmadas da loja (sem endereço ou
// horário de fechamento, que não estão cadastrados).
const storeJsonLd = {
  "@context": "https://schema.org",
  "@type": "FoodEstablishment",
  name: "DNA do Açaí",
  slogan: "Açaí de verdade, do seu jeito.",
  url: "https://dnadoacai.com.br",
  image: "https://dnadoacai.com.br/images/og-dna-acai.png",
  logo: "https://dnadoacai.com.br/images/logo-dna-acai.png",
  telephone: "+55 62 99110-2715",
  servesCuisine: ["Açaí"],
  hasMenu: "https://dnadoacai.com.br/#cardapio",
  sameAs: ["https://www.instagram.com/dnadoacai/"],
};

export default async function Home() {
  const initialStoreStatus = await getStoreStatus().catch(() => undefined);

  return (
    <StoreProvider initialStoreStatus={initialStoreStatus}>
      <main className="dna-store min-h-screen overflow-x-clip">
        <script dangerouslySetInnerHTML={{ __html: introPendingScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }}
        />
        <SiteHeader />
        <AcaiExperience />
        <DnaWave className="z-30 -mt-[42svh] lg:-mt-[56svh]" />
        <MonteSection />
        <MenuSection />
        <BrandSection />
        <FinalCta />
        <SiteFooter />
        <StoreOverlays />
      </main>
    </StoreProvider>
  );
}
