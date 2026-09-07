import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { stablePick } from '../js/shopping.js';

const db = new PGlite();
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const outsider = '00000000-0000-4000-8000-000000000003';
const unconfirmed = '00000000-0000-4000-8000-000000000004';
const keyA = 'ka_test_secret_123456';
const keyB = 'kb_test_secret_123456';
const ids = (...n) => n.map(i => `m${String(i).padStart(2,'0')}`);
async function as(user, query, args = []) {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user || '']);
    return (await tx.query(query,args)).rows;
  });
}
async function rpc(user, name, args = []) {
  return (await as(user, `select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args))[0].result;
}
const denied = fn => assert.rejects(fn, e => e.code === '42501');
const invalid = fn => assert.rejects(fn, e => e.code === '22023');
const create = room => rpc(A,'create_room',[room,keyA,keyB]);
const vote = (who,room,picks,lock=true) => rpc(who,'submit_picks',[room,who===A?'a':'b',who===A?keyA:keyB,picks,lock]);

before(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;`);
  const legacy = execFileSync('git',['show','b97675b:supabase/schema.sql'],{encoding:'utf8'});
  await db.exec(legacy.replace('create extension if not exists "pgcrypto";', ''));
  await db.exec(`grant all on public.rooms,public.submissions to anon,authenticated;
    insert into public.rooms(id,key_a,key_b) values ('rlegacy123','legacy-a','legacy-b');`);
  const schema = readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');
  await db.exec(schema);
  await db.exec(schema); // Safe to reapply; no old grants or policies reappear.
  await db.query('insert into auth.users values ($1,$2,now()),($3,$4,now()),($5,$6,now()),($7,$8,null)',
    [A,'a@example.test',B,'b@example.test',outsider,'other@example.test',unconfirmed,'pending@example.test']);
  await db.exec("insert into private.approved_users values ('a@example.test','a'),('b@example.test','b')");
});
after(async () => db.close());

test('migration retains rooms, denies anonymous RPCs and all raw table access', async () => {
  assert.equal((await db.query("select count(*)::int n from public.rooms where id='rlegacy123'")).rows[0].n,1);
  for (const who of [null,A,B,outsider]) {
    for (const table of ['rooms','submissions']) await denied(() => as(who,`select * from public.${table}`));
    await denied(() => as(who,"update public.rooms set key_a='stolen'"));
  }
  for (const [name,args] of [
    ['access_status',[]],['create_room',['rnewroom12',keyA,keyB]],['get_room_status',['rlegacy123']],
    ['get_matches',['rlegacy123']],['get_own_submission',['rlegacy123','a',keyA,0]],
    ['submit_picks',['rlegacy123','a',keyA,ids(1),true]],
    ['start_fill_round',['rlegacy123','a',keyA,[]]],['finalize_dinners',['rlegacy123','a',keyA,[],[]]],
    ['verify_partner',['rlegacy123','a',keyA]],
  ]) await denied(() => rpc(null,name,args));
  await denied(() => as(A,'select * from private.approved_users'));
  await denied(() => as(A,"select private.round_matches('rlegacy123',0)"));
});

test('only approved, confirmed accounts are members; partner cannot be changed by link', async () => {
  assert.equal((await rpc(A,'access_status')).partner,'a');
  assert.equal((await rpc(B,'access_status')).partner,'b');
  for (const who of [outsider,unconfirmed]) {
    await denied(() => rpc(who,'access_status'));
    await denied(() => rpc(who,'get_matches',['rlegacy123']));
    await denied(() => rpc(who,'create_room',['rblocked12',keyA,keyB]));
  }
  await db.exec("update private.approved_users set email='pending@example.test' where partner='b'");
  await denied(() => rpc(unconfirmed,'access_status'));
  await db.exec("update private.approved_users set email='b@example.test' where partner='b'");
  await create('ridentity1');
  await denied(() => rpc(A,'get_own_submission',['ridentity1','b',keyB,0]));
  await denied(() => rpc(A,'submit_picks',['ridentity1','b',keyB,ids(1,2,3,4,5,6,7,8),true]));
  await denied(() => rpc(B,'get_own_submission',['ridentity1','a',keyA,0]));
  await denied(() => rpc(A,'get_own_submission',['ridentity1','a','wrong',0]));
});

