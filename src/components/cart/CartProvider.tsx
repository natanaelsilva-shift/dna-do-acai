"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Cart, CartItem, CartLine } from "@/lib/cart/types";
import type { OrderItem } from "@/data/orders";
import { useStore } from "@/components/store/StoreProvider";
import { usePromotionClock } from "@/components/store/PromotionProvider";
import { calculateCustomizedPrice, calculateComboCustomizedPrice } from "@/lib/catalog/customization";
import { getEffectivePrice, isPromotionActive, PROMOTION_EXPIRED_MESSAGE } from "@/lib/catalog/pricing";

type CartContextValue = {
  cartItems: CartItem[];
  totalItems: number;
  totalPrice: number;
  getProductQuantity: (productId: string) => number;
  addCartLine: (line: CartLine) => void;
  incrementCartItem: (itemId: string) => void;
  decrementCartItem: (itemId: string) => void;
  clearCart: () => void;
  priceNotice: string;
  acknowledgePrices: () => void;
  applyQuote: (items: OrderItem[], serverTime: number) => void;
  isCartDrawerOpen: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>({});
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const { products, complementGroups } = useStore();
  const { now } = usePromotionClock();

  const cartItems = useMemo(() => Object.values(cart).map((item) => {
    const product = products.find((product) => product.id === item.productId);
    if (!product) return item;
    const unitPrice = item.comboSelections
      ? calculateComboCustomizedPrice(product, item.comboSelections, complementGroups, now)
      : item.selections
        ? calculateCustomizedPrice(product, item.selections, complementGroups, now)
        : getEffectivePrice(product, now);
    return { ...item, unitPrice };
  }), [cart, products, complementGroups, now]);
  const priceNotice = cartItems.some((item) => item.promotionApplied &&
    item.unitPrice > (cart[item.id]?.unitPrice ?? item.unitPrice)) ? PROMOTION_EXPIRED_MESSAGE : "";
  const acknowledgePrices = useCallback(() => {
    setCart(Object.fromEntries(cartItems.map((item) => [item.id, {
      ...item, promotionApplied: products.some((product) => product.id === item.productId && isPromotionActive(product, now)),
    }])));
  }, [cartItems, products, now]);
  const applyQuote = useCallback((items: OrderItem[], serverTime: number) => {
    setCart(Object.fromEntries(items.map((item) => {
      const product = products.find((product) => product.id === item.productId);
      return [item.id, { ...item, image: product?.image ?? "", imagePosition: product?.imagePosition ?? "50% 50%",
        promotionApplied: product ? isPromotionActive(product, serverTime) : false }];
    })));
  }, [products]);
  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
  const totalPrice = cartItems.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  );

  const getProductQuantity = useCallback(
    (productId: string) =>
      cartItems
        .filter((item) => item.productId === productId)
        .reduce((total, item) => total + item.quantity, 0),
    [cartItems],
  );

  // Mesma regra de antes: itens com o mesmo id (produto + assinatura das
  // escolhas) somam quantidade em vez de criar outra linha.
  const addCartLine = useCallback((line: CartLine) => {
    setCart((currentCart) => {
      const currentItem = currentCart[line.id];

      return {
        ...currentCart,
        [line.id]: {
          ...line,
          quantity: Math.min(100, (currentItem?.quantity ?? 0) + 1),
        },
      };
    });
  }, []);

  const incrementCartItem = useCallback((itemId: string) => {
    setCart((currentCart) => {
      const currentItem = currentCart[itemId];

      if (!currentItem) {
        return currentCart;
      }

      return {
        ...currentCart,
        [itemId]: {
          ...currentItem,
          quantity: Math.min(100, currentItem.quantity + 1),
        },
      };
    });
  }, []);

  const decrementCartItem = useCallback((itemId: string) => {
    setCart((currentCart) => {
      const currentItem = currentCart[itemId];

      if (!currentItem) {
        return currentCart;
      }

      if (currentItem.quantity <= 1) {
        const nextCart = { ...currentCart };
        delete nextCart[itemId];
        return nextCart;
      }

      return {
        ...currentCart,
        [itemId]: {
          ...currentItem,
          quantity: currentItem.quantity - 1,
        },
      };
    });
  }, []);

  const clearCart = useCallback(() => setCart({}), []);

  // Sacola em drawer (desktop) / bottom sheet (celular). Scroll lock, Escape e
  // foco ficam no próprio diálogo (useDialog).
  const openCartDrawer = useCallback(() => setIsCartDrawerOpen(true), []);

  const closeCartDrawer = useCallback(() => setIsCartDrawerOpen(false), []);

  const value = useMemo<CartContextValue>(
    () => ({
      cartItems,
      totalItems,
      totalPrice,
      getProductQuantity,
      addCartLine,
      incrementCartItem,
      decrementCartItem,
      clearCart,
      priceNotice,
      acknowledgePrices,
      applyQuote,
      isCartDrawerOpen,
      openCartDrawer,
      closeCartDrawer,
    }),
    [
      cartItems,
      totalItems,
      totalPrice,
      getProductQuantity,
      addCartLine,
      incrementCartItem,
      decrementCartItem,
      clearCart,
      priceNotice,
      acknowledgePrices,
      applyQuote,
      isCartDrawerOpen,
      openCartDrawer,
      closeCartDrawer,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart precisa estar dentro de <CartProvider>.");
  }

  return context;
}
