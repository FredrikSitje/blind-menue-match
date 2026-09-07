import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('service worker caches only public same-origin assets, never account or room URLs', async () => {
  const handlers = {}, cached = [];
  const scope = 'https://menu.example.test/';
  const context = {
    self: { registration: {scope}, location: {origin: new URL(scope).origin}, addEventListener: (name,fn)=>handlers[name]=fn },
    URL, Set, Request, fetch: async request => ({ok:true,clone:()=>request}),
    caches: {open:async()=>({put:async request=>cached.push(request.url)}),match:async()=>null},
  };
  vm.runInNewContext(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),context);
  for (const url of ['https://project.supabase.co/auth/v1/user','https://project.supabase.co/rest/v1/submissions',scope+'?room=secret&key=secret']) {
    let intercepted = false;
    handlers.fetch({request:new Request(url),respondWith:()=>intercepted=true});
    assert.equal(intercepted,false,url);
  }
  let response, background;
  handlers.fetch({request:new Request(scope+'js/app.js'),respondWith:p=>response=p,waitUntil:p=>background=p});
  await response; await background;
  assert.deepEqual(cached,[scope+'js/app.js']);
  let posted=false;
  handlers.fetch({request:new Request(scope+'js/app.js',{method:'POST'}),respondWith:()=>posted=true});
  assert.equal(posted,false);
});
