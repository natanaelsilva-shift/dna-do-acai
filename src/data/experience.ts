// Manifesto visual da experiência do hero. Para trocar um asset provisório
// pelo definitivo, basta preencher `asset` / trocar o caminho aqui — os
// componentes não precisam mudar. Especificação dos assets em
// docs/ASSETS-DNA.md.

export type ImageAsset = {
  src: string;
  width: number;
  height: number;
};

export type IngredientCue = {
  id: string;
  label: string;
  // Recorte fotográfico com fundo transparente (WebP/AVIF). Enquanto não
  // existir, a montagem usa só a deixa tipográfica, sem ilustração.
  asset?: ImageAsset;
  // Leite em pó dispara a nuvem de partículas no canvas.
  particles?: boolean;
};

export const heroAssets = {
  poster: {
    avif: "/assets/dna/hero/cup-poster-720.avif",
    webp: "/assets/dna/hero/cup-poster-720.webp",
    avifSmall: "/assets/dna/hero/cup-poster-480.avif",
    webpSmall: "/assets/dna/hero/cup-poster-480.webp",
    width: 720,
    height: 1280,
  },
  // Provisório: vídeo de produto existente (copo girando). Substituir por
  // /assets/dna/videos/hero-cup-loop.{webm,mp4} quando produzido.
  video: {
    mp4: "/videos/acai-hero.mp4",
    webm: undefined as string | undefined,
  },
} as const;

// Ordem da montagem — a mesma dos complementos grátis do cardápio.
export const ingredientCues: IngredientCue[] = [
  { id: "banana", label: "Banana" },
  { id: "morango", label: "Morango" },
  { id: "leite-em-po", label: "Leite em pó", particles: true },
  { id: "granola", label: "Granola" },
  { id: "pacoca", label: "Paçoca" },
  { id: "leite-condensado", label: "Leite condensado" },
];
