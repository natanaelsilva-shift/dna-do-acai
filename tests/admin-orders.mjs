import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { initialCatalog } from "@/data/menu";
import { buildSimpleCartLine } from "@/lib/catalog/customization";

// Exercita o SDK Realtime real com mensagens Phoenix, sem acesso ao Supabase real.
async function interceptRealtime(page) {
  const channels = new Map();
  let unavailable = false;
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (socket) => {
    socket.onMessage((raw) => {
      const [joinRef, ref, topic, event, payload] = JSON.parse(String(raw));
      const reply = (status, response) => socket.send(JSON.stringify([
        joinRef, ref, topic, "phx_reply", { status, response },
      ]));
      if (event === "phx_join") {
        if (unavailable && topic === "realtime:orders-listener") {
          reply("error", { reason: "permission denied for table orders" });
          return;
        }
        const bindings = (payload.config?.postgres_changes ?? []).map((filter, i) => ({ ...filter, id: i + 1 }));
        channels.set(topic, { socket, joinRef, bindings });
        reply("ok", { postgres_changes: bindings });
      } else if (event === "heartbeat" || event === "phx_leave") reply("ok", {});
    });
  });
  return {
    connected: () => channels.has("realtime:orders-listener"),
    emit(type, record) {
      const { socket, joinRef, bindings } = channels.get("realtime:orders-listener");
      socket.send(JSON.stringify([joinRef, null, "realtime:orders-listener", "postgres_changes", {
        ids: bindings.filter((b) => b.event === type).map((b) => b.id),
        data: { schema: "public", table: "orders", type, columns: [], record, old_record: {}, commit_timestamp: new Date().toISOString(), errors: null },
      }]));
    },
    fail() {
      unavailable = true;
      const { socket, joinRef } = channels.get("realtime:orders-listener");
      socket.send(JSON.stringify([joinRef, null, "realtime:orders-listener", "phx_error", { reason: "permission denied for table orders" }]));
    },
  };
}

