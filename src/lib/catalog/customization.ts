import type {
  ComboCup,
  ComplementGroup,
  ComplementOption,
  Product,
} from "@/data/menu";
import type { OrderCustomizationLine } from "@/data/orders";
import type { CartLine } from "@/lib/cart/types";
import { formatCurrency } from "@/lib/format/currency";
import { getEffectivePrice, isPromotionActive } from "@/lib/catalog/pricing";

// Regras de personalização de copos e combos. Preço, limites e linhas de
// customização daqui alimentam o carrinho, o payload do pedido e a comanda
// impressa — qualquer mudança aqui é uma mudança comercial.

export type SelectionState = Record<string, string[]>;

export const TURBINE_GROUP_ID = "turbine-seu-acai";
export const SPOON_NAPKIN_GROUP_ID = "colher-guardanapo";
export const DEFAULT_SPOON_NAPKIN_OPTION = "Sim, por favor.";

export function isQuantityGroup(group: ComplementGroup) {
  return group.id === TURBINE_GROUP_ID;
}

export function getOptionQuantity(
  selectedIds: string[],
  optionId: string,
  countRepeatedIds: boolean,
) {
  if (countRepeatedIds) {
    return selectedIds.filter((selectedId) => selectedId === optionId).length;
  }

  return selectedIds.includes(optionId) ? 1 : 0;
}

export function getDefaultSelections(complementGroups: ComplementGroup[]) {
  return complementGroups.reduce<SelectionState>((selections, group) => {
    if (group.required && group.options[0]) {
      selections[group.id] = [group.options[0].id];
    } else {
      selections[group.id] = [];
    }

    return selections;
  }, {});
}

export function getComplementGroupsForLimit(
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
      title: "Complementos grátis",
      description: `Escolha até ${complementLimit} complementos grátis.`,
      maxSelections: complementLimit,
    };
  });
}

export function getComplementGroupsForProduct(
  product: Product | null,
  complementGroups: ComplementGroup[],
) {
  return getComplementGroupsForLimit(product?.complementLimit, complementGroups);
}

export function getCustomizableComboCups(product: Product | null) {
  return product?.comboCups?.filter((cup) => !cup.pure) ?? [];
}

export function getPureComboCups(product: Product | null) {
  return product?.comboCups?.filter((cup) => cup.pure) ?? [];
}

export function isComboProduct(product: Product | null) {
  return Boolean(product?.comboCups?.length);
}

export function getSelectedOptionEntries(
  group: ComplementGroup,
  selections: SelectionState,
) {
  const selectedIds = selections[group.id] ?? [];

  return group.options
    .map((option) => ({
      option,
      quantity: getOptionQuantity(selectedIds, option.id, isQuantityGroup(group)),
    }))
    .filter(({ quantity }) => quantity > 0);
}

export function getGroupSelectionsPrice(
  group: ComplementGroup,
  selections: SelectionState,
) {
  return getSelectedOptionEntries(group, selections).reduce(
    (total, { option, quantity }) => total + option.price * quantity,
    0,
  );
}

export function getSelectionsPrice(
  selections: SelectionState,
  complementGroups: ComplementGroup[],
) {
  return complementGroups.reduce(
    (total, group) => total + getGroupSelectionsPrice(group, selections),
    0,
  );
}

export function calculateCustomizedPrice(
  product: Product,
  selections: SelectionState,
  complementGroups: ComplementGroup[],
  now = Date.now(),
) {
  return getEffectivePrice(product, now) + getSelectionsPrice(selections, complementGroups);
}

export function calculateComboCustomizedPrice(
  product: Product,
  comboSelections: SelectionState[],
  complementGroups: ComplementGroup[],
  now = Date.now(),
) {
  let customizableCupIndex = 0;

  return (product.comboCups ?? []).reduce((total, cup) => {
    if (cup.pure) {
      return total;
    }

    const cupComplementGroups = getComplementGroupsForLimit(
      cup.complementLimit,
      complementGroups,
    );
    const cupSelections = comboSelections[customizableCupIndex] ?? {};
    customizableCupIndex += 1;

    return total + getSelectionsPrice(cupSelections, cupComplementGroups);
  }, getEffectivePrice(product, now));
}

export function formatCustomizationOption(
  group: ComplementGroup,
  option: ComplementOption,
  quantity: number,
) {
  if (!isQuantityGroup(group)) {
    return option.name;
  }

  const quantityPrefix = quantity > 1 ? `${quantity}x ` : "";

  return `${quantityPrefix}${option.name} - ${formatCurrency(
    option.price * quantity,
  )}`;
}

export function buildGroupCustomizationLine(
  group: ComplementGroup,
  selections: SelectionState,
  emptyOptions?: string,
): OrderCustomizationLine | null {
  const selectedEntries = getSelectedOptionEntries(group, selections);

  if (selectedEntries.length === 0 && !emptyOptions) {
    return null;
  }

  const optionsList = selectedEntries.map(({ option, quantity }) =>
    formatCustomizationOption(group, option, quantity),
  );

  return {
    groupTitle: group.title,
    options:
      optionsList.length > 0 ? optionsList.join(", ") : emptyOptions ?? "",
    optionsList: optionsList.length > 0 ? optionsList : undefined,
    price: getGroupSelectionsPrice(group, selections),
  };
}

export function buildCustomizationLines(
  selections: SelectionState,
  complementGroups: ComplementGroup[],
) {
  return complementGroups
    .map<OrderCustomizationLine | null>((group) => {
      const defaultLabel =
        group.id === SPOON_NAPKIN_GROUP_ID ? DEFAULT_SPOON_NAPKIN_OPTION : undefined;

      return buildGroupCustomizationLine(group, selections, defaultLabel);
    })
    .filter((line): line is OrderCustomizationLine => Boolean(line));
}

