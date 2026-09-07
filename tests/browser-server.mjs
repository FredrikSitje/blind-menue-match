// Local-only browser fixture: fake Auth, real PostgreSQL RPC authorization.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema public,auth to anon,authenticated;`);
await db.exec(await readFile('supabase/schema.sql','utf8'));
const users = ['a','b','outsider'].map((name,i)=>({id:`00000000-0000-4000-8000-00000000000${i+1}`, email:`${name}@example.test`,aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString()}));
for(const u of users) await db.query('insert into auth.users values($1,$2,now())',[u.id,u.email]);
await db.exec("insert into private.approved_users values('a@example.test','a'),('b@example.test','b')");
function session(user) {
  const exp=Math.floor(Date.now()/1000)+3600;
  const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,exp,aud:'authenticated',role:'authenticated'},'local-test-signature'].map((v,i)=>i<2?Buffer.from(JSON.stringify(v)).toString('base64url'):v).join('.');
  return {access_token:token,refresh_token:user.id,expires_in:3600,expires_at:exp,token_type:'bearer',user};
}
const rpcNames=new Set(['access_status','create_room','get_room_status','get_matches','get_own_submission','submit_picks','start_fill_round','finalize_dinners']);
createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:8767');
  const json=(code,data)=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
  try {
    let body=''; for await(const part of req) body+=part;
    const args=body?JSON.parse(body):{};
    let user; try {user=users.find(u=>u.id===JSON.parse(Buffer.from(req.headers.authorization?.split('.')[1]||'','base64url')).sub);}catch{}
    if(url.pathname==='/auth/v1/token') {
      const u=users.find(u=>u.email===args.email||u.id===args.refresh_token);
      return u && (args.password==='Local-test-only-123!'||args.refresh_token)?json(200,session(u)):json(400,{error:'invalid_grant',error_description:'Invalid login credentials'});
    }
    if(url.pathname==='/auth/v1/user') return user?json(200,user):json(401,{message:'not authenticated'});
    if(url.pathname==='/auth/v1/logout') {res.writeHead(204);return res.end();}
    if(url.pathname.startsWith('/rest/v1/rpc/')) {
      const name=url.pathname.split('/').pop();
      if(!rpcNames.has(name)) return json(404,{});
      const keys=Object.keys(args); if(keys.some(k=>!/^p_[a-z_]+$/.test(k)))return json(400,{});
      const result=await db.transaction(async tx=>{
        await tx.exec('set local role '+(user?'authenticated':'anon'));
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user?.id||'']);
        return (await tx.query(`select public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) result`,Object.values(args))).rows[0].result;
      }); return json(200,result);
    }
    if(url.pathname==='/blind-menue-match/config.js') {res.writeHead(200,{'content-type':'application/javascript'});return res.end("window.BMM_CONFIG={supabaseUrl:'http://127.0.0.1:8767',supabaseAnonKey:'local-test-anon-key',pollIntervalMs:300}");}
    const relative=url.pathname.replace(/^\/blind-menue-match\//,'')||'index.html';
    const path=resolve(relative); if(!path.startsWith(process.cwd()+'/'))return json(403,{});
    const content=await readFile(path);
    res.writeHead(200,{'content-type':({'.js':'application/javascript','.html':'text/html','.css':'text/css','.webmanifest':'application/manifest+json'})[extname(path)]||'application/octet-stream','cache-control':'no-store'});res.end(content);
  } catch(error) {json(error.code==='42501'?403:400,{message:error.message});}
}).listen(8767,'127.0.0.1',()=>console.log('Browser test fixture: http://127.0.0.1:8767/blind-menue-match/'));
