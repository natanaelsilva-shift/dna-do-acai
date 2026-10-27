import test from "node:test";
import assert from "node:assert/strict";
import { initialCatalog } from "@/data/menu";
import { promotion } from "@/data/promotion";
import { getComplementGroupsForProduct } from "@/lib/catalog/customization";
import { quoteOrderItems } from "@/lib/orders/pricing";
import { buildMenu, isAtendeiaOrder, ProtocolError, quoteProtocolItems, toStoreItems } from "@/lib/integrations/atendeia/protocol";
import { signRequest, verifySignature } from "@/lib/integrations/atendeia/signature";
import { createTestDatabase, insertOrder } from "./database.mjs";

// Integração com o AtendeIA (WhatsApp): sem rede, sem Supabase real, sem pedidos reais.
const AFTER_PROMO = Date.parse(promotion.endAt) + 60_000;
const DURING_PROMO = Date.parse(promotion.startAt) + 60_000;
const open = { status: "open", updatedAt: null };
const cup = (included, extras = [], utensils) => ({ included, extras, ...(utensils ? { utensils } : {}) });

test("cardápio do protocolo: 11 produtos ativos, preço normal fora da promoção, regras e checkout reais", () => {
  const menu = buildMenu(initialCatalog, open, null, AFTER_PROMO);
  assert.equal(menu.protocol, "atendeia.menu.v1");
  assert.equal(menu.products.length, 11);
  const supremo = menu.products.find((p) => p.id === "dna-supremo-500ml");
  assert.deepEqual([supremo.kind, supremo.sizeMl, supremo.price, supremo.includedLimit, supremo.promotion], ["custom", 500, 2199, 4, null]);
  assert.deepEqual(menu.products.filter((p) => p.kind === "custom").map((p) => p.includedLimit), [3, 4, 5]);
  assert.equal(menu.products.find((p) => p.id === "copo-acai-puro-700ml").kind, "simple");
  const triplo = menu.products.find((p) => p.id === "combo-triplo-supremo");
  assert.deepEqual(triplo.cups.map((c) => [c.sizeMl, c.includedLimit, c.pure]), [[500, 4, false], [500, 4, false], [500, 0, true]]);
  assert.deepEqual(menu.options.included.map((o) => o.name), ["Banana", "Morango", "Leite condensado", "Leite em pó", "Granola", "Paçoca"]);
  assert.equal(menu.options.extras.find((o) => o.id === "m-m-extra").price, 350);
  assert.ok(!JSON.stringify(menu).toLowerCase().includes("nutella"));
  assert.deepEqual(menu.options.utensils, { question: "Deseja colher e guardanapo?", yesId: "sim-colher-guardanapo", noId: "nao-colher-guardanapo", required: true });
  assert.deepEqual(menu.checkout.deliveryFee, { mode: "to_be_agreed" });
  assert.deepEqual(menu.checkout.paymentMethods.map((p) => p.id), ["pix", "card", "cash"]);
  assert.equal(menu.store.open, true);
});

test("promoção só vale dentro da janela; produto desativado sai do cardápio", () => {
  const during = buildMenu(initialCatalog, open, null, DURING_PROMO).products.find((p) => p.id === "dna-supremo-500ml");
  assert.equal(during.price, 1899);
  assert.equal(during.promotion.price, 1899);
  const catalog = { ...initialCatalog, products: initialCatalog.products.map((p) => p.id === "dna-explosao-300ml" ? { ...p, active: false } : p) };
  const menu = buildMenu(catalog, { status: "closed", updatedAt: null }, null, AFTER_PROMO);
  assert.equal(menu.products.some((p) => p.id === "dna-explosao-300ml"), false);
  assert.equal(menu.store.open, false);
  assert.throws(() => quoteProtocolItems([{ productId: "dna-explosao-300ml", quantity: 1, cups: [cup(["banana"])] }], catalog, AFTER_PROMO), (e) => e instanceof ProtocolError && e.code === "PRODUCT_UNAVAILABLE");
  assert.notEqual(buildMenu(initialCatalog, open, null, AFTER_PROMO).version, menu.version);
});

test("dois copos iguais com complementos diferentes viram dois itens; adicional pago soma o valor do catálogo", () => {
  const q = quoteProtocolItems([
    { productId: "dna-supremo-500ml", quantity: 1, cups: [cup(["banana", "morango", "leite-em-po", "leite-condensado"])] },
    { productId: "dna-supremo-500ml", quantity: 1, cups: [cup(["granola", "banana", "leite-condensado", "morango"], ["m-m-extra"])] },
  ], initialCatalog, AFTER_PROMO);
  assert.deepEqual(q.items.map((i) => i.unitPrice), [2199, 2549]);
  assert.equal(q.subtotal, 4748);
  assert.deepEqual(q.items[0].customization[0].optionsList, ["Banana", "Morango", "Leite condensado", "Leite em pó"]);
  assert.ok(q.items[1].customization.some((l) => l.options.includes("M&M")));
});

