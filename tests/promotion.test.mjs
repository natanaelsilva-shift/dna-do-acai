import test from "node:test";
import assert from "node:assert/strict";
import { initialCatalog, parseCatalogStorageSnapshot } from "@/data/menu";
import { promotion, PROMOTION_DURATION_MS, getPromotionWindow } from "@/data/promotion";
import { getEffectivePrice, getPromotionStatus, isPromotionActive } from "@/lib/catalog/pricing";
import {
  buildSimpleCartLine, buildCustomizedCupCartLine, buildComboCartLine,
  getDefaultSelections, getComplementGroupsForProduct, getCustomizableComboCups,
} from "@/lib/catalog/customization";
import { quoteOrderItems } from "@/lib/orders/pricing";
import { buildWhatsAppBusinessOrderPayload } from "@/lib/whatsapp/business";
import { buildReceiptText } from "../supabase/functions/_shared/receipt.ts";

const start = Date.parse(promotion.startAt);
const end = Date.parse(promotion.endAt);
const groups = initialCatalog.complementGroups;
const find = (id) => initialCatalog.products.find((product) => product.id === id);
function payloadLine(product, now, extras = []) {
  let line;
  if (product.comboCups) {
    const selections = getCustomizableComboCups(product).map(() => ({
      ...getDefaultSelections(groups), "turbine-seu-acai": extras,
    }));
    line = buildComboCartLine(product, selections, groups, now);
  } else if (product.customizable) {
    const productGroups = getComplementGroupsForProduct(product, groups);
    const selections = { ...getDefaultSelections(productGroups), "turbine-seu-acai": extras };
    line = buildCustomizedCupCartLine(product, selections, productGroups, now);
  } else line = buildSimpleCartLine(product, now);
  return { ...line, quantity: 2, totalPrice: line.unitPrice * 2 };
}

test("campanha dura exatamente 72 horas; início inclusivo e fim exclusivo", () => {
  assert.equal(end - start, PROMOTION_DURATION_MS);
  assert.equal(PROMOTION_DURATION_MS, 259_200_000);
  assert.equal(getPromotionStatus(start - 1), "Agendada");
  assert.equal(getPromotionStatus(start), "Ativa");
  assert.equal(getPromotionStatus(end), "Encerrada");
});

for (const [id, normal, promo] of [
  ["dna-explosao-300ml", 1499, 1299], ["dna-supremo-500ml", 2199, 1899],
  ["dna-extra-supremo-700ml", 2899, 2599], ["copo-acai-puro-300ml", 1299, 1199],
  ["copo-acai-puro-500ml", 1899, 1699], ["copo-acai-puro-700ml", 2499, 2299],
]) {
  test(`${id}: catálogo, personalização, carrinho e checkout antes/durante/depois`, () => {
    const product = find(id);
    for (const [now, price] of [[start - 1, normal], [start, promo], [end - 1, promo], [end, normal], [end + 1, normal]]) {
      assert.equal(getEffectivePrice(product, now), price);
      assert.equal(isPromotionActive(product, now), now >= start && now < end);
      const item = payloadLine(product, now);
      assert.equal(item.unitPrice, price);
      const quote = quoteOrderItems([item], now);
      assert.equal(quote.changed, false);
      assert.equal(quote.items[0].unitPrice, price);
      assert.equal(quote.subtotal, price * 2);
      assert.equal(quote.total, price * 2);
    }
    assert.equal(product.price, normal);
  });
}

test("M&M, Paçoca e demais extras mantêm preço/quantidade durante e após a oferta", () => {
  const product = find("dna-explosao-300ml");
  const extras = ["m-m-extra", "m-m-extra", "pacoca-extra"];
  const item = payloadLine(product, start, extras);
  assert.equal(item.unitPrice, 1299 + 350 * 2 + 200);
  const active = quoteOrderItems([item], start);
  assert.equal(active.items[0].unitPrice, item.unitPrice);
  const expired = quoteOrderItems([item], end);
  assert.equal(expired.items[0].unitPrice, 1499 + 350 * 2 + 200);
  assert.equal(expired.changed, true);
  assert.match(expired.message, /promoção deste item terminou/);
});

