import { createServer } from "node:http";
import { insertOrder } from "./database.mjs";

export function createIsolatedBackend(db) {
  const state = { writes: 0, statusUnavailable: false, printingUnavailable: false };
  const admin = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", email: "admin@example.test", role: "authenticated", app_metadata: { role: "admin" }, user_metadata: {}, created_at: new Date().toISOString() };
  const member = { ...admin, id: "22222222-2222-4222-8222-222222222222", email: "member@example.test", app_metadata: {} };
  const token = (user) => Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url")+"."+Buffer.from(JSON.stringify({sub:user.id,role:"authenticated",aud:"authenticated",exp:Math.floor(Date.now()/1000)+864000,iat:Math.floor(Date.now()/1000),app_metadata:user.app_metadata})).toString("base64url")+".isolated-signature";
  const adminToken=token(admin), memberToken=token(member);
  let queue=Promise.resolve();
  async function handle(req,res) {
    res.setHeader("Content-Type","application/json");
    res.setHeader("Access-Control-Allow-Origin","*");
    res.setHeader("Access-Control-Allow-Headers","*");
    res.setHeader("Access-Control-Allow-Methods","GET,POST,PATCH,PUT,OPTIONS");
    if(req.method==="OPTIONS"){res.end();return;}
    const send=(value,status=200)=>{res.statusCode=status;res.end(JSON.stringify(value));};
    try {
      const url=new URL(req.url,"http://localhost");
      let raw="";for await(const chunk of req)raw+=chunk;
      const body=raw?JSON.parse(raw):{};
      const bearer=req.headers.authorization?.replace(/^Bearer /,"");
      const user=bearer===adminToken?admin:bearer===memberToken?member:null;
      if(url.pathname==="/auth/v1/token"){
        const account=body.email===admin.email?admin:body.email===member.email?member:null;
        if(!account||body.password!=="isolated-password-only")return send({msg:"Invalid login credentials"},400);
        return send({access_token:account===admin?adminToken:memberToken,refresh_token:"isolated-refresh-"+account.id,expires_in:864000,token_type:"bearer",user:account});
      }
      if(url.pathname==="/auth/v1/user")return user?send(user):send({msg:"Unauthorized"},401);
      if(url.pathname==="/auth/v1/logout")return send({});
      const privateKey=req.headers.apikey==="sb_secret_test_only";
      const role=privateKey?"service_role":user?"authenticated":"anon";
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user?.id||""]);
      await db.exec("set role "+role);
      if(url.pathname.startsWith("/rest/v1/rpc/")){
        if(state.printingUnavailable)return send({code:"PGRST202"},503);
        const fn=url.pathname.split("/").at(-1);
        const args={get_print_settings:[],set_print_automatic_enabled:[body.p_enabled],request_test_print:[body.p_requested_by],request_order_reprint:[body.p_order_id,body.p_requested_by],claim_order_print:[body.p_order_id],complete_order_print:[body.p_order_id],fail_order_print:[body.p_order_id,body.p_error],register_order_reprint:[body.p_order_id]}[fn];
        if(!args)return send({},404);
        const result=await db.query("select * from public."+fn+"("+args.map((_,i)=>"$"+(i+1)).join(",")+")",args);
        return send(["get_print_settings","set_print_automatic_enabled"].includes(fn)?result.rows:result.rows[0]?.[fn]);
      }
      const table=url.pathname.split("/").at(-1);
      if(!["store_settings","catalog_settings","orders"].includes(table))return send({},404);
      if(table==="store_settings"&&state.statusUnavailable&&req.method==="GET")return send({code:"TEST_UNAVAILABLE"},503);
      if(table==="orders"&&req.method==="POST"){
        if(!privateKey)return send({code:"42501"},403);
        const order=await insertOrder(db,body);state.writes++;return send(order,201);
      }
      const filters=[],values=[];
      for(const column of ["id","request_id"])if(url.searchParams.has(column)){
        const condition=url.searchParams.get(column);if(!condition.startsWith("eq."))throw new Error("Unsupported filter");
        values.push(condition.slice(3));filters.push(column+"=$"+values.length);
      }
      let sql="select * from "+table;
      if(req.method==="PATCH"){
        const permitted=table==="orders"?["status","updated_at","delivery_fee","total"]:table==="store_settings"?["status","updated_at"]:["snapshot","updated_at"];
        const assignments=Object.entries(body).map(([key,value])=>{
          if(!permitted.includes(key))throw new Error("Unsupported update");
          values.push(typeof value==="object"&&value!==null?JSON.stringify(value):value);
          return key+"=$"+values.length;
        });
        sql="update "+table+" set "+assignments.join(",");
      }
      if(filters.length)sql+=" where "+filters.join(" and ");
      if(req.method==="PATCH")sql+=" returning *";
      else if(table==="orders")sql+=" order by created_at desc";
      const rows=(await db.query(sql,values)).rows;
      const single=req.headers.accept?.includes("application/vnd.pgrst.object+json");
      return send(single?(rows[0]??null):rows);
    } catch(error){send({message:"Isolated database error",code:error.code||"TEST_ERROR"},error.code==="23505"?409:500);}
    finally{await db.exec("reset role");}
  }
  const backend=createServer((req,res)=>{queue=queue.then(()=>handle(req,res)).catch(()=>{if(!res.writableEnded){res.statusCode=500;res.end("{}");}});});
  return {backend,state,adminToken,memberToken};
}
