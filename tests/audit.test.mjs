import test from "node:test";
import assert from "node:assert/strict";
import { getPublicSupabaseConfig, validateSupabaseUrl, validatePublicKey } from "@/lib/supabase/config";
import { cashAmount, validateCheckout } from "@/lib/checkout/validation";
import { validateCatalog } from "@/lib/catalog/validation";
import { initialCatalog } from "@/data/menu";
import { isStoreStatus, DEFAULT_STORE_STATUS } from "@/data/store-status";
import { createTestDatabase, insertOrder } from "./database.mjs";

const checkout = { customerName: "Cliente teste", customerPhone: "(62) 99999-9999", deliveryMethod: "pickup", paymentMethod: "pix" };
test("configuração valida URL e chave pública, rejeita secrets e prioriza publishable", () => {
  const jwt = (role) => "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({role})).toString("base64url") + ".signature";
  assert.equal(validateSupabaseUrl("https://example.supabase.co"), "https://example.supabase.co");
  assert.equal(validatePublicKey("sb_publishable_test_only"), "sb_publishable_test_only");
  assert.equal(validatePublicKey(jwt("anon")), jwt("anon"));
  for (const value of ["", "sb_secret_test_only", jwt("service_role"), "key with spaces"]) assert.throws(() => validatePublicKey(value));
  for (const url of ["", "sb_publishable_invalid", "https://exa mple.co", "https://example.com/path", "http://example.com", "https://user:password@example.com"]) assert.throws(() => validateSupabaseUrl(url));
  const previous = { ...process.env };
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_new";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt("anon");
    assert.equal(getPublicSupabaseConfig().key, "sb_publishable_new");
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";
    assert.equal(getPublicSupabaseConfig().key, jwt("anon"));
  } finally { process.env = previous; }
});
test("checkout valida entrega, retirada, telefone, enumerações, troco e dados longos", () => {
  for (const paymentMethod of ["pix","card","cash"]) assert.equal(validateCheckout({ ...checkout, paymentMethod },1299).paymentMethod, paymentMethod);
  const delivery = validateCheckout({ ...checkout, deliveryMethod:"delivery", address:"Rua A", addressNumber:"42", neighborhood:"Centro", addressComplement:"Casa 2", addressReference:"Praça" },1299);
  assert.match(delivery.address, /42.*Casa 2.*Praça/);
  for (const patch of [{customerName:""}, {customerPhone:"abc"}, {customerPhone:"123"}, {deliveryMethod:"invalid"}, {paymentMethod:"crypto"}, {deliveryMethod:"delivery",address:"Rua A"}, {deliveryMethod:"delivery",address:"Rua A",neighborhood:"Centro"}, {paymentMethod:"cash",changeFor:"10"}, {paymentMethod:"cash",changeFor:"NaN"}, {notes:"a".repeat(1001)}]) assert.throws(() => validateCheckout({...checkout,...patch},1299));
  assert.equal(validateCheckout({...checkout,paymentMethod:"cash",changeFor:"50,00"},1299).changeFor,"50,00");
  assert.equal(validateCheckout({...checkout,changeFor:"invalid"},1299).changeFor,"");
  assert.equal(cashAmount("R$ 50,25"),5025);
  assert.equal(cashAmount("1e6"),null);
  assert.equal(cashAmount("-1"),null);
});
test("catálogo valida dados publicados e mantém preços e remoção de Nutella", () => {
  const draft = structuredClone(initialCatalog);
  draft.products[0].price = 1;
  draft.complementGroups[0].options.push({id:"nutella",name:"Nutella",price:0});
  const catalog=validateCatalog(draft);
  assert.equal(catalog.products[0].price,1499);
  assert.equal(catalog.complementGroups.flatMap(g=>g.options).some(o=>o.id==="nutella"),false);
  for (const patch of [{price:-1},{price:NaN},{categoryId:"unknown"},{comboCups:[{id:"x",size:"1L",label:"X"}]}]) {
    const invalid=structuredClone(initialCatalog);Object.assign(invalid.products[0],patch);
    assert.throws(()=>validateCatalog(invalid));
  }
});
test("status aceita somente open/closed e o estado inicial é open", () => {
  assert.equal(DEFAULT_STORE_STATUS,"open");
  for (const value of ["open","closed"]) assert.equal(isStoreStatus(value),true);
  for (const value of [null,undefined,"unknown","aberta","false"]) assert.equal(isStoreStatus(value),false);
});
test("RLS restringe status, catálogo, pedidos e RPCs ao administrador/backend", async () => {
  const db=await createTestDatabase();
  const runAs=async(role,id,action)=>{
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||""]);
    await db.exec("set role "+role);
    try{return await action();}finally{await db.exec("reset role");}
  };
  try {
    await runAs("anon",null,async()=>{
      assert.equal((await db.query("select status from store_settings")).rows[0].status,"open");
      await assert.rejects(()=>db.exec("update store_settings set status='closed'"));
      await assert.rejects(()=>db.exec("select * from orders"));
      await assert.rejects(()=>db.exec("select public.get_print_settings()"));
    });
    await runAs("authenticated","22222222-2222-4222-8222-222222222222",async()=>{
      assert.equal((await db.query("update store_settings set status='closed' returning *")).rows.length,0);
      assert.equal((await db.query("update catalog_settings set snapshot='{}' returning *")).rows.length,0);
      assert.equal((await db.query("select * from orders")).rows.length,0);
    });
    await runAs("authenticated","11111111-1111-4111-8111-111111111111",async()=>{
      assert.equal((await db.query("update store_settings set status='closed' returning status")).rows[0].status,"closed");
      assert.equal((await db.query("update store_settings set status='open' returning status")).rows[0].status,"open");
      assert.equal((await db.query("update catalog_settings set snapshot=null returning id")).rows[0].id,"main");
      await assert.rejects(()=>db.exec("update orders set subtotal=0"));
      await assert.rejects(()=>db.exec("select public.request_test_print('x')"));
    });
    await db.exec("update auth.users set raw_app_meta_data='{}' where id='11111111-1111-4111-8111-111111111111'");
    await runAs("authenticated","11111111-1111-4111-8111-111111111111",async()=>{
      assert.equal((await db.query("update store_settings set status='closed' returning *")).rows.length,0);
    });
  } finally {await db.close();}
});
test("falha na fila de impressão não desfaz pedido; request_id impede duplicação", async()=>{
  const db=await createTestDatabase();
  try{
    await db.exec(`update print_settings set automatic_enabled=true;
      create function public.test_print_failure() returns trigger language plpgsql as $$begin raise exception 'isolated test'; end;$$;
      create trigger test_print_failure before insert on print_jobs for each row execute function public.test_print_failure();`);
    const order={items:[{unitPrice:1299,quantity:1,totalPrice:1299}],subtotal:1299,total:1299,status:"Novo",request_id:"33333333-3333-4333-8333-333333333333"};
    const saved=await insertOrder(db,order);
    const row=(await db.query("select * from orders where id=$1",[saved.id])).rows[0];
    assert.equal(row.total,1299);
    assert.equal(row.print_status,"failed");
    await assert.rejects(()=>insertOrder(db,order));
    assert.equal((await db.query("select count(*)::int as n from orders")).rows[0].n,1);
    await assert.rejects(()=>db.query("update orders set request_id=null where id=$1",[saved.id]));
  }finally{await db.close();}
});
