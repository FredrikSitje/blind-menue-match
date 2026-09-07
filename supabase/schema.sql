-- Menü-Finder: private two-person voting. Safe to apply to the existing schema.
-- Accounts are approved separately in private.approved_users; never commit emails.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.rooms (
  id text primary key, created_at timestamptz not null default now(),
  key_a text not null, key_b text not null,
  phase text not null default 'voting' check (phase in ('voting','fill','done')),
  fill_round int not null default 0,
  dinner_ids text[], unused_ids text[], accumulated_ids text[] default '{}'
);
create table if not exists public.submissions (
  room_id text not null references public.rooms(id) on delete cascade,
  partner text not null check (partner in ('a','b')), partner_key text not null,
  menu_ids text[] not null default '{}', locked boolean not null default false,
  round int not null default 0, updated_at timestamptz not null default now(),
  primary key (room_id, partner, round)
);
create table if not exists private.approved_users (
  email text primary key check (email = lower(trim(email))),
  partner text not null unique check (partner in ('a','b'))
);
alter table private.approved_users enable row level security;
alter table public.rooms enable row level security;
alter table public.submissions enable row level security;

-- No direct table API: only narrowly scoped authenticated RPCs below.
revoke all on public.rooms, public.submissions, private.approved_users from public, anon, authenticated;
drop policy if exists rooms_select_all on public.rooms;
drop policy if exists rooms_insert_anon on public.rooms;
drop policy if exists rooms_update_anon on public.rooms;
drop policy if exists submissions_select_own on public.submissions;
drop policy if exists submissions_insert_own on public.submissions;
drop policy if exists submissions_update_own on public.submissions;

create or replace function private.require_member() returns text
language plpgsql stable security definer set search_path = '' as $$
declare slot text;
begin
  select a.partner into slot from private.approved_users a
    join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid() and u.email_confirmed_at is not null;
  if slot is null then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  return slot;
end;
$$;

create or replace function public.access_status() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('ok', true, 'partner', private.require_member());
$$;

