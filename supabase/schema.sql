-- Blind-Menü-Match — Supabase Schema + RLS + RPC
-- Im SQL Editor des Free-Projekts komplett ausführen.

create extension if not exists "pgcrypto";

create table if not exists public.rooms (
  id text primary key,
  created_at timestamptz not null default now(),
  key_a text not null,
  key_b text not null,
  phase text not null default 'voting'
    check (phase in ('voting', 'fill', 'done')),
  fill_round int not null default 0,
  dinner_ids text[] default null,
  unused_ids text[] default null,
  accumulated_ids text[] default '{}'
);

create table if not exists public.submissions (
  room_id text not null references public.rooms(id) on delete cascade,
  partner text not null check (partner in ('a', 'b')),
  partner_key text not null,
  menu_ids text[] not null default '{}',
  locked boolean not null default false,
  round int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, partner, round)
);

create index if not exists submissions_room_idx on public.submissions(room_id);

alter table public.rooms enable row level security;
alter table public.submissions enable row level security;

create or replace function public.verify_partner(
  p_room_id text, p_partner text, p_key text
) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id
      and (
        (p_partner = 'a' and r.key_a = p_key)
        or (p_partner = 'b' and r.key_b = p_key)
      )
  );
$$;

drop policy if exists "rooms_select_all" on public.rooms;
create policy "rooms_select_all" on public.rooms for select to anon, authenticated using (true);

drop policy if exists "rooms_insert_anon" on public.rooms;
create policy "rooms_insert_anon" on public.rooms for insert to anon, authenticated with check (true);

drop policy if exists "rooms_update_anon" on public.rooms;
create policy "rooms_update_anon" on public.rooms for update to anon, authenticated using (true) with check (true);

-- Submissions: can only read/write own partner row when partner_key matches room key
drop policy if exists "submissions_select_own" on public.submissions;
create policy "submissions_select_own" on public.submissions for select to anon, authenticated
  using (
    (partner = 'a' and partner_key = (select key_a from public.rooms where id = room_id))
    or (partner = 'b' and partner_key = (select key_b from public.rooms where id = room_id))
  );

drop policy if exists "submissions_insert_own" on public.submissions;
create policy "submissions_insert_own" on public.submissions for insert to anon, authenticated
  with check (
    (partner = 'a' and partner_key = (select key_a from public.rooms where id = room_id))
    or (partner = 'b' and partner_key = (select key_b from public.rooms where id = room_id))
  );

drop policy if exists "submissions_update_own" on public.submissions;
create policy "submissions_update_own" on public.submissions for update to anon, authenticated
  using (
    (partner = 'a' and partner_key = (select key_a from public.rooms where id = room_id))
    or (partner = 'b' and partner_key = (select key_b from public.rooms where id = room_id))
  )
  with check (
    (partner = 'a' and partner_key = (select key_a from public.rooms where id = room_id))
    or (partner = 'b' and partner_key = (select key_b from public.rooms where id = room_id))
  );

