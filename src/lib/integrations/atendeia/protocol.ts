import { createHash } from "node:crypto";
import type { CatalogData, ComplementGroup, Product } from "@/data/menu";
import type { StoreStatusPayload } from "@/data/store-status";
import type { OrderItem } from "@/data/orders";
import { getPromotionWindow, promotion } from "@/data/promotion";
import { getEffectivePrice, isPromotionActive } from "@/lib/catalog/pricing";
import {
  getComplementGroupsForLimit, getComplementGroupsForProduct, getCustomizableComboCups,
  SPOON_NAPKIN_GROUP_ID, TURBINE_GROUP_ID, type SelectionState,
} from "@/lib/catalog/customization";
import { paymentLabels } from "@/lib/checkout/form";
import { OrderPricingError, quoteOrderItems } from "@/lib/orders/pricing";

// Protocolo de cardápio usado pelo AtendeIA (atendimento pelo WhatsApp).
// O DNA do Açaí continua sendo a ÚNICA fonte de produtos, preços, promoções e
// regras: o AtendeIA só envia IDs e escolhas por copo, e todo valor é
// recalculado aqui com as mesmas funções do site (quoteOrderItems).

export const MENU_PROTOCOL = "atendeia.menu.v1";
const INCLUDED_GROUP_ID = "complementos";

export type ProtocolCup = { included?: string[]; extras?: string[]; utensils?: "yes" | "no" };
export type ProtocolItem = { productId: string; quantity: number; cups?: ProtocolCup[] };

export class ProtocolError extends Error {
  constructor(message: string, readonly code = "INVALID_ITEMS") { super(message); }
}

function sizeMl(text: string | undefined) {
  const match = text?.match(/(\d{3})\s*ml/i);
  return match ? Number(match[1]) : null;
}

function productKind(product: Product) {
  if (product.comboCups?.length) return "combo" as const;
  return product.customizable ? "custom" as const : "simple" as const;
}

const groupById = (catalog: CatalogData, id: string) => catalog.complementGroups.find((g) => g.id === id) ?? null;

function utensilIds(group: ComplementGroup | null) {
  if (!group || group.options.length < 2) return null;
  const yes = group.options.find((o) => /^sim/i.test(o.id)) ?? group.options[0];
  const no = group.options.find((o) => /^nao|^não/i.test(o.id)) ?? group.options[1];
  return { yes: yes.id, no: no.id };
}

/** Cardápio vigente, com o preço efetivo de agora (promoção ativa ou preço normal). */
export function buildMenu(catalog: CatalogData, store: StoreStatusPayload, catalogUpdatedAt: string | null, now = Date.now()) {
  const window = getPromotionWindow();
  const included = groupById(catalog, INCLUDED_GROUP_ID);
  const extras = groupById(catalog, TURBINE_GROUP_ID);
  const utensilGroup = groupById(catalog, SPOON_NAPKIN_GROUP_ID);
  const utensils = utensilIds(utensilGroup);
  const products = catalog.products.filter((p) => p.active !== false).map((p) => {
    const promo = isPromotionActive(p, now, window);
    return {
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      description: p.description,
      kind: productKind(p),
      sizeMl: sizeMl(p.name) ?? sizeMl(p.comboCups?.[0]?.size),
      price: getEffectivePrice(p, now, window),
      regularPrice: p.price,
      promotion: promo ? { price: promotion.prices[p.id], endsAt: window.endAt } : null,
      includedLimit: p.customizable && !p.comboCups?.length ? p.complementLimit ?? null : null,
      cups: (p.comboCups ?? []).map((cup) => ({
        label: cup.label, sizeMl: sizeMl(cup.size), includedLimit: cup.pure ? 0 : cup.complementLimit ?? null, pure: Boolean(cup.pure),
      })),
    };
  });
  const menu = {
    protocol: MENU_PROTOCOL,
    store: { name: "DNA do Açaí", open: store.status === "open", statusUpdatedAt: store.updatedAt },
    serverTime: new Date(now).toISOString(),
    catalogUpdatedAt,
    categories: catalog.categories.map((c) => ({ id: c.id, name: c.name })),
    products,
    options: {
      included: (included?.options ?? []).map((o) => ({ id: o.id, name: o.name })),
      extras: (extras?.options ?? []).map((o) => ({ id: o.id, name: o.name, price: o.price })),
      utensils: utensilGroup && utensils ? { question: utensilGroup.title, yesId: utensils.yes, noId: utensils.no, required: utensilGroup.required } : null,
    },
    checkout: {
      deliveryMethods: [{ id: "delivery", label: "Entrega" }, { id: "pickup", label: "Retirada na loja" }],
      // A loja informa a taxa no painel depois do pedido (mesma regra do site).
      deliveryFee: { mode: "to_be_agreed" as const },
      paymentMethods: (Object.keys(paymentLabels) as Array<keyof typeof paymentLabels>).map((id) => ({ id, label: paymentLabels[id], allowsChange: id === "cash" })),
      prepaymentRequired: false,
    },
  };
  return { ...menu, version: menuVersion(menu) };
}