create or replace function public.verify_partner(p_room_id text, p_partner text, p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.require_member() = p_partner and exists (
    select 1 from public.rooms r where r.id = p_room_id
    and p_key = case p_partner when 'a' then r.key_a when 'b' then r.key_b end
  );
$$;

create or replace function private.require_partner(p_room_id text, p_partner text, p_key text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if public.verify_partner(p_room_id, p_partner, p_key) is not true then
    raise exception 'wrong_partner_or_link' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.create_room(p_room_id text, p_key_a text, p_key_b text)
returns json language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_member();
  if p_room_id is null or p_room_id !~ '^r[a-z0-9]{8,64}$'
    or p_key_a is null or length(p_key_a) < 14
    or p_key_b is null or length(p_key_b) < 14 or p_key_a = p_key_b then
    raise exception 'invalid_room' using errcode = '22023';
  end if;
  insert into public.rooms(id,key_a,key_b) values (p_room_id,p_key_a,p_key_b);
  return json_build_object('ok',true,'room_id',p_room_id);
exception when unique_violation then
  return json_build_object('ok',false,'error','exists');
end;
$$;

create or replace function public.get_room_status(p_room_id text)
returns json language plpgsql stable security definer set search_path = '' as $$
declare r public.rooms%rowtype; a boolean; b boolean;
begin
  perform private.require_member();
  select * into r from public.rooms where id = p_room_id;
  if not found then return json_build_object('ok',false,'error','room_not_found'); end if;
  select locked into a from public.submissions where room_id=r.id and partner='a' and round=r.fill_round;
  select locked into b from public.submissions where room_id=r.id and partner='b' and round=r.fill_round;
  return json_build_object('ok',true,'phase',r.phase,'fill_round',r.fill_round,
    'dinner_ids',r.dinner_ids,'unused_ids',r.unused_ids,'accumulated_ids',r.accumulated_ids,
    'a_locked',coalesce(a,false),'b_locked',coalesce(b,false),
    'both_locked',coalesce(a,false) and coalesce(b,false));
end;
$$;

create or replace function public.get_own_submission(p_room_id text, p_partner text, p_key text, p_round int)
returns json language plpgsql stable security definer set search_path = '' as $$
declare result json;
begin
  perform private.require_partner(p_room_id,p_partner,p_key);
  select json_build_object('menu_ids',menu_ids,'locked',locked,'round',round) into result
    from public.submissions where room_id=p_room_id and partner=p_partner and round=p_round;
  return coalesce(result,json_build_object('menu_ids','[]'::json,'locked',false,'round',p_round));
end;
$$;

create or replace function public.submit_picks(p_room_id text, p_partner text, p_key text, p_menu_ids text[], p_lock boolean default false)
returns json language plpgsql security definer set search_path = '' as $$
declare r public.rooms%rowtype; already boolean; need int; ids text[];
begin
  perform private.require_partner(p_room_id,p_partner,p_key);
  select * into r from public.rooms where id=p_room_id for update;
  if r.phase='done' then raise exception 'room_done' using errcode='22023'; end if;
  select locked into already from public.submissions
    where room_id=r.id and partner=p_partner and round=r.fill_round;
  if coalesce(already,false) then
    return json_build_object('ok',true,'locked',true,'round',r.fill_round);
  end if;
  need := case when r.fill_round=0 then 8 else greatest(1,5-cardinality(coalesce(r.accumulated_ids,'{}'))) end;
  select coalesce(array_agg(distinct x order by x),'{}') into ids from unnest(p_menu_ids) x;
  if p_menu_ids is null or cardinality(ids)<>cardinality(p_menu_ids)
    or cardinality(ids)>need or (coalesce(p_lock,false) and cardinality(ids)<>need)
    or exists(select 1 from unnest(ids) x where x is null or x !~ '^m(0[1-9]|1[0-9]|20)$'
      or x = any(coalesce(r.accumulated_ids,'{}'))) then
    raise exception 'invalid_picks' using errcode='22023';
  end if;
  insert into public.submissions(room_id,partner,partner_key,menu_ids,locked,round)
    values(r.id,p_partner,p_key,ids,coalesce(p_lock,false),r.fill_round)
    on conflict(room_id,partner,round) do update
      set menu_ids=excluded.menu_ids,locked=excluded.locked,updated_at=now();
  return json_build_object('ok',true,'locked',coalesce(p_lock,false),'round',r.fill_round);
end;
$$;

-- Called only by guarded RPCs; never exposes either individual ballot.
create or replace function private.round_matches(p_room_id text,p_round int)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(x order by x),'{}') from (
    select unnest(menu_ids) x from public.submissions where room_id=p_room_id and round=p_round and partner='a' and locked
    intersect
    select unnest(menu_ids) x from public.submissions where room_id=p_room_id and round=p_round and partner='b' and locked
  ) s;
$$;
create or replace function private.combined_matches(p_room_id text)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct x order by x),'{}') from public.rooms r,
    unnest(coalesce(r.accumulated_ids,'{}') || private.round_matches(r.id,r.fill_round)) x where r.id=p_room_id;
$$;

create or replace function public.get_matches(p_room_id text)
returns json language plpgsql stable security definer set search_path = '' as $$
declare r public.rooms%rowtype; ready boolean;
begin
  perform private.require_member();
  select * into r from public.rooms where id=p_room_id;
  if not found then return json_build_object('ok',false,'error','room_not_found'); end if;
  select count(*)=2 into ready from public.submissions where room_id=r.id and round=r.fill_round and locked;
  return json_build_object('ok',true,'ready',ready,'phase',r.phase,'fill_round',r.fill_round,
    'matches',case when ready then private.round_matches(r.id,r.fill_round) else '{}'::text[] end,
    'accumulated_ids',r.accumulated_ids,'dinner_ids',r.dinner_ids,'unused_ids',r.unused_ids);
