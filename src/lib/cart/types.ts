import type { OrderCustomizationLine } from "@/data/orders";
import type { SelectionState } from "@/lib/catalog/customization";

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  image: string;
  imagePosition: string;
  quantity: number;
  unitPrice: number;
  selections?: SelectionState;
  comboSelections?: SelectionState[];
  promotionApplied?: boolean;
  customization?: OrderCustomizationLine[];
};

export type Cart = Record<string, CartItem>;

export type CartLine = Omit<CartItem, "quantity">;
