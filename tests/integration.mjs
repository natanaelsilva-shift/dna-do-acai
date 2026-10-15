import "./register.mjs";
import assert from "node:assert/strict";
import { createIsolatedBackend } from "./backend.mjs";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readdir, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";
import { createTestDatabase } from "./database.mjs";
import { initialCatalog } from "@/data/menu";
import { runBrowserAudit } from "./browser-audit.mjs";
import { runAdminOrdersAudit } from "./admin-orders.mjs";
import { buildCustomizedCupCartLine, buildSimpleCartLine, getDefaultSelections } from "@/lib/catalog/customization";

const artifacts = resolve("local-data/promotion-tests");
await mkdir(artifacts, { recursive: true });
await writeFile(join(artifacts, "tsconfig.json"), JSON.stringify({
  extends: "../../tsconfig.json",
  include: ["../../next-env.d.ts", "../../src/**/*.ts", "../../src/**/*.tsx", ".next/dev/types/**/*.ts"],
}, null, 2));
const clockFile = join(artifacts, "clock.json");
const start = Date.now() - 60_000;
const end = start + 72 * 60 * 60 * 1000;
await writeFile(clockFile, JSON.stringify({ now: start + 60_000, realTime: Date.now() }));
const db = await createTestDatabase();
const { backend, state } = createIsolatedBackend(db);
await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
const backendUrl = `http://127.0.0.1:${backend.address().port}`;
const env = {
  ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_SUPABASE_URL: backendUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
  SUPABASE_SECRET_KEY: "sb_secret_test_only", DNA_TEST_CLOCK_FILE: clockFile,
  NEXT_PUBLIC_DNA_PROMOTION_TEST_START_AT: new Date(start).toISOString(),
  NEXT_PUBLIC_DNA_PROMOTION_TEST_END_AT: new Date(end).toISOString(),
  NODE_OPTIONS: `--import="${new URL("../tests/server-clock.mjs", import.meta.url).href}"`,
};
// Não herdar credenciais privadas reais nos testes.
delete env.SUPABASE_SERVICE_ROLE_KEY;
delete env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const port = 3147;
const base = `http://127.0.0.1:${port}`;
const occupied = await fetch(`${base}/api/promotion`, { signal: AbortSignal.timeout(1000) }).catch(() => null);
if (occupied) {
  backend.closeAllConnections();
  backend.close();
  await db.close();
  throw new Error("A porta 3147 já está em uso. Encerre o servidor de teste anterior.");
}
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
  { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
const logStream = createWriteStream(join(artifacts, "server.log"));
server.stdout.on("data", (chunk) => { logs += chunk; logStream.write(chunk); });
server.stderr.on("data", (chunk) => { logs += chunk; logStream.write(chunk); });
let browser;
const errors = [];
try {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    const response = await fetch(`${base}/api/promotion`, { signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (response?.ok) break;
    if (response?.status === 500 || attempt === 89) throw new Error("Servidor de teste não iniciou. " + logs.slice(-4000));
    await delay(1000);
  }
  let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (!executablePath && process.platform === "win32") {
    const root = join(process.env.LOCALAPPDATA, "ms-playwright");
    const installed = (await readdir(root)).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse();
    for (const name of installed) {
      const candidate = join(root, name, "chrome-win64/chrome.exe");
      if (await stat(candidate).catch(() => null)) { executablePath = candidate; break; }
    }
  }
  browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, reducedMotion: "reduce" });
  // Toda comunicação de teste fica no loopback; o bundle só recebe chaves falsas.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname) ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const shopReady = page.waitForResponse((response) => response.url().endsWith("/api/store-status"));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await shopReady;
  await expect(page.locator("[data-promotion-countdown]")).toBeVisible();
  const prices = [1299, 1899, 2599, 1199, 1699, 2299];
  const money = (cents) => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
  for (const [index, product] of initialCatalog.products.slice(0, 6).entries()) {
    const card = page.locator(`[data-product-id="${product.id}"]`).last();
    await expect(card).toHaveAttribute("data-promotion", "true");
    await expect(card.locator(".dna-promo-badge")).toHaveText("PROMOÇÃO");
    await expect(card.locator(".line-through")).toContainText(money(product.price));
    await expect(card.locator(".dna-promo-price")).toContainText(money(prices[index]));
    if (product.customizable) {
      await card.getByRole("button", { name: "Personalizar", exact: true }).click();
      await expect(page.getByRole("dialog").locator("footer")).toContainText(money(prices[index]));
      await page.getByRole("button", { name: "Adicionar copo", exact: true }).click();
    } else await card.getByRole("button", { name: `Adicionar ${product.name}`, exact: true }).click();
  }
  await expect(page.getByRole("radiogroup", { name: "Tamanho do copo" })).toContainText("18,99");
  await page.locator("#tamanhos").screenshot({ path: join(artifacts, "active-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#acai-puro").screenshot({ path: join(artifacts, "active-mobile.png") });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.getByRole("button", { name: /Ver sacola/ }).click();
  await expect(page.getByRole("dialog")).toContainText("109,94");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Teste isolado");
  await page.getByLabel("Telefone", { exact: true }).fill("62999999999");
  await page.getByRole("button", { name: "Retirada", exact: true }).click();
  console.log("PASS: seis cards, selo, riscos, personalizador, builder e carrinho.");

  const item = buildSimpleCartLine(initialCatalog.products[3], start + 1);
  // Calcula os valores pela janela do teste sem alterar os preços do catálogo.
  item.unitPrice = 1199;
  const payload = { customerName: "Snapshot teste", customerPhone: "62999999999", deliveryMethod: "pickup",
    paymentMethod: "pix", items: [{ ...item, quantity: 1, totalPrice: 1199 }], subtotal: 1199, total: 1199 };
  const send = (body) => fetch(`${base}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let response = await send(payload);
  assert.equal(response.status, 201, await response.text());
  assert.equal(state.writes, 1);
  response = await send({ ...payload, items: [{ ...payload.items[0], unitPrice: 1, totalPrice: 1 }], subtotal: 1, total: 1 });
  assert.equal(response.status, 409);
  assert.equal(state.writes, 1);
  const product = initialCatalog.products[0];
  const custom = buildCustomizedCupCartLine(product, { ...getDefaultSelections(initialCatalog.complementGroups), "turbine-seu-acai": ["m-m-extra"] }, initialCatalog.complementGroups, start + 1);
  custom.unitPrice = 1649;
  response = await send({ ...payload, items: [{ ...custom, quantity: 1, totalPrice: 1649 }], subtotal: 1649, total: 1649 });
  assert.equal(response.status, 201, await response.text());
  console.log("PASS: API salva preço + extras no PostgreSQL isolado e recusa adulteração.");

  // Faz só o backend atravessar o fim. O cliente ainda está com a oferta aberta.
  await writeFile(clockFile, JSON.stringify({ now: end + 1, realTime: Date.now() }));
  const writesBefore = state.writes;
  await page.getByRole("button", { name: "Finalizar pedido", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("promoção deste item terminou");
  await expect(page.getByRole("dialog").locator("footer")).toContainText("122,94");
  assert.equal(state.writes, writesBefore);
  await expect(page.locator("[data-promotion=true]")).toHaveCount(0);
  await expect(page.locator("[data-promotion-countdown]")).toHaveCount(0);
  await page.getByRole("button", { name: "Finalizar pedido", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("Pedido enviado com sucesso");
  assert.equal(state.writes, writesBefore + 1);
  const stored = (await db.query("select * from orders order by order_number")).rows;
  assert.equal(stored[0].items[0].unitPrice, 1199);
  assert.equal(stored[1].items[0].unitPrice, 1649);
  assert.deepEqual(stored[2].items.map((item) => item.unitPrice), initialCatalog.products.slice(0, 6).map((p) => p.price));
  assert.equal(stored[2].total, 12294);
  console.log("PASS: checkout vencido retorna 409, exige revisão, salva normal; histórico intacto.");

  await page.getByRole("button", { name: "Voltar ao cardápio", exact: true }).click();
  for (const product of initialCatalog.products.slice(0, 6)) {
    const card = page.locator(`[data-product-id="${product.id}"]`).last();
    await expect(card.locator(".dna-price")).toContainText(money(product.price));
    await expect(card.locator(".line-through")).toHaveCount(0);
    await expect(card.locator(".dna-promo-price")).toHaveCount(0);
  }
  await page.locator("#tamanhos").screenshot({ path: join(artifacts, "expired-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#acai-puro").screenshot({ path: join(artifacts, "expired-mobile.png") });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

  await page.goto(`${base}/admin/pedidos`);
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel("E-mail").fill("admin@example.test");
  await page.getByLabel("Senha").fill("isolated-password-only");
  const adminReady = page.waitForResponse((response) => response.url().endsWith("/api/printing/settings"));
  await page.getByRole("button", {name:"Entrar",exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/pedidos$/);
  await adminReady;
  await page.getByRole("navigation").getByRole("button", { name: /^Pedidos/ }).click();
  await expect(page.getByText("Snapshot teste").first()).toBeVisible();
  await expect(page.getByText(/Unitário:.*11,99/).first()).toBeVisible();
  assert.equal((await db.query("select items from orders order by order_number limit 1")).rows[0].items[0].unitPrice, 1199);
  await page.getByRole("navigation").getByRole("button", { name: "Produtos", exact: true }).click();
  await expect(page.getByText("Promoção de 72 horas · Encerrada")).toBeVisible();
  console.log("PASS: painel recebe os pedidos com snapshots preservados; mobile sem overflow.");

  // Outro cliente deixa card/personalizador/carrinho abertos perto do fim.
  await writeFile(clockFile, JSON.stringify({ now: end - 15_000, realTime: Date.now() }));
  const auto = await context.newPage();
  await auto.clock.setFixedTime(new Date("2000-01-01T00:00:00Z"));
  await auto.goto(base, { waitUntil: "domcontentloaded" });
  await expect(auto.locator("[data-promotion=true]").first()).toBeVisible();
  await auto.locator('[data-product-id="copo-acai-puro-300ml"]').last().getByRole("button", { name: "Adicionar Copo de Açaí Puro (300ml)", exact: true }).click();
  await auto.getByRole("button", { name: /Ver sacola/ }).click();
  await expect(auto.getByRole("dialog")).toContainText("11,99");
  const customizer = await context.newPage();
  await customizer.goto(base, { waitUntil: "domcontentloaded" });
  await customizer.locator('[data-product-id="dna-explosao-300ml"]').last().getByRole("button", { name: "Personalizar", exact: true }).click();
  await expect(customizer.getByRole("dialog").locator("footer")).toContainText("12,99");
  await expect(auto.locator("[data-promotion=true]")).toHaveCount(0, { timeout: 20_000 });
  await expect(auto.locator("[data-promotion-countdown]")).toHaveCount(0);
  await expect(auto.getByRole("dialog")).toContainText("12,99");
  await expect(auto.getByRole("dialog").getByRole("status")).toContainText("promoção deste item terminou");
  await expect(customizer.getByRole("dialog").locator("footer")).toContainText("14,99");
  console.log("PASS: cards, personalizador e carrinho expiram sem F5, inclusive com relógio local incorreto.");
  await auto.close(); await customizer.close();
  await runAdminOrdersAudit({ browser, context, base, db, artifacts, now: end + 1, errors });
  await runBrowserAudit({browser,context,page,base,state,db,artifacts,now:end+1,errors});
  assert.deepEqual(errors, []);
  await writeFile(join(artifacts, "result.json"), JSON.stringify({ passed: true, browserErrors: errors, orders: stored.map((o) => ({ total: o.total, prices: o.items.map((i) => i.unitPrice) })) }, null, 2));
} catch (error) {
  await writeFile(join(artifacts, "failure.txt"), error.stack || String(error));
  throw error;
} finally {
  await browser?.close();
  if (server.pid && server.exitCode === null) {
    if (process.platform === "win32") {
      const stop = spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      const code = await new Promise((resolve) => stop.on("exit", resolve));
      if (code !== 0) console.error(`Não foi possível encerrar o processo de teste ${server.pid}.`);
    } else server.kill("SIGTERM");
  }
  backend.closeAllConnections();
  await new Promise((resolve) => backend.close(resolve));
  await db.close();
  logStream.end();
}
