"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { initialCatalog, type ComboCup, type ComplementGroup, type Product } from "@/data/menu";
import { useCart } from "@/components/cart/CartProvider";
import { useStore } from "@/components/store/StoreProvider";
import {
  buildComboCartLine,
  buildCustomizedCupCartLine,
  buildSimpleCartLine,
  calculateComboCustomizedPrice,
  calculateCustomizedPrice,
  getComplementGroupsForLimit,
  getComplementGroupsForProduct,
  getCustomizableComboCups,
  getDefaultSelections,
  getPureComboCups,
  isComboProduct,
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
  const { complementGroups } = useStore();
  const { addCartLine } = useCart();
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
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
        )
      : calculateCustomizedPrice(customizingProduct, selections, activeComplementGroups)
    : 0;

  const isCustomizationValid = activeComplementGroups.every((group) => {
    if (!group.required) {
      return true;
    }

    return (selections[group.id] ?? []).length >= (group.minSelections ?? 1);
  });

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

    addCartLine(buildSimpleCartLine(product));
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
        buildComboCartLine(customizingProduct, nextComboSelections, complementGroups),
      );

      setCustomizingProduct(null);
      setComboSelections([]);
      setComboStepIndex(0);
      setCustomizationError("");
      return;
    }

    addCartLine(
      buildCustomizedCupCartLine(customizingProduct, selections, activeComplementGroups),
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

  function incrementOptionQuantity(group: ComplementGroup, optionId: string) {
    setSelections((currentSelections) => {
      const selectedIds = currentSelections[group.id] ?? [];
      setCustomizationError("");

      return {
        ...currentSelections,
        [group.id]: [...selectedIds, optionId],
      };
    });
  }

  function decrementOptionQuantity(group: ComplementGroup, optionId: string) {
    setSelections((currentSelections) => {
      const selectedIds = currentSelections[group.id] ?? [];
      const optionIndex = selectedIds.lastIndexOf(optionId);

      if (optionIndex === -1) {
        return currentSelections;
      }

      const nextSelectedIds = [...selectedIds];
      nextSelectedIds.splice(optionIndex, 1);
      setCustomizationError("");

      return {
        ...currentSelections,
        [group.id]: nextSelectedIds,
      };
    });
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
