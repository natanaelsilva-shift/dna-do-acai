"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  CATALOG_STORAGE_KEY,
  initialCatalog,
  type ComboCup,
  type CatalogData,
  type ComplementGroup,
  type ComplementOption,
  type Product,
  withCatalogProductImages,
} from "@/data/menu";
import {
  type CreateOrderPayload,
  type DeliveryMethod,
  type OrderCustomizationLine,
  type PaymentMethod,
} from "@/data/orders";

type SelectionState = Record<string, string[]>;

type CartItem = {
  id: string;
  productId: string;
  name: string;
  image: string;
  imagePosition: string;
  quantity: number;
  unitPrice: number;
  customization?: OrderCustomizationLine[];
};

type Cart = Record<string, CartItem>;

type CheckoutForm = {
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  address: string;
  neighborhood: string;
  paymentMethod: PaymentMethod;
  changeFor: string;
  notes: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

const paymentLabels: Record<PaymentMethod, string> = {
  pix: "Pix",
  card: "Cartão na entrega",
  cash: "Dinheiro",
};

const initialCheckoutForm: CheckoutForm = {
  customerName: "",
  customerPhone: "",
  deliveryMethod: "delivery",
  address: "",
  neighborhood: "",
  paymentMethod: "pix",
  changeFor: "",
  notes: "",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);

const formatOptionPrice = (value: number) =>
  value === 0 ? "Incluso" : `+ ${formatCurrency(value)}`;

function getDefaultSelections(complementGroups: ComplementGroup[]) {
  return complementGroups.reduce<SelectionState>((selections, group) => {
    if (group.required && group.options[0]) {
      selections[group.id] = [group.options[0].id];
    } else {
      selections[group.id] = [];
    }

    return selections;
  }, {});
}

function getComplementGroupsForLimit(
  complementLimit: number | undefined,
  complementGroups: ComplementGroup[],
) {
  if (!complementLimit) {
    return complementGroups;
  }

  return complementGroups.map((group) => {
    if (group.id !== "complementos") {
      return group;
    }

    return {
      ...group,
      description: `Escolha até ${complementLimit} complementos inclusos.`,
      maxSelections: complementLimit,
    };
  });
}

function getComplementGroupsForProduct(
  product: Product | null,
  complementGroups: ComplementGroup[],
) {
  return getComplementGroupsForLimit(product?.complementLimit, complementGroups);
}

function getCustomizableComboCups(product: Product | null) {
  return product?.comboCups?.filter((cup) => !cup.pure) ?? [];
}

function getPureComboCups(product: Product | null) {
  return product?.comboCups?.filter((cup) => cup.pure) ?? [];
}

function isComboProduct(product: Product | null) {
  return Boolean(product?.comboCups?.length);
}

function getSelectedOptions(group: ComplementGroup, selections: SelectionState) {
  const selectedIds = selections[group.id] ?? [];

  return group.options.filter((option) => selectedIds.includes(option.id));
}

function calculateCustomizedPrice(
  product: Product,
  selections: SelectionState,
  complementGroups: ComplementGroup[],
) {
  return complementGroups.reduce((total, group) => {
    const selectedOptions = getSelectedOptions(group, selections);
    const groupTotal = selectedOptions.reduce(
      (subtotal, option) => subtotal + option.price,
      0,
    );

    return total + groupTotal;
  }, product.price);
}

function buildCustomizationLines(
  selections: SelectionState,
  complementGroups: ComplementGroup[],
) {
  return complementGroups
    .map<OrderCustomizationLine | null>((group) => {
      const selectedOptions = getSelectedOptions(group, selections);

      if (selectedOptions.length === 0) {
        return null;
      }

      return {
        groupTitle: group.title,
        options: selectedOptions.map((option) => option.name).join(", "),
        optionsList: selectedOptions.map((option) => option.name),
        price: selectedOptions.reduce((total, option) => total + option.price, 0),
      };
    })
    .filter((line): line is OrderCustomizationLine => Boolean(line));
}

function buildCustomizedItemId(
  productId: string,
  selections: SelectionState,
  complementGroups: ComplementGroup[],
) {
  const signature = complementGroups
    .map((group) => {
      const selectedIds = [...(selections[group.id] ?? [])].sort().join(",");
      return `${group.id}:${selectedIds}`;
    })
    .join("|");

  return `${productId}|${signature}`;
}

function buildComboCustomizedItemId(
  productId: string,
  comboCups: ComboCup[],
  comboSelections: SelectionState[],
) {
  const signature = comboCups
    .map((cup, index) => {
      const selections = comboSelections[index] ?? {};
      const selectedIds = Object.values(selections)
        .flat()
        .sort()
        .join(",");

      return `${cup.id}:${selectedIds}`;
    })
    .join("|");

  return `${productId}|${signature}`;
}

function buildComboCustomizationLines(
  product: Product,
  comboSelections: SelectionState[],
  complementGroups: ComplementGroup[],
): OrderCustomizationLine[] {
  let customizableCupIndex = 0;

  return (product.comboCups ?? []).map((cup) => {
    if (cup.pure) {
      return {
        groupTitle: cup.label,
        options: "Açaí puro, sem complementos.",
        optionsList: [],
        price: 0,
      };
    }

    const cupSelections = comboSelections[customizableCupIndex] ?? {};
    const cupComplementGroups = getComplementGroupsForLimit(
      cup.complementLimit,
      complementGroups,
    );
    const selectedOptions = cupComplementGroups.flatMap((group) =>
      getSelectedOptions(group, cupSelections),
    );
    customizableCupIndex += 1;

    return {
      groupTitle: cup.label,
      options:
        selectedOptions.length > 0
          ? selectedOptions.map((option) => option.name).join(", ")
          : "Sem complementos",
      optionsList: selectedOptions.map((option) => option.name),
      price: selectedOptions.reduce((total, option) => total + option.price, 0),
    };
  });
}

function subscribeCatalogStore(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("dna-catalog-updated", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("dna-catalog-updated", onStoreChange);
  };
}

function getCatalogSnapshot() {
  return window.localStorage.getItem(CATALOG_STORAGE_KEY) ?? "";
}

function getCatalogServerSnapshot() {
  return "";
}

function parseCatalogSnapshot(snapshot: string) {
  if (!snapshot) {
    return initialCatalog;
  }

  try {
    return withCatalogProductImages(JSON.parse(snapshot) as CatalogData);
  } catch {
    return initialCatalog;
  }
}

export function MenuCatalog() {
  const catalogSnapshot = useSyncExternalStore(
    subscribeCatalogStore,
    getCatalogSnapshot,
    getCatalogServerSnapshot,
  );
  const catalog = useMemo(
    () => parseCatalogSnapshot(catalogSnapshot),
    [catalogSnapshot],
  );
  const [activeCategory, setActiveCategory] = useState("todos");
  const [cart, setCart] = useState<Cart>({});
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [selections, setSelections] = useState<SelectionState>(() =>
    getDefaultSelections(initialCatalog.complementGroups),
  );
  const [comboStepIndex, setComboStepIndex] = useState(0);
  const [comboSelections, setComboSelections] = useState<SelectionState[]>([]);
  const [customizationError, setCustomizationError] = useState("");
  const [checkout, setCheckout] = useState<CheckoutForm>(initialCheckoutForm);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  const { categories, complementGroups, products } = catalog;
  const cartItems = Object.values(cart);
  const customizableComboCups = useMemo(
    () => getCustomizableComboCups(customizingProduct),
    [customizingProduct],
  );
  const activeComboCup = customizableComboCups[comboStepIndex];
  const activeComplementGroups = useMemo(
    () =>
      getComplementGroupsForLimit(
        activeComboCup?.complementLimit ?? customizingProduct?.complementLimit,
        complementGroups,
      ),
    [activeComboCup?.complementLimit, complementGroups, customizingProduct],
  );
  const pureComboCups = useMemo(
    () => getPureComboCups(customizingProduct),
    [customizingProduct],
  );

  const visibleProducts = useMemo(() => {
    if (activeCategory === "todos") {
      return products;
    }

    return products.filter((product) => product.categoryId === activeCategory);
  }, [activeCategory, products]);

  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
  const totalPrice = cartItems.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  );
  const orderTotal = totalPrice;
  const canCheckout =
    totalItems > 0 &&
    checkout.customerName.trim().length > 0 &&
    checkout.customerPhone.trim().length > 0 &&
    (checkout.deliveryMethod === "pickup" || checkout.address.trim().length > 0);

  const customizedPrice = customizingProduct
    ? calculateCustomizedPrice(customizingProduct, selections, activeComplementGroups)
    : 0;

  const isCustomizationValid = activeComplementGroups.every((group) => {
    if (!group.required) {
      return true;
    }

    return (selections[group.id] ?? []).length >= (group.minSelections ?? 1);
  });

  useEffect(() => {
    if (!isCartDrawerOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isCartDrawerOpen]);

  useEffect(() => {
    if (!isCartDrawerOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCartDrawerOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCartDrawerOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");

    function handleBreakpointChange(event: MediaQueryListEvent) {
      if (event.matches) {
        setIsCartDrawerOpen(false);
      }
    }

    desktopQuery.addEventListener("change", handleBreakpointChange);

    return () => desktopQuery.removeEventListener("change", handleBreakpointChange);
  }, []);

  function getProductQuantity(productId: string) {
    return cartItems
      .filter((item) => item.productId === productId)
      .reduce((total, item) => total + item.quantity, 0);
  }

  function openCustomizer(product: Product) {
    const comboCups = getCustomizableComboCups(product);
    const firstComboCup = comboCups[0];
    const productComplementGroups = firstComboCup
      ? getComplementGroupsForLimit(firstComboCup.complementLimit, complementGroups)
      : getComplementGroupsForProduct(product, complementGroups);

    setCustomizingProduct(product);
    setComboStepIndex(0);
    setComboSelections(comboCups.map(() => getDefaultSelections(complementGroups)));
    setCustomizationError("");
    setSelections(getDefaultSelections(productComplementGroups));
  }

  function addSimpleProduct(product: Product) {
    if (product.customizable) {
      openCustomizer(product);
      return;
    }

    setCart((currentCart) => {
      const currentItem = currentCart[product.id];

      return {
        ...currentCart,
        [product.id]: {
          id: product.id,
          productId: product.id,
          name: product.name,
          image: product.image,
          imagePosition: product.imagePosition,
          quantity: (currentItem?.quantity ?? 0) + 1,
          unitPrice: product.price,
        },
      };
    });
  }

  function confirmCustomization() {
    if (!customizingProduct || !isCustomizationValid) {
      return;
    }

    if (isComboProduct(customizingProduct)) {
      const nextComboSelections = [...comboSelections];
      nextComboSelections[comboStepIndex] = selections;

      if (comboStepIndex < customizableComboCups.length - 1) {
        const nextStepIndex = comboStepIndex + 1;
        const nextCup = customizableComboCups[nextStepIndex];

        setComboSelections(nextComboSelections);
        setComboStepIndex(nextStepIndex);
        setSelections(
          nextComboSelections[nextStepIndex] ??
            getDefaultSelections(
              getComplementGroupsForLimit(nextCup?.complementLimit, complementGroups),
            ),
        );
        setCustomizationError("");
        return;
      }

      const itemId = buildComboCustomizedItemId(
        customizingProduct.id,
        customizableComboCups,
        nextComboSelections,
      );
      const customization = buildComboCustomizationLines(
        customizingProduct,
        nextComboSelections,
        complementGroups,
      );

      setCart((currentCart) => {
        const currentItem = currentCart[itemId];

        return {
          ...currentCart,
          [itemId]: {
            id: itemId,
            productId: customizingProduct.id,
            name: customizingProduct.name,
            image: customizingProduct.image,
            imagePosition: customizingProduct.imagePosition,
            quantity: (currentItem?.quantity ?? 0) + 1,
            unitPrice: customizingProduct.price,
            customization,
          },
        };
      });

      setCustomizingProduct(null);
      setComboSelections([]);
      setComboStepIndex(0);
      setCustomizationError("");
      return;
    }

    const itemId = buildCustomizedItemId(
      customizingProduct.id,
      selections,
      activeComplementGroups,
    );
    const unitPrice = calculateCustomizedPrice(
      customizingProduct,
      selections,
      activeComplementGroups,
    );
    const customization = buildCustomizationLines(selections, activeComplementGroups);

    setCart((currentCart) => {
      const currentItem = currentCart[itemId];

      return {
        ...currentCart,
        [itemId]: {
          id: itemId,
          productId: customizingProduct.id,
          name: customizingProduct.name,
          image: customizingProduct.image,
          imagePosition: customizingProduct.imagePosition,
          quantity: (currentItem?.quantity ?? 0) + 1,
          unitPrice,
          customization,
        },
      };
    });

    setCustomizingProduct(null);
    setCustomizationError("");
  }

  function goToPreviousComboCup() {
    if (!customizingProduct || comboStepIndex === 0) {
      return;
    }

    const previousStepIndex = comboStepIndex - 1;
    const nextComboSelections = [...comboSelections];
    nextComboSelections[comboStepIndex] = selections;

    setComboSelections(nextComboSelections);
    setComboStepIndex(previousStepIndex);
    setSelections(
      nextComboSelections[previousStepIndex] ??
        getDefaultSelections(
          getComplementGroupsForLimit(
            customizableComboCups[previousStepIndex]?.complementLimit,
            complementGroups,
          ),
        ),
    );
    setCustomizationError("");
  }

  function resetCurrentCustomization() {
    const currentComplementGroups = isComboProduct(customizingProduct)
      ? getComplementGroupsForLimit(activeComboCup?.complementLimit, complementGroups)
      : activeComplementGroups;

    setSelections(getDefaultSelections(currentComplementGroups));
    setCustomizationError("");
  }

  function closeCustomizer() {
    setCustomizingProduct(null);
    setComboSelections([]);
    setComboStepIndex(0);
    setCustomizationError("");
  }

  function buildOrderPayload(): CreateOrderPayload {
    return {
      customerName: checkout.customerName,
      customerPhone: checkout.customerPhone,
      deliveryMethod: checkout.deliveryMethod,
      address: checkout.address,
      neighborhood: checkout.neighborhood,
      paymentMethod: checkout.paymentMethod,
      paymentLabel: paymentLabels[checkout.paymentMethod],
      changeFor: checkout.changeFor,
      notes: checkout.notes,
      items: cartItems.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.quantity,
        customization: item.customization ?? [],
      })),
      subtotal: totalPrice,
      deliveryFee: null,
      total: orderTotal,
    };
  }

  async function submitOrder() {
    if (!canCheckout || submitState === "submitting") {
      return;
    }

    setSubmitState("submitting");
    setSubmitMessage("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildOrderPayload()),
      });
      const responseBody = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(responseBody.error ?? "Não foi possível enviar o pedido.");
      }

      setCart({});
      setCheckout(initialCheckoutForm);
      setSubmitState("success");
      setSubmitMessage(
        "Pedido enviado com sucesso! Em breve entraremos em contato pelo WhatsApp.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      setSubmitState("error");
      setSubmitMessage(
        message.includes("Banco de dados não configurado")
          ? "Não foi possível enviar o pedido porque o banco de dados ainda não foi configurado."
          : message || "Não foi possível enviar o pedido. Tente novamente.",
      );
    }
  }

  function incrementCartItem(itemId: string) {
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
  }

  function decrementCartItem(itemId: string) {
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
  }

  function decrementSimpleProduct(productId: string) {
    decrementCartItem(productId);
  }

  function toggleOption(group: ComplementGroup, optionId: string) {
    setSelections((currentSelections) => {
      const selectedIds = currentSelections[group.id] ?? [];

      if (group.type === "single") {
        return {
          ...currentSelections,
          [group.id]: [optionId],
        };
      }

      const isSelected = selectedIds.includes(optionId);

      if (isSelected) {
        setCustomizationError("");
        return {
          ...currentSelections,
          [group.id]: selectedIds.filter((selectedId) => selectedId !== optionId),
        };
      }

      if (
        group.maxSelections !== undefined &&
        selectedIds.length >= group.maxSelections
      ) {
        setCustomizationError(
          `Escolha no máximo ${group.maxSelections} complementos por copo.`,
        );
        return currentSelections;
      }

      setCustomizationError("");
      return {
        ...currentSelections,
        [group.id]: [...selectedIds, optionId],
      };
    });
  }

  function updateCheckoutField<Key extends keyof CheckoutForm>(
    field: Key,
    value: CheckoutForm[Key],
  ) {
    setCheckout((currentCheckout) => ({
      ...currentCheckout,
      [field]: value,
    }));
  }

  function openCartDrawer() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      return;
    }

    setIsCartDrawerOpen(true);
  }

  return (
    <section
      id="cardapio"
      className="bg-[#fffaf0] px-4 py-10 pb-28 md:px-8 lg:py-14"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 border-b border-[#d7a948]/35 pb-7 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4b164c] md:text-sm md:tracking-[0.18em]">
              Cardápio digital
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[#103d2c] sm:text-3xl md:text-4xl">
              Monte seu pedido DNA
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#526354]">
              Escolha entre Monte Seu Açaí, Açaí Puro e Combos. Nos copos
              personalizados, selecione os complementos dentro do limite de cada
              tamanho.
            </p>
          </div>

          <CartTotal
            totalItems={totalItems}
            totalPrice={orderTotal}
            onOpen={openCartDrawer}
          />
        </div>

        <div className="sticky top-0 z-10 -mx-4 mt-6 border-y border-[#d7a948]/25 bg-[#fffaf0]/95 px-4 py-3 backdrop-blur md:top-0 md:-mx-8 md:px-8">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1">
            <CategoryButton
              active={activeCategory === "todos"}
              count={products.length}
              label="Todos"
              onClick={() => setActiveCategory("todos")}
            />
            {categories.map((category) => (
              <CategoryButton
                key={category.id}
                active={activeCategory === category.id}
                count={
                  products.filter((product) => product.categoryId === category.id).length
                }
                label={category.name}
                onClick={() => setActiveCategory(category.id)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-8">
            {activeCategory === "todos" ? (
              categories.map((category) => {
                const categoryProducts = products.filter(
                  (product) => product.categoryId === category.id,
                );

                return (
                  <ProductSection
                    key={category.id}
                    title={category.name}
                    description={category.description}
                    products={categoryProducts}
                    getProductQuantity={getProductQuantity}
                    onAdd={addSimpleProduct}
                    onCustomize={openCustomizer}
                    onRemove={decrementSimpleProduct}
                  />
                );
              })
            ) : (
              <ProductSection
                title={
                  categories.find((category) => category.id === activeCategory)?.name ??
                  "Produtos"
                }
                description={
                  categories.find((category) => category.id === activeCategory)
                    ?.description ?? "Seleção da casa."
                }
                products={visibleProducts}
                getProductQuantity={getProductQuantity}
                onAdd={addSimpleProduct}
                onCustomize={openCustomizer}
                onRemove={decrementSimpleProduct}
              />
            )}
          </div>

          <OrderSummary
            cartItems={cartItems}
            checkout={checkout}
            canCheckout={canCheckout}
            subtotal={totalPrice}
            submitMessage={submitMessage}
            submitState={submitState}
            totalItems={totalItems}
            onIncrement={incrementCartItem}
            onDecrement={decrementCartItem}
            onCheckoutChange={updateCheckoutField}
            onSubmit={submitOrder}
          />
        </div>
      </div>

      <MobileCartDock
        totalItems={totalItems}
        totalPrice={orderTotal}
        onOpen={openCartDrawer}
      />

      {isCartDrawerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#16221a]/60 pt-8 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Carrinho"
          onClick={() => setIsCartDrawerOpen(false)}
        >
          <div className="w-full" onClick={(event) => event.stopPropagation()}>
            <OrderSummary
              variant="drawer"
              cartItems={cartItems}
              checkout={checkout}
              canCheckout={canCheckout}
              subtotal={totalPrice}
              submitMessage={submitMessage}
              submitState={submitState}
              totalItems={totalItems}
              onClose={() => setIsCartDrawerOpen(false)}
              onIncrement={incrementCartItem}
              onDecrement={decrementCartItem}
              onCheckoutChange={updateCheckoutField}
              onSubmit={submitOrder}
            />
          </div>
        </div>
      ) : null}

      {customizingProduct ? (
        <CupCustomizer
          product={customizingProduct}
          activeComboCup={activeComboCup}
          currentStep={comboStepIndex}
          errorMessage={customizationError}
          isCombo={isComboProduct(customizingProduct)}
          selections={selections}
          complementGroups={activeComplementGroups}
          pureComboCups={pureComboCups}
          totalSteps={customizableComboCups.length}
          totalPrice={customizedPrice}
          isValid={isCustomizationValid}
          onBack={comboStepIndex > 0 ? goToPreviousComboCup : undefined}
          onClose={closeCustomizer}
          onConfirm={confirmCustomization}
          onReset={resetCurrentCustomization}
          onToggleOption={toggleOption}
        />
      ) : null}
    </section>
  );
}

function CartTotal({
  onOpen,
  totalItems,
  totalPrice,
}: {
  onOpen?: () => void;
  totalItems: number;
  totalPrice: number;
}) {
  const content = (
    <>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4b164c]">
          Sacola
        </p>
        <p className="text-sm font-semibold text-[#103d2c]">
          {totalItems} {totalItems === 1 ? "item" : "itens"}
        </p>
      </div>
      <p className="text-lg font-semibold text-[#4b164c]">
        {formatCurrency(totalPrice)}
      </p>
    </>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 w-full items-center justify-between gap-4 border border-[#d7a948]/45 bg-white px-4 text-left transition hover:border-[#d7a948] hover:bg-[#fff7e3] md:w-auto"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border border-[#d7a948]/45 bg-white px-4">
      {content}
    </div>
  );
}

function MobileCartDock({
  onOpen,
  totalItems,
  totalPrice,
}: {
  onOpen: () => void;
  totalItems: number;
  totalPrice: number;
}) {
  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d7a948]/35 bg-[#fffaf0]/96 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-14px_34px_rgba(16,61,44,0.14)] backdrop-blur lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 w-full items-center justify-between gap-4 bg-[#103d2c] px-4 text-left text-white shadow-[0_12px_28px_rgba(16,61,44,0.22)] transition active:translate-y-px"
      >
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#d7a948]">
            Sacola
          </span>
          <span className="block text-sm font-semibold">
            {totalItems} {totalItems === 1 ? "item" : "itens"}
          </span>
        </span>
        <span className="text-base font-semibold">
          {formatCurrency(totalPrice)}
        </span>
      </button>
    </div>
  );
}

function CategoryButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 shrink-0 items-center gap-3 border px-4 text-sm font-semibold transition ${
        active
          ? "border-[#103d2c] bg-[#103d2c] text-[#f8e8b5]"
          : "border-[#d7a948]/35 bg-white text-[#103d2c] hover:border-[#d7a948] hover:text-[#4b164c]"
      }`}
    >
      <span>{label}</span>
      <span
        className={`grid size-6 place-items-center text-xs ${
          active ? "bg-[#d7a948] text-[#103d2c]" : "bg-[#f3ead2] text-[#4b164c]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ProductSection({
  title,
  description,
  products: sectionProducts,
  getProductQuantity,
  onAdd,
  onCustomize,
  onRemove,
}: {
  title: string;
  description: string;
  products: Product[];
  getProductQuantity: (productId: string) => number;
  onAdd: (product: Product) => void;
  onCustomize: (product: Product) => void;
  onRemove: (productId: string) => void;
}) {
  return (
    <section>
      <div className="mb-4">
        <h3 className="text-2xl font-semibold text-[#103d2c]">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-[#526354]">{description}</p>
        ) : null}
      </div>

      <div className="grid gap-3">
        {sectionProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            quantity={getProductQuantity(product.id)}
            onAdd={() => onAdd(product)}
            onCustomize={() => onCustomize(product)}
            onRemove={() => onRemove(product.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ProductCard({
  product,
  quantity,
  onAdd,
  onCustomize,
  onRemove,
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onCustomize: () => void;
  onRemove: () => void;
}) {
  const metaItems = [product.serves, product.preparationTime].filter(Boolean);
  const hasBadges = product.tag || product.customizable || metaItems.length > 0;
  const productIsCombo = isComboProduct(product);
  const showProductImage = Boolean(product.image) && !productIsCombo;

  return (
    <article
      className={`grid min-h-40 grid-cols-1 gap-3 rounded-[8px] border border-[#d7a948]/30 bg-white p-3 shadow-[0_12px_34px_rgba(16,61,44,0.06)] transition hover:border-[#d7a948] hover:shadow-[0_18px_46px_rgba(16,61,44,0.12)] sm:gap-4 sm:p-4 ${
        showProductImage
          ? "min-[430px]:grid-cols-[minmax(0,1fr)_136px] md:grid-cols-[minmax(0,1fr)_148px]"
          : ""
      }`}
    >
      <div className="flex min-w-0 flex-col">
        {hasBadges ? (
          <div className="flex flex-wrap items-center gap-2">
            {product.tag ? (
              <span className="bg-[#4b164c] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#f8e8b5]">
                {product.tag}
              </span>
            ) : null}
            {product.customizable ? (
              <span className="border border-[#d7a948]/45 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
                Personalizável
              </span>
            ) : null}
            {metaItems.length > 0 ? (
              <span className="text-xs font-medium text-[#526354]">
                {metaItems.join(" / ")}
              </span>
            ) : null}
          </div>
        ) : null}

        <h4 className="mt-3 text-base font-semibold leading-snug text-[#103d2c] sm:text-lg">
          {product.name}
        </h4>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#526354]">
          {product.description}
        </p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
          <div>
            {product.originalPrice ? (
              <p className="text-xs font-medium text-[#8a938b] line-through">
                {formatCurrency(product.originalPrice)}
              </p>
            ) : null}
            <p className="text-lg font-semibold text-[#4b164c]">
              {formatCurrency(product.price)}
            </p>
            {product.customizable && quantity > 0 ? (
              <p className="mt-1 text-xs font-semibold text-[#103d2c]">
                {quantity}{" "}
                {productIsCombo
                  ? quantity === 1
                    ? "combo"
                    : "combos"
                  : quantity === 1
                    ? "copo"
                    : "copos"}{" "}
                na sacola
              </p>
            ) : null}
          </div>

          {product.customizable ? (
            <button
              type="button"
              onClick={onCustomize}
              className="min-h-11 border border-[#103d2c] bg-[#103d2c] px-4 text-sm font-semibold text-white transition hover:border-[#d7a948] hover:bg-[#d7a948] hover:text-[#103d2c]"
            >
              {productIsCombo ? "Adicionar" : "Personalizar"}
            </button>
          ) : quantity > 0 ? (
            <div className="flex min-h-11 items-center border border-[#103d2c]">
              <button
                type="button"
                onClick={onRemove}
                className="grid size-11 place-items-center text-xl font-semibold text-[#103d2c] transition hover:bg-[#f3ead2]"
                aria-label={`Remover ${product.name}`}
              >
                -
              </button>
              <span className="grid min-w-10 place-items-center text-sm font-semibold text-[#103d2c]">
                {quantity}
              </span>
              <button
                type="button"
                onClick={onAdd}
                className="grid size-11 place-items-center bg-[#103d2c] text-xl font-semibold text-white transition hover:bg-[#4b164c]"
                aria-label={`Adicionar mais ${product.name}`}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="grid size-11 place-items-center bg-[#103d2c] text-xl font-semibold text-white transition hover:bg-[#4b164c]"
              aria-label={`Adicionar ${product.name}`}
            >
              +
            </button>
          )}
        </div>
      </div>

      {showProductImage ? (
        <div className="relative order-first min-h-36 overflow-hidden rounded-[8px] bg-[#103d2c] min-[430px]:order-none min-[430px]:min-h-full">
          <CatalogImage
            src={product.image}
            alt={product.name}
            position={product.imagePosition}
          />
        </div>
      ) : null}
    </article>
  );
}

function CustomizationSummary({
  customization,
}: {
  customization: OrderCustomizationLine[];
}) {
  return (
    <div className="mt-3 space-y-3">
      {customization.map((line) => (
        <div key={`${line.groupTitle}-${line.options}`}>
          <p className="text-xs font-semibold leading-5 text-[#103d2c]">
            {line.groupTitle}:
          </p>
          {line.optionsList && line.optionsList.length > 0 ? (
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5 text-[#526354]">
              {line.optionsList.map((option) => (
                <li key={`${line.groupTitle}-${option}`}>{option}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs leading-5 text-[#526354]">{line.options}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function OrderSummary({
  cartItems,
  checkout,
  canCheckout,
  onClose,
  subtotal,
  submitMessage,
  submitState,
  totalItems,
  variant = "sidebar",
  onIncrement,
  onDecrement,
  onCheckoutChange,
  onSubmit,
}: {
  cartItems: CartItem[];
  checkout: CheckoutForm;
  canCheckout: boolean;
  onClose?: () => void;
  subtotal: number;
  submitMessage: string;
  submitState: SubmitState;
  totalItems: number;
  variant?: "sidebar" | "drawer";
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
  onCheckoutChange: <Key extends keyof CheckoutForm>(
    field: Key,
    value: CheckoutForm[Key],
  ) => void;
  onSubmit: () => void;
}) {
  const isDrawer = variant === "drawer";

  return (
    <aside className={isDrawer ? "h-full" : "hidden lg:block"}>
      <div
        className={
          isDrawer
            ? "flex max-h-[min(88dvh,760px)] w-full flex-col overflow-hidden rounded-t-[18px] border border-[#d7a948]/40 bg-white shadow-[0_-24px_70px_rgba(0,0,0,0.28)]"
            : "sticky top-24 rounded-[8px] border border-[#d7a948]/40 bg-white p-5 shadow-[0_18px_50px_rgba(16,61,44,0.08)]"
        }
      >
        <div
          className={
            isDrawer
              ? "flex shrink-0 items-start justify-between gap-4 border-b border-[#d7a948]/30 px-4 py-4"
              : ""
          }
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#4b164c]">
              Carrinho
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#103d2c] sm:text-2xl">
              Finalizar pedido
            </h3>
          </div>

          {isDrawer ? (
            <button
              type="button"
              onClick={onClose}
              className="grid size-11 shrink-0 place-items-center border border-[#103d2c]/25 text-2xl leading-none text-[#103d2c] transition hover:bg-[#f3ead2]"
              aria-label="Fechar carrinho"
            >
              ×
            </button>
          ) : null}
        </div>

        <div
          className={
            isDrawer
              ? "min-h-0 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4"
              : ""
          }
        >

        {totalItems === 0 ? (
          <p className="mt-5 text-sm leading-6 text-[#526354]">
            Escolha um produto ou personalize um copo para iniciar a sacola.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="border-b border-[#d7a948]/20 pb-4 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  {item.image ? (
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-[8px] bg-[#f3ead2]">
                      <CatalogImage
                        src={item.image}
                        alt={item.name}
                        position={item.imagePosition}
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#103d2c]">{item.name}</p>
                    <p className="mt-1 text-xs text-[#526354]">
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-[#4b164c]">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </p>
                </div>

                {item.customization ? (
                  <CustomizationSummary customization={item.customization} />
                ) : null}

                <div className="mt-3 flex min-h-11 w-fit items-center border border-[#103d2c]">
                  <button
                    type="button"
                    onClick={() => onDecrement(item.id)}
                    className="grid size-11 place-items-center text-lg font-semibold text-[#103d2c] transition hover:bg-[#f3ead2]"
                    aria-label={`Diminuir ${item.name}`}
                  >
                    -
                  </button>
                  <span className="grid min-w-10 place-items-center text-sm font-semibold text-[#103d2c]">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onIncrement(item.id)}
                    className="grid size-11 place-items-center bg-[#103d2c] text-lg font-semibold text-white transition hover:bg-[#4b164c]"
                    aria-label={`Aumentar ${item.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 border-t border-[#103d2c]/15 pt-5">
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
                Nome
              </span>
              <input
                value={checkout.customerName}
                onChange={(event) =>
                  onCheckoutChange("customerName", event.target.value)
                }
                className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
                placeholder="Seu nome"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
                Telefone
              </span>
              <input
                value={checkout.customerPhone}
                onChange={(event) =>
                  onCheckoutChange("customerPhone", event.target.value)
                }
                className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
                placeholder="(00) 00000-0000"
              />
            </label>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
              Tipo de pedido
            </p>
            <div className="mt-2 grid grid-cols-2 border border-[#d7a948]/45">
              {(["delivery", "pickup"] as DeliveryMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => onCheckoutChange("deliveryMethod", method)}
                  className={`min-h-11 px-3 text-sm font-semibold transition ${
                    checkout.deliveryMethod === method
                      ? "bg-[#103d2c] text-white"
                      : "bg-white text-[#103d2c] hover:bg-[#f3ead2]"
                  }`}
                >
                  {method === "delivery" ? "Entrega" : "Retirada"}
                </button>
              ))}
            </div>
          </div>

          {checkout.deliveryMethod === "delivery" ? (
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
                  Endereço
                </span>
                <input
                  value={checkout.address}
                  onChange={(event) => onCheckoutChange("address", event.target.value)}
                  className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
                  placeholder="Rua, número e complemento"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
                  Bairro
                </span>
                <input
                  value={checkout.neighborhood}
                  onChange={(event) =>
                    onCheckoutChange("neighborhood", event.target.value)
                  }
                  className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
                  placeholder="Seu bairro"
                />
              </label>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
              Pagamento
            </p>
            <div className="mt-2 grid gap-2">
              {(["pix", "card", "cash"] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => onCheckoutChange("paymentMethod", method)}
                  className={`min-h-11 border px-3 text-left text-sm font-semibold transition ${
                    checkout.paymentMethod === method
                      ? "border-[#103d2c] bg-[#103d2c] text-white"
                      : "border-[#d7a948]/45 bg-white text-[#103d2c] hover:bg-[#f3ead2]"
                  }`}
                >
                  {paymentLabels[method]}
                </button>
              ))}
            </div>
          </div>

          {checkout.paymentMethod === "cash" ? (
            <label className="mt-4 grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
                Troco
              </span>
              <input
                value={checkout.changeFor}
                onChange={(event) => onCheckoutChange("changeFor", event.target.value)}
                className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
                placeholder="Troco para quanto?"
              />
            </label>
          ) : null}

          <label className="mt-4 grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
              Observações
            </span>
            <textarea
              value={checkout.notes}
              onChange={(event) => onCheckoutChange("notes", event.target.value)}
              className="min-h-20 resize-none border border-[#d7a948]/45 bg-[#fffaf0] px-3 py-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
              placeholder="Ex.: sem granola, retirar no balcão às 18h"
            />
          </label>
        </div>

        <div className="mt-5 space-y-2 border-t border-[#103d2c]/15 pt-4">
          <div className="flex items-center justify-between text-sm text-[#526354]">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-[#526354]">
            <span>Taxa de entrega</span>
            <span>A combinar</span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm font-semibold text-[#103d2c]">Total</p>
            <p className="text-xl font-semibold text-[#4b164c]">
              {formatCurrency(subtotal)}
            </p>
          </div>
        </div>

        {submitMessage ? (
          <p
            className={`mt-5 rounded-[8px] border px-3 py-3 text-sm leading-6 ${
              submitState === "success"
                ? "border-[#103d2c]/25 bg-[#e9f4ee] text-[#103d2c]"
                : "border-[#8a1f2d]/25 bg-[#fff0f2] text-[#8a1f2d]"
            }`}
          >
            {submitMessage}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canCheckout || submitState === "submitting"}
          onClick={onSubmit}
          className="mt-5 min-h-12 w-full border border-[#103d2c] bg-[#103d2c] px-4 text-sm font-semibold text-white transition enabled:hover:border-[#d7a948] enabled:hover:bg-[#d7a948] enabled:hover:text-[#103d2c] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {submitState === "submitting"
            ? "Enviando pedido..."
            : canCheckout
              ? "Finalizar pedido"
              : "Preencha os dados"}
        </button>

        </div>
      </div>
    </aside>
  );
}

function CupCustomizer({
  product,
  activeComboCup,
  currentStep,
  errorMessage,
  isCombo,
  selections,
  complementGroups,
  pureComboCups,
  totalSteps,
  totalPrice,
  isValid,
  onBack,
  onClose,
  onConfirm,
  onReset,
  onToggleOption,
}: {
  product: Product;
  activeComboCup?: ComboCup;
  currentStep: number;
  errorMessage: string;
  isCombo: boolean;
  selections: SelectionState;
  complementGroups: ComplementGroup[];
  pureComboCups: ComboCup[];
  totalSteps: number;
  totalPrice: number;
  isValid: boolean;
  onBack?: () => void;
  onClose: () => void;
  onConfirm: () => void;
  onReset: () => void;
  onToggleOption: (group: ComplementGroup, optionId: string) => void;
}) {
  const isLastStep = !isCombo || currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-[#16221a]/70 px-3 pt-8 backdrop-blur-sm sm:place-items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customizer-title"
        className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-[18px] bg-[#fffaf0] shadow-[0_28px_90px_rgba(0,0,0,0.28)] sm:max-h-[92vh] sm:rounded-[8px]"
      >
        <div className="grid gap-4 border-b border-[#d7a948]/35 bg-white p-4 sm:grid-cols-[1fr_140px] sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4b164c] sm:tracking-[0.16em]">
              {isCombo ? product.name : "Personalize seu copo"}
            </p>
            <h3
              id="customizer-title"
              className="mt-2 text-xl font-semibold leading-tight text-[#103d2c] sm:text-2xl"
            >
              {isCombo && activeComboCup
                ? `Personalize o ${activeComboCup.label}`
                : product.name}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#526354]">
              {isCombo
                ? `Etapa ${currentStep + 1} de ${totalSteps}. Escolha os complementos deste copo sem misturar com os demais.`
                : "Monte do seu jeito escolhendo os complementos inclusos deste copo."}
            </p>
            {isCombo && pureComboCups.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {pureComboCups.map((cup) => (
                  <p
                    key={cup.id}
                    className="w-fit rounded-[8px] border border-[#d7a948]/35 bg-[#fffaf0] px-3 py-2 text-xs font-semibold text-[#4b164c]"
                  >
                    {cup.label}: Açaí puro, sem complementos.
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          {product.image ? (
            <div className="relative hidden min-h-32 overflow-hidden rounded-[8px] bg-[#103d2c] sm:block">
              <CatalogImage
                src={product.image}
                alt={product.name}
                position={product.imagePosition}
              />
            </div>
          ) : null}
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          <div className="space-y-5">
            {complementGroups.map((group) => (
              <ComplementGroupSelector
                key={group.id}
                group={group}
                selectedIds={selections[group.id] ?? []}
                onToggle={(optionId) => onToggleOption(group, optionId)}
              />
            ))}
            {errorMessage ? (
              <p className="rounded-[8px] border border-[#8a1f2d]/30 bg-[#fff0f2] px-3 py-3 text-sm text-[#8a1f2d]">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[#d7a948]/35 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4b164c]">
                {isCombo ? "Total do combo" : "Total do copo"}
              </p>
              <p className="text-2xl font-semibold text-[#103d2c]">
                {formatCurrency(totalPrice)}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="min-h-11 border border-[#103d2c]/30 px-4 text-sm font-semibold text-[#103d2c] transition hover:bg-[#f3ead2]"
                >
                  Voltar
                </button>
              ) : null}
              <button
                type="button"
                onClick={onReset}
                className="min-h-11 border border-[#d7a948]/60 px-4 text-sm font-semibold text-[#4b164c] transition hover:bg-[#f3ead2]"
              >
                Limpar escolhas
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 border border-[#103d2c]/30 px-4 text-sm font-semibold text-[#103d2c] transition hover:bg-[#f3ead2]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!isValid}
                onClick={onConfirm}
                className="min-h-11 border border-[#103d2c] bg-[#103d2c] px-5 text-sm font-semibold text-white transition enabled:hover:border-[#d7a948] enabled:hover:bg-[#d7a948] enabled:hover:text-[#103d2c] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isCombo ? (isLastStep ? "Adicionar ao carrinho" : "Continuar") : "Adicionar copo"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplementGroupSelector({
  group,
  selectedIds,
  onToggle,
}: {
  group: ComplementGroup;
  selectedIds: string[];
  onToggle: (optionId: string) => void;
}) {
  return (
    <section className="rounded-[8px] border border-[#d7a948]/30 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-base font-semibold text-[#103d2c]">{group.title}</h4>
          <p className="mt-1 text-sm text-[#526354]">{group.description}</p>
        </div>
        <span className="w-fit bg-[#f3ead2] px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
          {group.required
            ? "Obrigatório"
            : group.maxSelections
              ? `Até ${group.maxSelections}`
              : "Opcional"}
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {group.options.map((option) => {
          const isSelected = selectedIds.includes(option.id);
          const maxReached =
            group.type === "multiple" &&
            group.maxSelections !== undefined &&
            selectedIds.length >= group.maxSelections &&
            !isSelected;

          return (
            <ComplementOptionButton
              key={option.id}
              group={group}
              option={option}
              selected={isSelected}
              disabled={maxReached}
              onToggle={() => onToggle(option.id)}
            />
          );
        })}
      </div>
    </section>
  );
}

function ComplementOptionButton({
  group,
  option,
  selected,
  disabled,
  onToggle,
}: {
  group: ComplementGroup;
  option: ComplementOption;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-disabled={disabled}
      className={`grid min-h-16 grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] border px-3 py-3 text-left transition ${
        selected
          ? "border-[#103d2c] bg-[#f3ead2]"
          : "border-[#d7a948]/25 bg-white hover:border-[#d7a948]"
      } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
      aria-pressed={selected}
    >
      <span
        className={`grid size-5 place-items-center border ${
          selected ? "border-[#103d2c] bg-[#103d2c]" : "border-[#d7a948]"
        } ${group.type === "single" ? "rounded-full" : "rounded-[4px]"}`}
        aria-hidden="true"
      >
        {selected ? <span className="size-2 bg-[#d7a948]" /> : null}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#103d2c]">
          {option.name}
        </span>
        {option.description ? (
          <span className="mt-1 block text-xs leading-5 text-[#526354]">
            {option.description}
          </span>
        ) : null}
      </span>

      <span className="shrink-0 text-sm font-semibold text-[#4b164c]">
        {formatOptionPrice(option.price)}
      </span>
    </button>
  );
}

function CatalogImage({
  alt,
  position,
  src,
}: {
  alt: string;
  position: string;
  src: string;
}) {
  const canRenderImage = src.startsWith("/images/");

  return (
    <div
      className="relative h-full min-h-full w-full overflow-hidden bg-[radial-gradient(circle_at_50%_42%,#fff7df_0%,#f3ead2_48%,#e2cf9f_100%)]"
    >
      {canRenderImage ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 430px) 100vw, 180px"
          className="object-contain p-2 drop-shadow-[0_16px_24px_rgba(22,34,26,0.22)]"
          style={{ objectPosition: position }}
        />
      ) : null}
    </div>
  );
}