test("excesso de complementos grátis é recusado pelo servidor (regra 3/4/5)", () => {
  assert.throws(() => quoteProtocolItems([{ productId: "dna-explosao-300ml", quantity: 1, cups: [cup(["banana", "morango", "granola", "pacoca"])] }], initialCatalog, AFTER_PROMO), ProtocolError);
  assert.throws(() => quoteProtocolItems([{ productId: "dna-supremo-500ml", quantity: 1, cups: [cup(["nutella"])] }], initialCatalog, AFTER_PROMO), ProtocolError);
});

test("combos: um conjunto de escolhas por copo montável; açaí puro não leva complementos", () => {
  const q = quoteProtocolItems([{ productId: "combo-triplo-supremo", quantity: 1, cups: [cup(["banana"]), cup(["morango"], [], "no")] }], initialCatalog, AFTER_PROMO);
  assert.equal(q.total, 5499);
  assert.ok(q.items[0].customization.some((l) => l.groupTitle.startsWith("2º Copo 500ml") && l.options === "Não, obrigado."));
  assert.ok(q.items[0].customization.some((l) => l.groupTitle === "3º Copo"));
  assert.throws(() => toStoreItems([{ productId: "combo-supremo-dna", quantity: 1, cups: [cup(["banana"])] }], initialCatalog), (e) => e.code === "COMBO_CUPS");
  assert.throws(() => toStoreItems([{ productId: "copo-acai-puro-300ml", quantity: 1, cups: [cup(["banana"])] }], initialCatalog), (e) => e.code === "NOT_CUSTOMIZABLE");
  assert.equal(quoteProtocolItems([{ productId: "copo-acai-puro-300ml", quantity: 3 }], initialCatalog, AFTER_PROMO).total, 3 * 1299);
});

test("mesmo valor do checkout do site para as mesmas escolhas", () => {
  const product = initialCatalog.products.find((p) => p.id === "dna-extra-supremo-700ml");
  const groups = getComplementGroupsForProduct(product, initialCatalog.complementGroups);
  const site = quoteOrderItems([{ productId: product.id, quantity: 2, selections: {
    complementos: ["banana", "granola"], "turbine-seu-acai": ["morango-extra", "morango-extra"], "colher-guardanapo": ["sim-colher-guardanapo"],
  } }], AFTER_PROMO, initialCatalog);
  const viaWhatsapp = quoteProtocolItems([{ productId: product.id, quantity: 2, cups: [cup(["banana", "granola"], ["morango-extra", "morango-extra"])] }], initialCatalog, AFTER_PROMO);
  assert.equal(groups.find((g) => g.id === "complementos").maxSelections, 5);
  assert.equal(viaWhatsapp.subtotal, site.subtotal);
  assert.deepEqual(viaWhatsapp.items, site.items);
});

test("assinatura: aceita a válida e recusa corpo alterado, caminho trocado, expirada e segredo ausente", () => {
  const secret = "s".repeat(40);
  const now = Date.now();
  const header = signRequest(secret, "POST", "/api/integrations/atendeia/orders", '{"a":1}', now);
  assert.deepEqual(verifySignature(secret, header, "POST", "/api/integrations/atendeia/orders", '{"a":1}', now), { ok: true });
  assert.equal(verifySignature(secret, header, "POST", "/api/integrations/atendeia/orders", '{"a":2}', now).ok, false);
  assert.equal(verifySignature(secret, header, "POST", "/api/integrations/atendeia/quote", '{"a":1}', now).ok, false);
  assert.deepEqual(verifySignature(secret, header, "POST", "/api/integrations/atendeia/orders", '{"a":1}', now + 301_000), { ok: false, reason: "expired" });
  assert.deepEqual(verifySignature(undefined, header, "POST", "/x", "", now), { ok: false, reason: "not_configured" });
  assert.deepEqual(verifySignature("curto", header, "POST", "/x", "", now), { ok: false, reason: "not_configured" });
  assert.deepEqual(verifySignature(secret, null, "POST", "/x", "", now), { ok: false, reason: "missing" });
});

test("pedido do WhatsApp entra na mesma tabela: uma impressão automática e requestId único", async () => {
  const db = await createTestDatabase();
  try {
    await db.exec("update print_settings set automatic_enabled = true where id = 'main'");
    const requestId = "6f1c2b9e-1d1a-4c55-9a4e-1f2e3d4c5b6a";
    const payload = { messagePreview: "Novo pedido", origin: { system: "atendeia", channel: "whatsapp", requestId, paymentStatus: "pending" } };
    const order = await insertOrder(db, { request_id: requestId, customer_name: "Cliente Teste", status: "Novo", items: [{ unitPrice: 2199, quantity: 1, totalPrice: 2199 }], subtotal: 2199, total: 2199, whatsapp_payload: payload });
    assert.equal(isAtendeiaOrder(order.whatsapp_payload), true);
    await assert.rejects(() => insertOrder(db, { request_id: requestId, customer_name: "Repetido", status: "Novo", items: [], subtotal: 0, total: 0 }));
    const jobs = (await db.query("select kind from print_jobs where order_id = $1", [order.id])).rows;
    assert.deepEqual(jobs, [{ kind: "automatic" }]);
    assert.equal(isAtendeiaOrder({ messagePreview: "site" }), false);
  } finally { await db.close(); }
});
