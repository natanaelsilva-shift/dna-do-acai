// Apresentação dos tamanhos. Preço e limite de complementos vêm sempre do
// produto real do catálogo (menu.ts) — aqui fica só o texto de vitrine.

export type SizePresentation = {
  productId: string;
  size: string;
  tagline: string;
  // Escala visual do copo no preview (700 ml = 1).
  scale: number;
};

export const cupSizes: SizePresentation[] = [
  { productId: "dna-explosao-300ml", size: "300", tagline: "Para matar a vontade", scale: 0.8 },
  { productId: "dna-supremo-500ml", size: "500", tagline: "O favorito", scale: 0.9 },
  { productId: "dna-extra-supremo-700ml", size: "700", tagline: "Sem economia", scale: 1 },
];

export const defaultBuilderProductId = "dna-supremo-500ml";