function menuVersion(menu: { serverTime: string } & Record<string, unknown>) {
  const stable = { ...menu, serverTime: undefined };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 16);
}

function ids(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30 || value.some((v) => typeof v !== "string" || v.length > 100)) {
    throw new ProtocolError(`${label} inválidos.`);
  }
  return value as string[];
}

function cupSelections(cup: unknown, groups: ComplementGroup[]): SelectionState {
  if (!cup || typeof cup !== "object" || Array.isArray(cup)) throw new ProtocolError("Copo inválido.");
  const raw = cup as Record<string, unknown>;
  const selections: SelectionState = {};
  for (const group of groups) {
    if (group.id === INCLUDED_GROUP_ID) selections[group.id] = ids(raw.included, "Complementos");
    else if (group.id === TURBINE_GROUP_ID) selections[group.id] = ids(raw.extras, "Adicionais");
    else if (group.id === SPOON_NAPKIN_GROUP_ID) {
      const u = utensilIds(group);
      if (raw.utensils !== undefined && raw.utensils !== "yes" && raw.utensils !== "no") throw new ProtocolError("Opção de colher e guardanapo inválida.");
      // Mesmo padrão do site: sem resposta, vale a primeira opção ("Sim, por favor.").
      selections[group.id] = u ? [raw.utensils === "no" ? u.no : u.yes] : [group.options[0]?.id].filter(Boolean) as string[];
    } else selections[group.id] = group.required && group.options[0] ? [group.options[0].id] : [];
  }
  return selections;
}

/** Converte os itens do protocolo para o formato do carrinho do site (seleções por grupo). */
export function toStoreItems(value: unknown, catalog: CatalogData) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) throw new ProtocolError("Envie entre 1 e 50 itens.");
  return value.map((input) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ProtocolError("Item inválido.");
    const raw = input as Record<string, unknown>;
    const product = catalog.products.find((p) => p.id === raw.productId && p.active !== false);
    if (!product) throw new ProtocolError("Produto indisponível.", "PRODUCT_UNAVAILABLE");
    const cups = raw.cups === undefined ? [] : raw.cups;
    if (!Array.isArray(cups)) throw new ProtocolError("Copos inválidos.");
    const base = { productId: product.id, quantity: raw.quantity };
    if (product.comboCups?.length) {
      const combo = getCustomizableComboCups(product);
      if (cups.length !== combo.length) throw new ProtocolError(`O ${product.name} tem ${combo.length} copos para montar.`, "COMBO_CUPS");
      return { ...base, comboSelections: combo.map((cup, i) => cupSelections(cups[i], getComplementGroupsForLimit(cup.complementLimit, catalog.complementGroups))) };
    }
    if (product.customizable) {
      if (cups.length !== 1) throw new ProtocolError("Envie um copo por item personalizado.", "CUP_REQUIRED");
      return { ...base, selections: cupSelections(cups[0], getComplementGroupsForProduct(product, catalog.complementGroups)) };
    }
    if (cups.length) throw new ProtocolError(`${product.name} não leva complementos.`, "NOT_CUSTOMIZABLE");
    return base;
  });
}

/** Cotação oficial: os mesmos cálculos do site. Erros de regra viram ProtocolError (400). */
export function quoteProtocolItems(value: unknown, catalog: CatalogData, now = Date.now()) {
  const items = toStoreItems(value, catalog);
  try {
    const quote = quoteOrderItems(items, now, catalog);
    return { items: quote.items, subtotal: quote.subtotal, total: quote.total };
  } catch (error) {
    if (error instanceof OrderPricingError) throw new ProtocolError(error.message, "RULES");
    throw error;
  }
}

export function publicItems(items: OrderItem[]) {
  return items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice, customization: i.customization ?? [] }));
}

export { ATENDEIA_ORDER_ORIGIN as ORDER_ORIGIN, isAtendeiaOrder } from "@/data/orders";
