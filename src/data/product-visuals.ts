// Apresentação visual dos produtos no cardápio. NÃO altera o catálogo
// (menu.ts continua com `image`, preço, IDs e regras). Quando um produto não
// estiver aqui (ex.: cadastrado pelo admin), o card usa `product.image`.
//
// "brand" = copo DNA montado (provisório: quadro do vídeo de produto)
// "pure"  = copo de açaí puro (provisório: recorte de imagem existente)
// Assets definitivos especificados em docs/ASSETS-DNA.md.

export type CupKind = "brand" | "pure";

export type ProductVisual = {
  cups: CupKind[];
  // Escala relativa do copo (700 ml = 1).
  scale: number;
  size?: string;
  tagline?: string;
};

// `frame`: quanto o quadro é maior que o copo (o pôster do vídeo tem margem).
export const cupImages: Record<
  CupKind,
  { src: string; width: number; height: number; masked: boolean; frame: number }
> = {
  brand: { src: "/assets/dna/hero/cup-poster-480.webp", width: 480, height: 853, masked: true, frame: 1.3 },
  pure: { src: "/assets/dna/acai/pure-cup.webp", width: 735, height: 752, masked: false, frame: 1 },
};

export const productVisuals: Record<string, ProductVisual> = {
  "dna-explosao-300ml": { cups: ["brand"], scale: 0.8, size: "300", tagline: "Para matar a vontade" },
  "dna-supremo-500ml": { cups: ["brand"], scale: 0.9, size: "500", tagline: "O favorito" },
  "dna-extra-supremo-700ml": { cups: ["brand"], scale: 1, size: "700", tagline: "Sem economia" },
  "copo-acai-puro-300ml": { cups: ["pure"], scale: 0.8, size: "300" },
  "copo-acai-puro-500ml": { cups: ["pure"], scale: 0.9, size: "500" },
  "copo-acai-puro-700ml": { cups: ["pure"], scale: 1, size: "700" },
  "combo-explosao-dna": { cups: ["brand", "brand"], scale: 0.8 },
  "combo-supremo-dna": { cups: ["brand", "brand"], scale: 0.9 },
  "combo-dna-gigante": { cups: ["brand", "brand"], scale: 1 },
  "combo-triplo-explosao": { cups: ["brand", "pure", "brand"], scale: 0.8 },
  "combo-triplo-supremo": { cups: ["brand", "pure", "brand"], scale: 0.9 },
};

// Escolha editorial para "Os favoritos da DNA" (sem dados de venda no
// sistema). Ajuste aqui quando houver números reais.
export const featuredProductIds = [
  "dna-supremo-500ml",
  "combo-supremo-dna",
  "dna-extra-supremo-700ml",
];