test("todos os combos mantêm preço base, extras e copo puro sem desconto", () => {
  for (const product of initialCatalog.products.filter((product) => product.comboCups)) {
    const item = payloadLine(product, start, ["m-m-extra"]);
    const expected = product.price + getCustomizableComboCups(product).length * 350;
    assert.equal(item.unitPrice, expected);
    assert.equal(quoteOrderItems([item], end).items[0].unitPrice, expected);
    assert.equal(getEffectivePrice(product, start), product.price);
  }
});

test("preço, nomes e valores de extras forjados nunca são cobrados", () => {
  const item = payloadLine(find("dna-explosao-300ml"), start, ["m-m-extra"]);
  const forged = { ...item, name: "Inventado", unitPrice: 1, totalPrice: 2,
    customization: [{ groupTitle: "Extras", options: "M&M", price: 0 }] };
  const quote = quoteOrderItems([forged], start);
  assert.equal(quote.changed, true);
  assert.equal(quote.items[0].unitPrice, 1649);
  assert.equal(quote.items[0].name, find(item.productId).name);
  assert.equal(quote.items[0].customization.find((line) => line.price > 0).price, 350);
});

test("rejeita IDs inexistentes, quantidades inválidas, limites, extras e grupos forjados", () => {
  const item = payloadLine(find("dna-explosao-300ml"), start);
  for (const patch of [
    { productId: "fake" }, { quantity: -1 }, { quantity: 1.5 }, { quantity: 101 },
    { selections: undefined },
    { selections: { ...item.selections, complementos: ["banana", "morango", "granola", "pacoca"] } },
    { selections: { ...item.selections, complementos: ["banana", "banana"] } },
    { selections: { ...item.selections, "turbine-seu-acai": ["extra-gratis-falso"] } },
    { selections: { ...item.selections, "colher-guardanapo": [] } },
    { selections: { ...item.selections, falso: [] } },
  ]) assert.throws(() => quoteOrderItems([{ ...item, ...patch }], start));
  const pure = payloadLine(find("copo-acai-puro-300ml"), start);
  assert.throws(() => quoteOrderItems([{ ...pure, selections: item.selections }], start));
});

test("pedidos históricos, mensagem WhatsApp e comanda conservam o snapshot pago", () => {
  const item = payloadLine(find("dna-explosao-300ml"), start);
  const quote = quoteOrderItems([item], start);
  const snapshot = JSON.parse(JSON.stringify(quote));
  const order = { ...snapshot, customerPhone: "62999999999", deliveryFee: null };
  const messageBefore = buildWhatsAppBusinessOrderPayload(order).messagePreview;
  quoteOrderItems([item], end);
  assert.deepEqual(snapshot, quote);
  assert.equal(buildWhatsAppBusinessOrderPayload(order).messagePreview, messageBefore);
  assert.match(messageBefore, /25,98/);
  const receipt = buildReceiptText({ id: "test", order_number: 1, created_at: promotion.startAt,
    items: snapshot.items, subtotal: snapshot.subtotal, total: snapshot.total },
  { storeName: "DNA DO AÇAÍ", paperWidth: 80, charactersPerLine: 48 });
  assert.match(receipt, /12,99/);
  assert.doesNotMatch(receipt, /14,99/);
});

test("snapshot antigo não substitui os seis preços normais", () => {
  const old = structuredClone(initialCatalog);
  old.products[0].price = 1;
  assert.equal(parseCatalogStorageSnapshot(JSON.stringify(old)).products[0].price, 1499);
});

test("produção ignora datas de teste mesmo quando configuradas", () => {
  const previous = { ...process.env };
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_DNA_PROMOTION_TEST_START_AT = "2000-01-01T00:00:00Z";
    process.env.NEXT_PUBLIC_DNA_PROMOTION_TEST_END_AT = "2000-01-01T00:02:00Z";
    assert.deepEqual(getPromotionWindow(), { startAt: promotion.startAt, endAt: promotion.endAt });
    process.env.NODE_ENV = "development";
    assert.equal(getPromotionWindow().endAt, "2000-01-01T00:02:00Z");
  } finally { process.env = previous; }
});
