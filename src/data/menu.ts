export type Category = {
  id: string;
  name: string;
  description: string;
};

export type Product = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  tag?: string;
  serves?: string;
  preparationTime?: string;
  image: string;
  imagePosition: string;
  customizable?: boolean;
  complementLimit?: number;
  comboCups?: ComboCup[];
};

export type ComboCup = {
  id: string;
  label: string;
  size: "300ml" | "500ml";
  complementLimit?: number;
  pure?: boolean;
};

export type ComplementOption = {
  id: string;
  name: string;
  description?: string;
  price: number;
};

export type ComplementGroup = {
  id: string;
  title: string;
  description: string;
  required: boolean;
  type: "single" | "multiple";
  minSelections?: number;
  maxSelections?: number;
  options: ComplementOption[];
};

export type CatalogData = {
  categories: Category[];
  products: Product[];
  complementGroups: ComplementGroup[];
};

export const CATALOG_STORAGE_KEY = "dna-do-acai-catalog-v3";

export const productImages = {
  dnaExplosao: "/images/dna-explosao.avif",
  dnaSupremo: "/images/dna-supremo.avif",
  acaiPuro300: "/images/acai-puro-300.jpg",
  acaiPuro500: "/images/acai-puro-500.avif",
} as const;

export const defaultProductImage = productImages.dnaExplosao;

type ProductImageDefaults = Pick<Product, "image" | "imagePosition">;

export const productImageDefaults: Record<string, ProductImageDefaults> = {
  "dna-explosao-300ml": {
    image: productImages.dnaExplosao,
    imagePosition: "50% 46%",
  },
  "dna-supremo-500ml": {
    image: productImages.dnaSupremo,
    imagePosition: "50% 46%",
  },
  "copo-acai-puro-300ml": {
    image: productImages.acaiPuro300,
    imagePosition: "50% 45%",
  },
  "copo-acai-puro-500ml": {
    image: productImages.acaiPuro500,
    imagePosition: "50% 46%",
  },
  "combo-supremo-dna": {
    image: "",
    imagePosition: "50% 50%",
  },
  "combo-explosao-dna": {
    image: "",
    imagePosition: "50% 50%",
  },
  "combo-triplo-explosao": {
    image: "",
    imagePosition: "50% 50%",
  },
  "combo-triplo-supremo": {
    image: "",
    imagePosition: "50% 50%",
  },
};

const isLocalProductImage = (image: string) => image.startsWith("/images/");

export function withCatalogProductImages(catalog: CatalogData): CatalogData {
  return {
    ...catalog,
    products: catalog.products.map((product) => {
      const defaults = productImageDefaults[product.id];

      if (defaults) {
        return {
          ...product,
          ...defaults,
        };
      }

      const image = typeof product.image === "string" ? product.image : "";

      return {
        ...product,
        image: isLocalProductImage(image) ? image : defaultProductImage,
        imagePosition: product.imagePosition || "50% 46%",
      };
    }),
  };
}

export const categories: Category[] = [
  {
    id: "monte-seu-acai",
    name: "Monte Seu Açaí",
    description: "",
  },
  {
    id: "acai-puro",
    name: "Açaí Puro",
    description: "",
  },
  {
    id: "combos",
    name: "Combos",
    description: "",
  },
];