-- Status without revealing picks
create or replace function public.get_room_status(p_room_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  r public.rooms%rowtype;
  a_locked boolean; b_locked boolean;
  a_count int; b_count int; rnd int;
begin
  select * into r from public.rooms where id = p_room_id;
  if not found then
    return json_build_object('ok', false, 'error', 'room_not_found');
  end if;
  rnd := r.fill_round;
  select locked, coalesce(array_length(menu_ids, 1), 0) into a_locked, a_count
    from public.submissions where room_id = p_room_id and partner = 'a' and round = rnd;
  select locked, coalesce(array_length(menu_ids, 1), 0) into b_locked, b_count
    from public.submissions where room_id = p_room_id and partner = 'b' and round = rnd;
  return json_build_object(
    'ok', true,
    'phase', r.phase,
    'fill_round', r.fill_round,
    'dinner_ids', to_json(r.dinner_ids),
    'unused_ids', to_json(r.unused_ids),
    'accumulated_ids', to_json(coalesce(r.accumulated_ids, '{}')),
    'a_locked', coalesce(a_locked, false),
    'b_locked', coalesce(b_locked, false),
    'a_count', coalesce(a_count, 0),
    'b_count', coalesce(b_count, 0),
    'both_locked', coalesce(a_locked, false) and coalesce(b_locked, false)
  );
end;
$$;

grant execute on function public.get_room_status(text) to anon, authenticated;

-- CRITICAL: ONLY intersection when both locked — never full picks
create or replace function public.get_matches(p_room_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  r public.rooms%rowtype;
  a_ids text[]; b_ids text[];
  a_locked boolean; b_locked boolean;
  inter text[]; rnd int;
begin
  select * into r from public.rooms where id = p_room_id;
  if not found then
    return json_build_object('ok', false, 'error', 'room_not_found');
  end if;
  rnd := r.fill_round;
  select menu_ids, locked into a_ids, a_locked
    from public.submissions where room_id = p_room_id and partner = 'a' and round = rnd;
  select menu_ids, locked into b_ids, b_locked
    from public.submissions where room_id = p_room_id and partner = 'b' and round = rnd;

  if not coalesce(a_locked, false) or not coalesce(b_locked, false) then
    return json_build_object(
      'ok', true, 'ready', false, 'phase', r.phase, 'fill_round', rnd,
      'matches', '[]'::json,
      'a_locked', coalesce(a_locked, false),
      'b_locked', coalesce(b_locked, false),
      'accumulated_ids', to_json(coalesce(r.accumulated_ids, '{}'))
    );
  end if;

  select coalesce(array_agg(x order by x), '{}') into inter
  from (
    select unnest(coalesce(a_ids, '{}')) as x
    intersect
    select unnest(coalesce(b_ids, '{}')) as x
  ) s;

  return json_build_object(
    'ok', true, 'ready', true, 'phase', r.phase, 'fill_round', rnd,
    'matches', to_json(inter),
    'a_locked', true, 'b_locked', true,
    'dinner_ids', to_json(r.dinner_ids),
    'unused_ids', to_json(r.unused_ids),
    'accumulated_ids', to_json(coalesce(r.accumulated_ids, '{}'))
  );
end;
$$;

grant execute on function public.get_matches(text) to anon, authenticated;

create or replace function public.create_room(p_room_id text, p_key_a text, p_key_b text)
returns json language plpgsql security definer set search_path = public as $$
begin
  insert into public.rooms (id, key_a, key_b, phase, fill_round)
  values (p_room_id, p_key_a, p_key_b, 'voting', 0);
  return json_build_object('ok', true, 'room_id', p_room_id);
exception when unique_violation then
  return json_build_object('ok', false, 'error', 'exists');
end;
$$;
grant execute on function public.create_room(text, text, text) to anon, authenticated;

create or replace function public.submit_picks(
  p_room_id text, p_partner text, p_key text, p_menu_ids text[], p_lock boolean default false
) returns json language plpgsql security definer set search_path = public as $$
declare
  r public.rooms%rowtype; rnd int; expected text; was_locked boolean;
begin
  if p_partner not in ('a','b') then
    return json_build_object('ok', false, 'error', 'bad_partner');
  end if;
  select * into r from public.rooms where id = p_room_id;
  if not found then return json_build_object('ok', false, 'error', 'room_not_found'); end if;
  expected := case when p_partner = 'a' then r.key_a else r.key_b end;
  if p_key is distinct from expected then
    return json_build_object('ok', false, 'error', 'bad_key');
  end if;
  if r.phase = 'done' then return json_build_object('ok', false, 'error', 'room_done'); end if;
  rnd := r.fill_round;

  select locked into was_locked from public.submissions
    where room_id = p_room_id and partner = p_partner and round = rnd;
  if coalesce(was_locked, false) and coalesce(p_lock, false) = false then
    return json_build_object('ok', false, 'error', 'already_locked');
  end if;
  if coalesce(was_locked, false) then
    return json_build_object('ok', true, 'locked', true, 'round', rnd, 'note', 'already_locked');
  end if;

  insert into public.submissions (room_id, partner, partner_key, menu_ids, locked, round, updated_at)
  values (p_room_id, p_partner, p_key, coalesce(p_menu_ids, '{}'), coalesce(p_lock, false), rnd, now())
  on conflict (room_id, partner, round) do update
    set menu_ids = excluded.menu_ids,
        locked = excluded.locked,
        partner_key = excluded.partner_key,
        updated_at = now()
    where not submissions.locked;

  return json_build_object('ok', true, 'locked', coalesce(p_lock, false), 'round', rnd);
end;
$$;
grant execute on function public.submit_picks(text, text, text, text[], boolean) to anon, authenticated;

create or replace function public.start_fill_round(
  p_room_id text, p_partner text, p_key text, p_accumulated_matches text[]
) returns json language plpgsql security definer set search_path = public as $$
declare
  r public.rooms%rowtype; expected text; st json;
begin
  select * into r from public.rooms where id = p_room_id;
  if not found then return json_build_object('ok', false, 'error', 'room_not_found'); end if;
  expected := case when p_partner = 'a' then r.key_a else r.key_b end;
  if p_key is distinct from expected then
    return json_build_object('ok', false, 'error', 'bad_key');
  end if;
  st := public.get_matches(p_room_id);
  if (st->>'ready')::boolean is not true then
    return json_build_object('ok', false, 'error', 'not_ready');
  end if;
  -- idempotent if already advanced
  update public.rooms
    set fill_round = fill_round + 1,
        phase = 'fill',
        accumulated_ids = coalesce(p_accumulated_matches, accumulated_ids)
    where id = p_room_id and phase <> 'done';
  return json_build_object('ok', true, 'fill_round', (select fill_round from public.rooms where id = p_room_id));
end;
$$;
grant execute on function public.start_fill_round(text, text, text, text[]) to anon, authenticated;

create or replace function public.finalize_dinners(
  p_room_id text, p_partner text, p_key text, p_dinner_ids text[], p_unused_ids text[]
) returns json language plpgsql security definer set search_path = public as $$
declare
  r public.rooms%rowtype; expected text;
begin
  select * into r from public.rooms where id = p_room_id;
  if not found then return json_build_object('ok', false, 'error', 'room_not_found'); end if;
  expected := case when p_partner = 'a' then r.key_a else r.key_b end;
  if p_key is distinct from expected then
    return json_build_object('ok', false, 'error', 'bad_key');
  end if;
  update public.rooms
    set phase = 'done', dinner_ids = p_dinner_ids, unused_ids = p_unused_ids,
        accumulated_ids = p_dinner_ids
    where id = p_room_id;
  return json_build_object('ok', true);
end;
$$;
grant execute on function public.finalize_dinners(text, text, text, text[], text[]) to anon, authenticated;