end;
$$;

create or replace function public.start_fill_round(p_room_id text,p_partner text,p_key text,p_accumulated_matches text[])
returns json language plpgsql security definer set search_path = '' as $$
declare r public.rooms%rowtype; acc text[]; ready boolean;
begin
  perform private.require_partner(p_room_id,p_partner,p_key);
  select * into r from public.rooms where id=p_room_id for update;
  if r.phase='done' then raise exception 'room_done' using errcode='22023'; end if;
  select count(*)=2 into ready from public.submissions where room_id=r.id and round=r.fill_round and locked;
  if not ready then
    if r.phase='fill' and r.accumulated_ids is not distinct from p_accumulated_matches then
      return json_build_object('ok',true,'fill_round',r.fill_round);
    end if;
    raise exception 'not_ready' using errcode='22023';
  end if;
  acc := private.combined_matches(r.id);
  if cardinality(acc)>=5 or acc is distinct from p_accumulated_matches then
    raise exception 'invalid_matches' using errcode='22023';
  end if;
  update public.rooms set fill_round=fill_round+1,phase='fill',accumulated_ids=acc where id=r.id;
  return json_build_object('ok',true,'fill_round',r.fill_round+1);
end;
$$;

create or replace function public.finalize_dinners(p_room_id text,p_partner text,p_key text,p_dinner_ids text[],p_unused_ids text[])
returns json language plpgsql security definer set search_path = '' as $$
declare r public.rooms%rowtype; acc text[]; picked text[]; unused text[]; ready boolean;
begin
  perform private.require_partner(p_room_id,p_partner,p_key);
  select * into r from public.rooms where id=p_room_id for update;
  if r.phase='done' then return json_build_object('ok',true); end if;
  select count(*)=2 into ready from public.submissions where room_id=r.id and round=r.fill_round and locked;
  if not ready then raise exception 'not_ready' using errcode='22023'; end if;
  acc := private.combined_matches(r.id);
  if cardinality(acc)<5 then raise exception 'not_enough_matches' using errcode='22023'; end if;
  select array_agg(x order by x) into picked from (
    select x from unnest(acc) x
    order by encode(sha256(convert_to(r.id || '|' || array_to_string(acc,',') || '|' || x,'UTF8')),'hex'),x limit 5
  ) s;
  select coalesce(array_agg(x order by x),'{}') into unused from unnest(acc) x where not x=any(picked);
  if picked is distinct from p_dinner_ids or unused is distinct from p_unused_ids then
    raise exception 'invalid_dinners' using errcode='22023';
  end if;
  update public.rooms set phase='done',dinner_ids=picked,unused_ids=unused,accumulated_ids=picked where id=r.id;
  return json_build_object('ok',true);
end;
$$;

-- CREATE OR REPLACE preserves old grants: explicitly revoke all legacy access.
revoke all on function public.verify_partner(text,text,text) from public, anon, authenticated;
revoke all on function private.require_member(),private.require_partner(text,text,text),
  private.round_matches(text,int),private.combined_matches(text) from public, anon, authenticated;
revoke all on function public.access_status(),public.create_room(text,text,text),
  public.get_room_status(text),public.get_own_submission(text,text,text,int),
  public.submit_picks(text,text,text,text[],boolean),public.get_matches(text),
  public.start_fill_round(text,text,text,text[]),public.finalize_dinners(text,text,text,text[],text[])
  from public, anon, authenticated;
grant execute on function public.access_status(),public.create_room(text,text,text),
  public.get_room_status(text),public.get_own_submission(text,text,text,int),
  public.submit_picks(text,text,text,text[],boolean),public.get_matches(text),
  public.start_fill_round(text,text,text,text[]),public.finalize_dinners(text,text,text,text[],text[])
  to authenticated;
notify pgrst, 'reload schema';
commit;
