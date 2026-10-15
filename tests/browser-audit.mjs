import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { initialCatalog } from "@/data/menu";
import { heroAssets } from "@/data/experience";
import { buildSimpleCartLine, getCustomizableComboCups } from "@/lib/catalog/customization";

export async function runBrowserAudit({browser,context,page,base,state,db,artifacts,now,errors}) {
  const anon=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await anon.route("**/*",route=>["127.0.0.1","localhost"].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  const shop=await anon.newPage();
  shop.on("pageerror",error=>errors.push(error.message));
  const noOverflow=async(target,label)=>{
    assert.equal(await target.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label);
    const dialog=target.getByRole("dialog");
    if(await dialog.count()) assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false,label+" dialog");
  };
  try {
    for(const [path,method] of [["/api/orders","GET"],["/api/store-status","PATCH"],["/api/orders/11111111-1111-4111-8111-111111111111","PATCH"],["/api/orders/11111111-1111-4111-8111-111111111111/print","POST"],["/api/printing/settings","GET"],["/api/printing/settings","PATCH"],["/api/printing/test","POST"],["/api/qz/sign","POST"],["/api/qz/certificate","GET"],["/api/catalog","PUT"]]) {
      const response=await anon.request.fetch(base+path,{method,data:method==="GET"?undefined:{}});
      assert.equal(response.status(),401,path);
    }
    await shop.goto(base+"/admin/pedidos");
    await expect(shop).toHaveURL(/\/admin\/login$/);
    await shop.getByLabel("E-mail").fill("admin@example.test");
    await shop.getByLabel("Senha").fill("wrong-password");
    await shop.getByRole("button",{name:"Entrar",exact:true}).click();
    await expect(shop.locator("form").getByRole("alert")).toContainText("E-mail ou senha incorretos");
    await shop.getByLabel("E-mail").fill("member@example.test");
    await shop.getByLabel("Senha").fill("isolated-password-only");
    await shop.getByRole("button",{name:"Entrar",exact:true}).click();
    await expect(shop.locator("form").getByRole("alert")).toContainText("não tem permissão");
    assert.equal((await anon.request.get(base+"/api/orders")).status(),401);

    const adminReady = page.waitForResponse(response=>response.url().endsWith("/api/printing/settings"));
    await page.goto(base+"/admin/pedidos");
    await adminReady;
    await expect(page.getByRole("button",{name:"Fechar loja",exact:true}).first()).toBeEnabled();
    await page.getByRole("button",{name:"Fechar loja",exact:true}).first().click();
    await expect.poll(async()=>(await (await fetch(base+"/api/store-status")).json()).status).toBe("closed");
    await shop.goto(base);
    await expect(shop.getByText("No momento estamos fechados. Volte em breve 💜").first()).toBeVisible();
    const line=buildSimpleCartLine(initialCatalog.products[3],now);
    const payload={customerName:"Auditoria isolada",customerPhone:"62999999999",deliveryMethod:"pickup",paymentMethod:"pix",items:[{...line,quantity:1,totalPrice:line.unitPrice}],subtotal:line.unitPrice,total:line.unitPrice};
    const send=(body)=>anon.request.post(base+"/api/orders",{data:body});
    assert.equal((await send(payload)).status(),409);
    await page.getByRole("button",{name:"Abrir loja",exact:true}).first().click();
    await expect.poll(async()=>(await (await fetch(base+"/api/store-status")).json()).status).toBe("open");
    await expect(shop.getByText("No momento estamos fechados. Volte em breve 💜")).toHaveCount(0);
    state.statusUnavailable=true;
    await expect(shop.getByText(/Estamos verificando o funcionamento da loja/)).toBeVisible();
    const adminRecovered = page.waitForResponse(response=>response.url().endsWith("/api/printing/settings"));
    await page.reload();
    await adminRecovered;
    await expect(page).toHaveURL(/\/admin\/pedidos$/);
    await expect(page.getByRole("button",{name:"Abrir loja",exact:true}).first()).toBeEnabled();
    assert.equal((await send(payload)).status(),503);
    state.statusUnavailable=false;
    await page.getByRole("button",{name:"Abrir loja",exact:true}).first().click();
    await expect.poll(async()=>(await (await fetch(base+"/api/store-status")).json()).status).toBe("open");
    console.log("PASS: login, conta sem papel, APIs protegidas, abrir/fechar e admin com status indisponível.");

    for(const paymentMethod of ["pix","card","cash"]) {
      const id=crypto.randomUUID();
      const body={...payload,paymentMethod,changeFor:paymentMethod==="cash"?"50,00":"",requestId:id};
      const before=state.writes;
      const [first,second]=await Promise.all([send(body),send(body)]);
      assert.ok([200,201].includes(first.status()),await first.text());
      assert.ok([200,201].includes(second.status()),await second.text());
      assert.equal((await first.json()).order.id,(await second.json()).order.id);
      assert.equal(state.writes,before+1);
    }
    assert.equal((await send({...payload,customerPhone:"invalid"})).status(),400);
    assert.equal((await send({...payload,paymentMethod:"cash",changeFor:"1,00"})).status(),400);
    assert.equal((await send({...payload,paymentMethod:"bad"})).status(),400);
    const delivered=await send({...payload,deliveryMethod:"delivery",address:"Rua Teste",addressNumber:"7",neighborhood:"Centro",addressComplement:"Casa",addressReference:"Praça",notes:"Pedido exclusivamente isolado"});
    assert.equal(delivered.status(),201,await delivered.text());
    const deliveryId=(await delivered.json()).order.id;
    const saved=(await db.query("select * from orders where id=$1",[deliveryId])).rows[0];
    assert.match(saved.address,/7.*Casa.*Praça/);
    assert.equal((await context.request.patch(base+"/api/orders/"+deliveryId,{data:{status:"Em preparo",delivery_fee:500}})).status(),200);
    const edited=(await db.query("select * from orders where id=$1",[deliveryId])).rows[0];
    assert.equal(edited.total,saved.subtotal+500);assert.deepEqual(edited.items,saved.items);
    for(const data of [{delivery_fee:-1},{delivery_fee:"500"},{status:"invalid"},{}]) assert.equal((await context.request.patch(base+"/api/orders/"+deliveryId,{data})).status(),400);
    state.printingUnavailable=true;
    assert.equal((await context.request.post(base+"/api/orders/"+deliveryId+"/print",{data:{action:"enqueue-reprint"}})).status(),503);
    assert.equal((await db.query("select count(*)::int as n from orders where id=$1",[deliveryId])).rows[0].n,1);
    state.printingUnavailable=false;
    assert.equal((await context.request.post(base+"/api/orders/"+deliveryId+"/print",{data:{action:"enqueue-reprint"}})).status(),200);
    assert.equal((await context.request.post(base+"/api/orders/"+deliveryId+"/print",{data:{action:"claim"}})).status(),200);
    assert.equal((await context.request.post(base+"/api/orders/"+deliveryId+"/print",{data:{action:"complete"}})).status(),200);

    const catalog=structuredClone(initialCatalog);catalog.products[6].description+=" Teste isolado de publicação.";
    assert.equal((await context.request.put(base+"/api/catalog",{data:catalog})).status(),200);
    assert.match((await (await anon.request.get(base+"/api/catalog")).json()).catalog.products[6].description,/Teste isolado/);
    assert.equal((await context.request.put(base+"/api/catalog",{data:initialCatalog})).status(),200);
    console.log("PASS: pagamentos, entrega/retirada, validações, idempotência, histórico, impressão e catálogo compartilhado.");

    await shop.goto(base);
    for(const width of [1440,1024,768,390]) {
      await shop.setViewportSize({width,height:900});
      await noOverflow(shop,"loja "+width);
      const product=initialCatalog.products[0];
      await shop.locator('[data-product-id="'+product.id+'"]').last().getByRole("button",{name:"Personalizar",exact:true}).click();
      await noOverflow(shop,"personalizador "+width);
      await shop.getByRole("dialog").getByRole("button",{name:"Cancelar",exact:true}).click();
      await shop.screenshot({path:join(artifacts,"store-"+width+".png")});
      await page.setViewportSize({width,height:900});
      await noOverflow(page,"admin "+width);
      await page.screenshot({path:join(artifacts,"admin-"+width+".png")});
    }
    for(const [index,product] of initialCatalog.products.slice(0,3).entries()) {
      await shop.locator('[data-product-id="'+product.id+'"]').last().getByRole("button",{name:"Personalizar",exact:true}).click();
      const dialog=shop.getByRole("dialog");
      const free=dialog.locator("fieldset").filter({has:shop.locator("legend",{hasText:"Complementos grátis"})});
      const options=free.getByRole("button");
      const limit=index+3;
      for(let i=0;i<limit;i++)await options.nth(i).click();
      await expect(free.locator('[aria-pressed="true"]')).toHaveCount(limit);
      await expect(options.nth(limit)).toHaveAttribute("aria-disabled","true");
      await expect(dialog.getByText("Nutella",{exact:true})).toHaveCount(0);
      await dialog.getByRole("button",{name:"Adicionar M&M",exact:true}).click();
      await dialog.getByRole("button",{name:"Adicionar M&M",exact:true}).click();
      await dialog.getByRole("button",{name:"Diminuir M&M",exact:true}).click();
      await dialog.getByRole("button",{name:"Adicionar copo",exact:true}).click();
    }
    for(const product of initialCatalog.products.filter(p=>p.comboCups?.length)) {
      await shop.locator('[data-product-id="'+product.id+'"]').last().getByRole("button",{name:"Montar combo",exact:true}).click();
      const steps=getCustomizableComboCups(product).length;
      for(let i=0;i<steps;i++)await shop.getByRole("dialog").getByRole("button",{name:i===steps-1?"Adicionar ao carrinho":"Continuar",exact:true}).click();
    }
    await shop.getByRole("button",{name:/Ver sacola/}).click();
    const dialog=shop.getByRole("dialog");
    await dialog.getByRole("button",{name:"Aumentar "+initialCatalog.products[0].name,exact:true}).click();
    await dialog.getByRole("button",{name:"Diminuir "+initialCatalog.products[0].name,exact:true}).click();
    for(const width of [1440,1024,768,390]){await shop.setViewportSize({width,height:900});await noOverflow(shop,"sacola "+width);}
    await dialog.getByRole("button",{name:"Continuar",exact:true}).click();
    for(const width of [1440,1024,768,390]){await shop.setViewportSize({width,height:900});await noOverflow(shop,"checkout "+width);}
    await shop.getByLabel("Nome",{exact:true}).fill("Cliente de teste");
    await shop.getByLabel("Telefone",{exact:true}).fill("abc");
    await shop.getByRole("button",{name:"Retirada",exact:true}).click();
    await shop.getByRole("button",{name:"Finalizar pedido",exact:true}).click();
    await expect(dialog.getByRole("alert")).toContainText("telefone válido");
    await shop.getByRole("button",{name:"Voltar para a sacola"}).click();
    await dialog.getByRole("button",{name:"Limpar sacola",exact:true}).click();
    await expect(dialog).toContainText("Sua sacola está vazia");
    await dialog.getByRole("button",{name:"Fechar sacola",exact:true}).click();
    console.log("PASS: todos os combos, limites 3/4/5, extras, limpar sacola e seis interfaces em 1440/1024/768/390px.");

    for(const file of [heroAssets.video.mp4,...Object.values(heroAssets.poster).filter(v=>typeof v==="string"),"/manifest.json","/admin-manifest.json"]) {
      const response=await anon.request.get(base+file);assert.equal(response.status(),200,file);
    }
    for(const path of ["/manifest.json","/admin-manifest.json"]) {
      const manifest=await (await anon.request.get(base+path)).json();
      assert.equal(manifest.display,"standalone");
      for(const icon of manifest.icons)assert.equal((await anon.request.get(base+icon.src)).status(),200);
    }
    const broken=await shop.locator("img").evaluateAll(imgs=>imgs.filter(img=>img.complete&&img.naturalWidth===0).map(img=>img.src));
    assert.deepEqual(broken,[]);
    await expect(shop.locator("video").first()).toHaveAttribute("playsinline","");
    assert.equal(await shop.locator("video").first().evaluate(v=>v.muted&&v.loop&&v.autoplay),true);
    await shop.evaluate(async()=>{await navigator.serviceWorker.ready;});
    const cached=await shop.evaluate(async()=>{
      const keys=await caches.keys();const urls=[];
      for(const key of keys)for(const request of await (await caches.open(key)).keys())urls.push(new URL(request.url).pathname);
      return urls;
    });
    assert.equal(cached.some(p=>p.startsWith("/api/")||p.startsWith("/admin/")||p==="/"),false);
    await anon.setOffline(true);await shop.reload();
    await expect(shop.getByRole("heading",{name:"Estamos sem conexão"})).toBeVisible();
    await anon.setOffline(false);await shop.goto(base);
    await page.getByRole("button",{name:"Sair do painel"}).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    assert.equal((await context.request.get(base+"/api/orders")).status(),401);
    await page.goto(base+"/admin/pedidos");await expect(page).toHaveURL(/\/admin\/login$/);
    console.log("PASS: mídias, manifests, cache sem dados sensíveis, offline e logout.");
  } catch(error) {
    await shop.screenshot({path:join(artifacts,"audit-failure.png")}).catch(()=>undefined);
    await writeFile(join(artifacts,"audit-failure.txt"),error.stack||String(error));
    throw error;
  } finally {state.statusUnavailable=false;state.printingUnavailable=false;await anon.close();}
}
