import { initialCatalog, type CatalogData, type ComplementGroup } from "@/data/menu";
import type { OrderItem } from "@/data/orders";
import {
  buildComboCartLine, buildCustomizedCupCartLine, buildSimpleCartLine,
  getComplementGroupsForLimit, getComplementGroupsForProduct, getCustomizableComboCups,
  isQuantityGroup, type SelectionState,
} from "@/lib/catalog/customization";
import { getPromotionStatus, PROMOTION_EXPIRED_MESSAGE } from "@/lib/catalog/pricing";
import { promotion } from "@/data/promotion";

export class OrderPricingError extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrderPricingError("Item ou personalização inválidos. Atualize o carrinho.");
  }
  return value as Record<string, unknown>;
}

function validateSelections(value: unknown, groups: ComplementGroup[]): SelectionState {
  const raw = record(value);
  if (Object.keys(raw).some((id) => !groups.some((group) => group.id === id))) {
    throw new OrderPricingError("Grupo de complementos inválido.");
  }
  return Object.fromEntries(groups.map((group) => {
    const ids = raw[group.id] ?? [];
    if (!Array.isArray(ids) || ids.length > 100 ||
        ids.some((id) => typeof id !== "string" || !group.options.some((option) => option.id === id))) {
      throw new OrderPricingError("Complemento inválido. Atualize suas escolhas.");
    }
    if ((!isQuantityGroup(group) && new Set(ids).size !== ids.length) ||
        (group.type === "single" && ids.length > 1) ||
        (group.maxSelections !== undefined && ids.length > group.maxSelections) ||
        (group.required && ids.length < (group.minSelections ?? 1))) {
      throw new OrderPricingError(`Confira as escolhas de ${group.title}.`);
    }
    return [group.id, ids as string[]];
  }));
}

// Nenhum preço, nome ou descrição de extra vindo do navegador é confiável.
// Reconstrói a linha usando exclusivamente IDs, quantidades e o catálogo real.
export function quoteOrderItems(value: unknown, now = Date.now(), catalog: CatalogData = initialCatalog) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new OrderPricingError("Adicione entre 1 e 100 itens ao pedido.");
  }
  let changed = false;
  let expired = false;
  const items: OrderItem[] = value.map((input) => {
    const raw = record(input);
    const product = catalog.products.find((item) => item.id === raw.productId && item.active !== false);
    if (!product) throw new OrderPricingError("Produto indisponível. Atualize o carrinho.");
    if (!Number.isSafeInteger(raw.quantity) || (raw.quantity as number) < 1 || (raw.quantity as number) > 100) {
      throw new OrderPricingError("Quantidade inválida.");
    }
    const quantity = raw.quantity as number;
    let line;
    if (product.comboCups?.length) {
      const cups = getCustomizableComboCups(product);
      if (!Array.isArray(raw.comboSelections) || raw.comboSelections.length !== cups.length) {
        throw new OrderPricingError("Personalize todos os copos do combo novamente.");
      }
      const selections = raw.comboSelections.map((selection, index) => validateSelections(
        selection, getComplementGroupsForLimit(cups[index].complementLimit, catalog.complementGroups),
      ));
      line = buildComboCartLine(product, selections, catalog.complementGroups, now);
    } else if (product.customizable) {
      const groups = getComplementGroupsForProduct(product, catalog.complementGroups);
      const selections = validateSelections(raw.selections, groups);
      line = buildCustomizedCupCartLine(product, selections, groups, now);
    } else {
      if (raw.selections !== undefined || raw.comboSelections !== undefined ||
          (Array.isArray(raw.customization) && raw.customization.length > 0)) {
        throw new OrderPricingError("Este produto não permite complementos.");
      }
      line = buildSimpleCartLine(product, now);
    }
    const totalPrice = line.unitPrice * quantity;
    if (raw.unitPrice !== line.unitPrice || raw.totalPrice !== totalPrice) {
      changed = true;
      if (promotion.prices[product.id] !== undefined &&
          getPromotionStatus(now) === "Encerrada" &&
          typeof raw.unitPrice === "number" && raw.unitPrice < line.unitPrice) expired = true;
    }
    return {
      id: line.id, productId: product.id, name: product.name,
      quantity, unitPrice: line.unitPrice, totalPrice,
      customization: line.customization ?? [],
      ...(line.selections ? { selections: line.selections } : {}),
      ...(line.comboSelections ? { comboSelections: line.comboSelections } : {}),
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal > 2_147_483_647) {
    throw new OrderPricingError("O valor do pedido excede o limite permitido.");
  }
  return {
    items, subtotal, total: subtotal, changed, serverTime: now,
    message: expired ? PROMOTION_EXPIRED_MESSAGE : "Os preços do pedido foram atualizados. Confira o total e confirme novamente.",
  };
}
