"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { initialCatalog, type ComboCup, type ComplementGroup, type Product } from "@/data/menu";
import { useCart } from "@/components/cart/CartProvider";
import { useStore } from "@/components/store/StoreProvider";
import { usePromotionClock } from "@/components/store/PromotionProvider";
import {
  buildComboCartLine,
  buildCustomizedCupCartLine,
  buildSimpleCartLine,
  calculateComboCustomizedPrice,
  calculateCustomizedPrice,
  decrementOptionSelection,
  getComplementGroupsForLimit,
  getComplementGroupsForProduct,
  getCustomizableComboCups,
  getDefaultSelections,
  getPureComboCups,
  incrementOptionSelection,
  isComboProduct,
  isSelectionValid,
  toggleOptionSelection,
  type SelectionState,
} from "@/lib/catalog/customization";

type CustomizerContextValue = {
  customizingProduct: Product | null;
  isCombo: boolean;
  selections: SelectionState;
  comboStepIndex: number;
  customizableComboCups: ComboCup[];
  activeComboCup: ComboCup | undefined;
  activeComplementGroups: ComplementGroup[];
  pureComboCups: ComboCup[];
  customizedPrice: number;
  isCustomizationValid: boolean;
  customizationError: string;
  addProduct: (product: Product) => void;
  openCustomizer: (product: Product) => void;
  confirmCustomization: () => void;
  goToPreviousComboCup: () => void;
  resetCurrentCustomization: () => void;
  closeCustomizer: () => void;
  toggleOption: (group: ComplementGroup, optionId: string) => void;
  incrementOptionQuantity: (group: ComplementGroup, optionId: string) => void;
  decrementOptionQuantity: (group: ComplementGroup, optionId: string) => void;
};

const CustomizerContext = createContext<CustomizerContextValue | null>(null);

export function CustomizerProvider({ children }: { children: ReactNode }) {
  const { complementGroups, products } = useStore();
  const { now, currentTime } = usePromotionClock();
  const { addCartLine } = useCart();
  const [selectedProduct, setCustomizingProduct] = useState<Product | null>(null);
  const customizingProduct = products.find((product) => product.id === selectedProduct?.id) ?? null;
  const [selections, setSelections] = useState<SelectionState>(() =>
    getDefaultSelections(initialCatalog.complementGroups),
  );
  const [comboStepIndex, setComboStepIndex] = useState(0);
  const [comboSelections, setComboSelections] = useState<SelectionState[]>([]);
  const [customizationError, setCustomizationError] = useState("");

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
  const activeComboSelections = useMemo(() => {
    if (!customizingProduct || !isComboProduct(customizingProduct)) {
      return comboSelections;
    }

    const nextSelections = [...comboSelections];
    nextSelections[comboStepIndex] = selections;

    return nextSelections;
  }, [comboSelections, comboStepIndex, customizingProduct, selections]);

  const customizedPrice = customizingProduct
    ? isComboProduct(customizingProduct)
      ? calculateComboCustomizedPrice(
          customizingProduct,
          activeComboSelections,
          complementGroups,
          now,
        )
      : calculateCustomizedPrice(customizingProduct, selections, activeComplementGroups, now)
    : 0;

  const isCustomizationValid = isSelectionValid(selections, activeComplementGroups);

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

  // Antigo `addSimpleProduct`: produtos personalizáveis abrem o personalizador,
  // os demais entram direto no carrinho.
  function addProduct(product: Product) {
    if (product.customizable) {
      openCustomizer(product);
      return;
    }

    addCartLine(buildSimpleCartLine(product, currentTime()));
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

      addCartLine(
        buildComboCartLine(customizingProduct, nextComboSelections, complementGroups, currentTime()),
      );

      setCustomizingProduct(null);
      setComboSelections([]);
      setComboStepIndex(0);
      setCustomizationError("");
      return;
    }

    addCartLine(
      buildCustomizedCupCartLine(customizingProduct, selections, activeComplementGroups, currentTime()),
    );

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

  function applySelectionResult(
    rule: typeof toggleOptionSelection,
    group: ComplementGroup,
    optionId: string,
  ) {
    setSelections((currentSelections) => {
      const result = rule(currentSelections, group, optionId);

      if (result.error !== null) {
        setCustomizationError(result.error);
      }

      return result.selections;
    });
  }

  function toggleOption(group: ComplementGroup, optionId: string) {
    applySelectionResult(toggleOptionSelection, group, optionId);
  }

  function incrementOptionQuantity(group: ComplementGroup, optionId: string) {
    applySelectionResult(incrementOptionSelection, group, optionId);
  }

  function decrementOptionQuantity(group: ComplementGroup, optionId: string) {
    applySelectionResult(decrementOptionSelection, group, optionId);
  }

  const value: CustomizerContextValue = {
    customizingProduct,
    isCombo: isComboProduct(customizingProduct),
    selections,
    comboStepIndex,
    customizableComboCups,
    activeComboCup,
    activeComplementGroups,
    pureComboCups,
    customizedPrice,
    isCustomizationValid,
    customizationError,
    addProduct,
    openCustomizer,
    confirmCustomization,
    goToPreviousComboCup,
    resetCurrentCustomization,
    closeCustomizer,
    toggleOption,
    incrementOptionQuantity,
    decrementOptionQuantity,
  };

  return (
    <CustomizerContext.Provider value={value}>{children}</CustomizerContext.Provider>
  );
}

export function useCustomizer() {
  const context = useContext(CustomizerContext);

  if (!context) {
    throw new Error("useCustomizer precisa estar dentro de <CustomizerProvider>.");
  }

  return context;
}
