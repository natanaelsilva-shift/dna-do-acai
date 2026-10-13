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

type CartContextValue = {
  cartItems: CartItem[];
  totalItems: number;
  totalPrice: number;
  getProductQuantity: (productId: string) => number;
  addCartLine: (line: CartLine) => void;
  incrementCartItem: (itemId: string) => void;
  decrementCartItem: (itemId: string) => void;
  clearCart: () => void;
  isCartDrawerOpen: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>({});
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
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
          quantity: (currentItem?.quantity ?? 0) + 1,
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
          quantity: currentItem.quantity + 1,
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
