// Somente leitura contra o Supabase configurado; não cria pedidos nem altera status.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const base="http://127.0.0.1:3148";
if(await fetch(base,{signal:AbortSignal.timeout(800)}).catch(()=>null))throw new Error("Porta 3148 em uso.");
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3148"],{windowsHide:true,stdio:["ignore","pipe","pipe"]});
let logs="";server.stdout.on("data",chunk=>logs+=chunk);server.stderr.on("data",chunk=>logs+=chunk);
try {
  for(let i=0;i<30;i++){
    if(server.exitCode!==null)throw new Error("Servidor de produção não iniciou.");
    if(await fetch(base+"/api/promotion",{signal:AbortSignal.timeout(2000)}).then(r=>r.ok).catch(()=>false))break;
    await delay(500);
  }
  const status=await fetch(base+"/api/store-status",{signal:AbortSignal.timeout(15000)});
  assert.equal(status.status,200);
  const data=await status.json();
  assert.ok(["open","closed"].includes(data.status));
  assert.match(status.headers.get("cache-control"),/no-store/);
  const home=await fetch(base);assert.equal(home.status,200);
  const admin=await fetch(base+"/admin/pedidos",{redirect:"manual"});assert.equal(admin.status,307);
  const login=await fetch(base+"/admin/login");assert.equal(login.status,200);
  const orders=await fetch(base+"/api/orders");assert.equal(orders.status,401);
  const report={home:home.status,storeStatus:status.status,status:data.status,adminRedirect:admin.status,login:login.status,unauthenticatedOrders:orders.status,writes:0};
  await mkdir(resolve("local-data/audit"),{recursive:true});
  await writeFile(resolve("local-data/audit/production-smoke.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
} finally {
  if(server.pid&&server.exitCode===null){
    if(process.platform==="win32"){
      const stop=spawn("taskkill",["/pid",String(server.pid),"/T","/F"],{windowsHide:true,stdio:"ignore"});
      await new Promise(resolve=>stop.on("exit",resolve));
    }else server.kill("SIGTERM");
  }
  await mkdir(resolve("local-data/audit"),{recursive:true});
  await writeFile(resolve("local-data/audit/production-smoke.log"),logs);
}