export async function runAdminOrdersAudit({ browser, context, base, db, artifacts, now, errors }) {
  const isolated = await browser.newContext({
    storageState: await context.storageState(), viewport: { width: 1365, height: 900 }, reducedMotion: "reduce",
  });
  await isolated.route("**/*", (route) => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  const admin = await isolated.newPage();
  admin.on("pageerror", (error) => errors.push(error.message));
  let notifications = 0;
  let realtimeErrors = 0;
  admin.on("console", (message) => {
    if (message.text() === "Novo pedido detectado") notifications++;
    if (message.text().includes("Realtime indisponível")) realtimeErrors++;
  });
  await admin.addInitScript(() => {
    const audit = window.__orderAudit = { requests: [], active: 0, maxActive: 0, plays: 0 };
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      if (args[0] !== "/api/orders" || (args[1]?.method ?? "GET") !== "GET") return originalFetch(...args);
      audit.requests.push({ time: performance.now(), cache: args[1]?.cache });
      audit.active++;
      audit.maxActive = Math.max(audit.maxActive, audit.active);
      try { return await originalFetch(...args); } finally { audit.active--; }
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = async function () {
      await play.call(this);
      if (this.src.endsWith("/sounds/novo-pedido.mp3")) audit.plays++;
    };
  });
  const realtime = await interceptRealtime(admin);
  const line = buildSimpleCartLine(initialCatalog.products[3], now);
  const payload = { customerPhone: "62999999999", deliveryMethod: "pickup", paymentMethod: "pix",
    items: [{ ...line, quantity: 1, totalPrice: line.unitPrice }], subtotal: line.unitPrice, total: line.unitPrice };
  const create = async (name) => {
    const response = await isolated.request.post(base + "/api/orders", { data: { ...payload, customerName: name, requestId: crypto.randomUUID() } });
    assert.equal(response.status(), 201, await response.text());
    return (await response.json()).order;
  };
  const patch = async (order, status) => {
    const response = await isolated.request.patch(base + "/api/orders/" + order.id, { data: { status } });
    assert.equal(response.status(), 200, await response.text());
  };
  const getOrders = async () => (await (await isolated.request.get(base + "/api/orders")).json()).orders;
  const waitGet = () => admin.waitForResponse((r) => r.url() === base + "/api/orders" && r.request().method() === "GET");
  const nav = (name) => admin.getByRole("navigation").getByRole("button", { name });
  const toast = admin.locator('main [aria-live="assertive"]');
  const soundCount = () => admin.evaluate(() => window.__orderAudit.plays);
  const checkNoRealtimeError = () => expect(admin.locator("body")).not.toContainText("permission denied");
  const results = {};
  try {
    const histories = [];
    for (const status of ["Novo", "Em preparo", "Saiu para entrega", "Finalizado", "Cancelado"]) {
      const order = await create("Histórico " + status);
      if (status !== "Novo") await patch(order, status);
      histories.push({ ...order, status });
    }
    // Apenas o PostgreSQL efêmero: comprova ausência de filtro implícito por data.
    await db.query("update orders set created_at = '2020-01-01T12:00:00Z' where id = any($1::uuid[])", [histories.map((o) => o.id)]);
    // Com o relógio pausado, só a carga imediata pode consultar a API.
    await admin.clock.install();
    await admin.clock.pauseAt(new Date());
    const initialGet = waitGet();
    const ready = admin.waitForResponse((r) => r.url().endsWith("/api/printing/settings"));
    await admin.goto(base + "/admin/pedidos");
    assert.equal((await initialGet).status(), 200);
    await ready;
    await expect.poll(realtime.connected).toBe(true);
    await nav(/^Pedidos/).click();
    for (const order of histories) {
      await admin.getByRole("button", { name: new RegExp("^" + (order.status === "Novo" ? "Novos" : order.status) + " \\d+$") }).click();
      await expect(admin.locator("#order-" + order.id)).toContainText("Histórico " + order.status);
    }
    assert.equal(notifications, 0, "Histórico inicial não deve repetir alertas");
    await admin.getByRole("button", { name: /^Novos \d+$/ }).click();
    await admin.getByRole("button", { name: "Ativar som de pedidos", exact: true }).click();
    await expect.poll(soundCount).toBe(1);

    // INSERT incompleto e até incorreto: somente o registro da API pode aparecer.
    const inserted = await create("Recebido por Realtime");
    realtime.emit("INSERT", { id: inserted.id, customer_name: "Dado incorreto do canal" });
    await expect(admin.locator("#order-" + inserted.id)).toContainText("Recebido por Realtime");
    await expect(toast).toContainText("Recebido por Realtime");
    await expect(admin.locator("body")).not.toContainText("Dado incorreto do canal");
    await expect.poll(soundCount).toBe(2);
    realtime.emit("INSERT", { id: inserted.id });
    realtime.emit("UPDATE", { id: inserted.id, status: "Finalizado" });
    await admin.clock.runFor(3000);
    await expect(admin.locator("#order-" + inserted.id)).toHaveCount(1);
    assert.equal(notifications, 1);
    assert.equal(await soundCount(), 2);
    // UPDATE deve trazer o status oficial e remover a notificação obsoleta.
    await patch(inserted, "Em preparo");
    realtime.emit("UPDATE", { id: inserted.id, status: "Novo" });
    await expect(admin.locator("#order-" + inserted.id)).toHaveCount(0);
    await expect(toast).toHaveCount(0);
    console.log("PASS: carga imediata, histórico de todos os status, INSERT/UPDATE pela API e alerta único com áudio reproduzido.");

    realtime.fail();
    await expect.poll(() => realtimeErrors).toBeGreaterThan(0);
    await checkNoRealtimeError();
    await admin.clock.resume();
    const shop = await isolated.newPage();
    const shopReady = shop.waitForResponse((r) => r.url().endsWith("/api/store-status"));
    await shop.goto(base);
    await shopReady;
    await shop.locator('[data-product-id="copo-acai-puro-300ml"]').last().getByRole("button", { name: "Adicionar Copo de Açaí Puro (300ml)", exact: true }).click();
    await shop.getByRole("button", { name: /Ver sacola/ }).click();
    await shop.getByRole("button", { name: "Continuar", exact: true }).click();
    await shop.getByLabel("Nome", { exact: true }).fill("Recebido sem Realtime");
    await shop.getByLabel("Telefone", { exact: true }).fill("62999999999");
    await shop.getByRole("button", { name: "Retirada", exact: true }).click();
    // Cria logo após uma consulta, exercitando quase o intervalo completo.
    await waitGet();
    const saved = shop.waitForResponse((r) => r.url() === base + "/api/orders" && r.request().method() === "POST");
    await shop.getByRole("button", { name: "Finalizar pedido", exact: true }).click();
    const response = await saved;
    assert.equal(response.status(), 201);
    const receivedAt = Date.now();
    const polled = (await response.json()).order;
    await expect(admin.locator("#order-" + polled.id)).toContainText("Recebido sem Realtime", { timeout: 3000 });
    results.pollingReceiptMs = Date.now() - receivedAt;
    assert.ok(results.pollingReceiptMs <= 3000, JSON.stringify(results));
    await expect(toast).toContainText("Recebido sem Realtime");
    await expect.poll(soundCount).toBe(3);
    await waitGet();
    assert.equal(notifications, 2);
    assert.equal(await soundCount(), 3);
    await checkNoRealtimeError();
    await patch(polled, "Finalizado");
    await expect(admin.locator("#order-" + polled.id)).toHaveCount(0, { timeout: 4000 });
    await expect(toast).toHaveCount(0);
    await nav(/^Início$/).click();
    const orders = await getOrders();
    const today = new Date().toLocaleDateString("pt-BR");
    const finished = orders.filter((o) => o.status === "Finalizado" && new Date(o.created_at).toLocaleDateString("pt-BR") === today);
    const metric = (label) => admin.locator("article").filter({ has: admin.getByText(label, { exact: true }) }).locator("p");
    await expect(metric("Pedidos novos")).toHaveText(String(orders.filter((o) => o.status === "Novo").length));
    await expect(metric("Em preparo")).toHaveText(String(orders.filter((o) => o.status === "Em preparo").length));
    await expect(metric("Finalizados hoje")).toHaveText(String(finished.length));
    const currency = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n / 100);
    const revenue = finished.reduce((total, o) => total + o.total, 0);
    await expect(metric("Faturamento do dia")).toHaveText(currency(revenue));
    await expect(metric("Ticket médio")).toHaveText(currency(Math.round(revenue / finished.length)));
    console.log(`PASS: checkout real com Realtime em erro recebido por polling em ${results.pollingReceiptMs} ms; status, som único e indicadores corretos.`);

    await nav(/^Pedidos/).click();
    // Falha transitória da API preserva pedidos e desaparece após recuperação.
    const apiFailure = async (route) => route.request().method() === "GET"
      ? route.fulfill({ status: 503, json: { error: "Falha temporária de teste" } }) : route.continue();
    await admin.route(base + "/api/orders", apiFailure);
    await expect(admin.getByText("Falha temporária de teste").first()).toBeVisible({ timeout: 4000 });
    await expect(admin.locator("#order-" + histories[0].id)).toBeVisible();
    await admin.unroute(base + "/api/orders", apiFailure);
    await expect(admin.getByText("Falha temporária de teste")).toHaveCount(0, { timeout: 4000 });
    await expect(admin.getByText(`${orders.length} pedidos carregados.`, { exact: true })).toBeVisible();

    // O relógio do navegador já avançou nos testes de polling anteriores.
    await admin.clock.pauseAt(await admin.evaluate(() => Date.now() + 1000));
    await expect.poll(() => admin.evaluate(() => window.__orderAudit.active)).toBe(0);
    for (const event of ["focus", "visibilitychange"]) {
      const order = await create("Retorno " + event);
      await admin.evaluate((event) => {
        if (event === "focus") window.dispatchEvent(new Event(event));
        else {
          Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
          document.dispatchEvent(new Event(event));
        }
      }, event);
      await expect(admin.locator("#order-" + order.id)).toBeVisible();
    }
    await expect.poll(soundCount).toBe(5);
    assert.equal(notifications, 4);

    // Uma resposta lenta não deve permitir consultas concorrentes por polling/eventos.
    let release;
    const hold = new Promise((resolve) => { release = resolve; });
    let heldRequests = 0;
    const slow = async (route) => {
      heldRequests++;
      await hold;
      await route.continue();
    };
    await admin.route(base + "/api/orders", slow);
    const pending = waitGet();
    await admin.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => heldRequests).toBe(1);
    await admin.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await admin.clock.runFor(3100);
    assert.equal(heldRequests, 1);
    release();
    await pending;
    await admin.unroute(base + "/api/orders", slow);
    await checkNoRealtimeError();
    const audit = await admin.evaluate(() => window.__orderAudit);
    assert.equal(audit.maxActive, 1);
    assert.ok(audit.requests.every((request) => request.cache === "no-store"));
    results.requests = audit.requests.length;
    results.maxConcurrentRequests = audit.maxActive;
    results.newOrderNotifications = notifications;
    results.audioPlaysIncludingActivation = audit.plays;
    results.passed = true;
    await admin.screenshot({ path: join(artifacts, "admin-orders-polling.png") });
    await writeFile(join(artifacts, "admin-orders-result.json"), JSON.stringify(results, null, 2));
    console.log("PASS: recuperação de erro da API, foco/visibilidade, cache no-store e proteção contra consultas simultâneas.");
  } finally {
    await isolated.close();
  }
}