export function buildCustomizedItemId(
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

export function buildComboCustomizedItemId(
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

export function buildComboCustomizationLines(
  product: Product,
  comboSelections: SelectionState[],
  complementGroups: ComplementGroup[],
): OrderCustomizationLine[] {
  let customizableCupIndex = 0;

  return (product.comboCups ?? []).flatMap((cup) => {
    if (cup.pure) {
      return [
        {
          groupTitle: cup.label,
          options: "Açaí puro, sem complementos.",
          optionsList: [],
          price: 0,
        },
        {
          groupTitle: `${cup.label} - Deseja colher e guardanapo?`,
          options: DEFAULT_SPOON_NAPKIN_OPTION,
          optionsList: [DEFAULT_SPOON_NAPKIN_OPTION],
          price: 0,
        },
      ];
    }

    const cupSelections = comboSelections[customizableCupIndex] ?? {};
    const cupComplementGroups = getComplementGroupsForLimit(
      cup.complementLimit,
      complementGroups,
    );
    customizableCupIndex += 1;

    return cupComplementGroups
      .map((group) =>
        buildGroupCustomizationLine(
          group,
          cupSelections,
          group.id === "complementos" ? "Sem complementos grátis." : undefined,
        ),
      )
      .filter((line): line is OrderCustomizationLine => Boolean(line))
      .map((line) => ({
        ...line,
        groupTitle: `${cup.label} - ${line.groupTitle}`,
      }));
  });
}

// Linha de carrinho de um copo personalizado (não-combo). É exatamente o que o
// personalizador sempre adicionou ao carrinho; compartilhado com o builder.
export function buildCustomizedCupCartLine(
  product: Product,
  selections: SelectionState,
  complementGroups: ComplementGroup[],
  now = Date.now(),
): CartLine {
  return {
    id: buildCustomizedItemId(product.id, selections, complementGroups),
    productId: product.id,
    name: product.name,
    image: product.image,
    imagePosition: product.imagePosition,
    unitPrice: calculateCustomizedPrice(product, selections, complementGroups, now),
    selections,
    promotionApplied: isPromotionActive(product, now),
    customization: buildCustomizationLines(selections, complementGroups),
  };
}

export function buildComboCartLine(
  product: Product,
  comboSelections: SelectionState[],
  complementGroups: ComplementGroup[],
  now = Date.now(),
): CartLine {
  return {
    id: buildComboCustomizedItemId(
      product.id,
      getCustomizableComboCups(product),
      comboSelections,
    ),
    productId: product.id,
    name: product.name,
    image: product.image,
    imagePosition: product.imagePosition,
    unitPrice: calculateComboCustomizedPrice(product, comboSelections, complementGroups, now),
    comboSelections,
    customization: buildComboCustomizationLines(product, comboSelections, complementGroups),
  };
}

export function buildSimpleCartLine(product: Product, now = Date.now()): CartLine {
  return {
    id: product.id,
    productId: product.id,
    name: product.name,
    image: product.image,
    imagePosition: product.imagePosition,
    unitPrice: getEffectivePrice(product, now),
    promotionApplied: isPromotionActive(product, now),
  };
}

// ---------------------------------------------------------------------------
// Regras de seleção de complementos (compartilhadas por personalizador e
// builder). Mesmo comportamento que o personalizador sempre teve.
// ---------------------------------------------------------------------------

export type SelectionResult = {
  selections: SelectionState;
  // null = não altera a mensagem atual (comportamento original).
  error: string | null;
};

export function toggleOptionSelection(
  currentSelections: SelectionState,
  group: ComplementGroup,
  optionId: string,
): SelectionResult {
  const selectedIds = currentSelections[group.id] ?? [];

  if (group.type === "single") {
    return {
      selections: { ...currentSelections, [group.id]: [optionId] },
      error: null,
    };
  }

  if (selectedIds.includes(optionId)) {
    return {
      selections: {
        ...currentSelections,
        [group.id]: selectedIds.filter((selectedId) => selectedId !== optionId),
      },
      error: "",
    };
  }

  if (group.maxSelections !== undefined && selectedIds.length >= group.maxSelections) {
    return {
      selections: currentSelections,
      error: `Escolha no máximo ${group.maxSelections} complementos por copo.`,
    };
  }

  return {
    selections: { ...currentSelections, [group.id]: [...selectedIds, optionId] },
    error: "",
  };
}

export function incrementOptionSelection(
  currentSelections: SelectionState,
  group: ComplementGroup,
  optionId: string,
): SelectionResult {
  const selectedIds = currentSelections[group.id] ?? [];

  return {
    selections: { ...currentSelections, [group.id]: [...selectedIds, optionId] },
    error: "",
  };
}

export function decrementOptionSelection(
  currentSelections: SelectionState,
  group: ComplementGroup,
  optionId: string,
): SelectionResult {
  const selectedIds = currentSelections[group.id] ?? [];
  const optionIndex = selectedIds.lastIndexOf(optionId);

  if (optionIndex === -1) {
    return { selections: currentSelections, error: null };
  }

  const nextSelectedIds = [...selectedIds];
  nextSelectedIds.splice(optionIndex, 1);

  return {
    selections: { ...currentSelections, [group.id]: nextSelectedIds },
    error: "",
  };
}

export function isSelectionValid(
  selections: SelectionState,
  complementGroups: ComplementGroup[],
) {
  return complementGroups.every((group) => {
    if (!group.required) {
      return true;
    }

    return (selections[group.id] ?? []).length >= (group.minSelections ?? 1);
  });
}