test('eight valid picks, immutable ballots, no matches until both lock, only intersection', async () => {
  const room='rvoting123'; await create(room);
  await invalid(() => vote(A,room,ids(1,2)));
  await invalid(() => vote(A,room,ids(1,2,3,4,5,6,7,7)));
  await invalid(() => vote(A,room,ids(1,2,3,4,5,6,7,21)));
  await invalid(() => vote(A,room,[...ids(1,2,3,4,5,6,7),null]));
  await vote(A,room,ids(1,2,3,4,5,6,7,8));
  assert.deepEqual((await rpc(B,'get_matches',[room])).matches,[]);
  const status=await rpc(B,'get_room_status',[room]);
  assert.equal(status.both_locked,false);
  assert.equal(status.key_a,undefined); assert.equal(status.menu_ids,undefined);
  await invalid(() => rpc(A,'finalize_dinners',[room,'a',keyA,ids(1,2,3,4,5),[]]));
  await vote(A,room,ids(9,10,11,12,13,14,15,16));
  assert.deepEqual((await rpc(A,'get_own_submission',[room,'a',keyA,0])).menu_ids,ids(1,2,3,4,5,6,7,8));
  await vote(B,room,ids(4,5,6,7,8,9,10,11));
  const matches=await rpc(B,'get_matches',[room]);
  assert.equal(matches.ready,true); assert.deepEqual(matches.matches,ids(4,5,6,7,8));
  await invalid(() => rpc(A,'finalize_dinners',[room,'a',keyA,ids(1,2,3,4,5),[]]));
  await rpc(A,'finalize_dinners',[room,'a',keyA,ids(4,5,6,7,8),[]]);
  assert.deepEqual((await rpc(B,'get_room_status',[room])).dinner_ids,ids(4,5,6,7,8));
});

test('more than five matches uses the same deterministic SHA-256 selection as the UI', async () => {
  const room='rdinner123'; const picks=ids(1,2,3,4,5,6,7,8); await create(room);
  await vote(A,room,picks); await vote(B,room,picks);
  const expected=await stablePick(room,picks,5);
  await rpc(A,'finalize_dinners',[room,'a',keyA,expected.picked,expected.unused]);
  assert.deepEqual((await rpc(B,'get_room_status',[room])).dinner_ids,expected.picked);
});

test('fill rounds derive matches on the server, reject forged input and repeated advancement', async () => {
  const room='rfilltest1'; await create(room);
  await vote(A,room,ids(1,2,3,4,5,6,7,8)); await vote(B,room,ids(7,8,9,10,11,12,13,14));
  await invalid(() => rpc(A,'start_fill_round',[room,'a',keyA,ids(1,2)]));
  await rpc(A,'start_fill_round',[room,'a',keyA,ids(7,8)]);
  await rpc(A,'start_fill_round',[room,'a',keyA,ids(7,8)]);
  assert.equal((await rpc(B,'get_room_status',[room])).fill_round,1);
  await invalid(() => vote(A,room,ids(7,9,10)));
  await vote(A,room,ids(1,2,3)); await vote(B,room,ids(1,2,3));
  await rpc(A,'finalize_dinners',[room,'a',keyA,ids(1,2,3,7,8),[]]);
});

test('removing approval immediately denies existing account tokens', async () => {
  await db.exec("delete from private.approved_users where partner='b'");
  await denied(() => rpc(B,'access_status'));
  await denied(() => rpc(B,'get_matches',['rvoting123']));
});
