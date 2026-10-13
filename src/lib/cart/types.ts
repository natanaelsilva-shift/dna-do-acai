import type { OrderCustomizationLine } from "@/data/orders";

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  image: string;
  imagePosition: string;
  quantity: number;
  unitPrice: number;
  customization?: OrderCustomizationLine[];
};

export type Cart = Record<string, CartItem>;

export type CartLine = Omit<CartItem, "quantity">;