export const products: Product[] = [
  {
    id: "dna-explosao-300ml",
    categoryId: "monte-seu-acai",
    name: "DNA Explosão (300ml)",
    description:
      "Monte seu açaí de 300ml do seu jeito, com diversos complementos.",
    price: 1299,
    image: productImages.dnaExplosao,
    imagePosition: "50% 46%",
    customizable: true,
    complementLimit: 3,
  },
  {
    id: "dna-supremo-500ml",
    categoryId: "monte-seu-acai",
    name: "DNA Supremo (500ml)",
    description:
      "Monte seu açaí de 500ml do seu jeito, com diversos complementos.",
    price: 1899,
    image: productImages.dnaSupremo,
    imagePosition: "50% 46%",
    customizable: true,
    complementLimit: 4,
  },
  {
    id: "copo-acai-puro-300ml",
    categoryId: "acai-puro",
    name: "Copo de Açaí Puro (300ml)",
    description:
      "Açaí 100% puro, cremoso e geladinho. Sabor original de verdade.",
    price: 999,
    image: productImages.acaiPuro300,
    imagePosition: "50% 45%",
  },
  {
    id: "copo-acai-puro-500ml",
    categoryId: "acai-puro",
    name: "Copo de Açaí Puro (500ml)",
    description:
      "Açaí puro em tamanho maior, bem servido e super cremoso.",
    price: 1499,
    image: productImages.acaiPuro500,
    imagePosition: "50% 46%",
  },
  {
    id: "combo-supremo-dna",
    categoryId: "combos",
    name: "Combo Supremo DNA",
    description: "2 copões de 500ml com até 4 complementos cada.",
    price: 3599,
    image: "",
    imagePosition: "50% 50%",
    customizable: true,
    comboCups: [
      {
        id: "copo-1-500ml",
        label: "1º Copo 500ml",
        size: "500ml",
        complementLimit: 4,
      },
      {
        id: "copo-2-500ml",
        label: "2º Copo 500ml",
        size: "500ml",
        complementLimit: 4,
      },
    ],
  },
  {
    id: "combo-explosao-dna",
    categoryId: "combos",
    name: "Combo Explosão DNA",
    description: "2 açaís de 300ml com até 3 complementos cada.",
    price: 2499,
    image: "",
    imagePosition: "50% 50%",
    customizable: true,
    comboCups: [
      {
        id: "copo-1-300ml",
        label: "1º Copo 300ml",
        size: "300ml",
        complementLimit: 3,
      },
      {
        id: "copo-2-300ml",
        label: "2º Copo 300ml",
        size: "300ml",
        complementLimit: 3,
      },
    ],
  },
  {
    id: "combo-triplo-explosao",
    categoryId: "combos",
    name: "Combo Triplo Explosão",
    description: "2 açaís completos de 300ml + 1 açaí puro 300ml.",
    price: 2999,
    image: "",
    imagePosition: "50% 50%",
    customizable: true,
    comboCups: [
      {
        id: "copo-1-300ml",
        label: "1º Copo 300ml",
        size: "300ml",
        complementLimit: 3,
      },
      {
        id: "copo-2-300ml",
        label: "2º Copo 300ml",
        size: "300ml",
        complementLimit: 3,
      },
      {
        id: "copo-3-puro-300ml",
        label: "3º Copo",
        size: "300ml",
        pure: true,
      },
    ],
  },
  {
    id: "combo-triplo-supremo",
    categoryId: "combos",
    name: "Combo Triplo Supremo",
    description: "2 açaís completos de 500ml + 1 açaí puro 500ml.",
    price: 4299,
    image: "",
    imagePosition: "50% 50%",
    customizable: true,
    comboCups: [
      {
        id: "copo-1-500ml",
        label: "1º Copo 500ml",
        size: "500ml",
        complementLimit: 4,
      },
      {
        id: "copo-2-500ml",
        label: "2º Copo 500ml",
        size: "500ml",
        complementLimit: 4,
      },
      {
        id: "copo-3-puro-500ml",
        label: "3º Copo",
        size: "500ml",
        pure: true,
      },
    ],
  },
];

export const cupComplementGroups: ComplementGroup[] = [
  {
    id: "complementos",
    title: "Complementos",
    description: "Escolha seus complementos inclusos.",
    required: false,
    type: "multiple",
    maxSelections: 4,
    options: [
      {
        id: "banana",
        name: "Banana",
        price: 0,
      },
      {
        id: "morango",
        name: "Morango",
        price: 0,
      },
      {
        id: "leite-condensado",
        name: "Leite condensado",
        price: 0,
      },
      {
        id: "leite-em-po",
        name: "Leite em pó",
        price: 0,
      },
      {
        id: "granola",
        name: "Granola",
        price: 0,
      },
      {
        id: "pacoca",
        name: "Paçoca",
        price: 0,
      },
    ],
  },
];

export const initialCatalog: CatalogData = {
  categories,
  products,
  complementGroups: cupComplementGroups,
};
