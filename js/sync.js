/** Sync: Supabase or localStorage + Sync-Code */
const LS_PREFIX = "bmm_room_";

function cfg() {
  return window.BMM_CONFIG || { supabaseUrl: "", supabaseAnonKey: "", pollIntervalMs: 3000 };
}

export function hasSupabase() {
  const c = cfg();
  return !!(c.supabaseUrl && c.supabaseAnonKey && c.supabaseUrl.startsWith("http"));
}

export function syncModeLabel() {
  return hasSupabase() ? "Supabase Live-Sync" : "Demo (localStorage + Sync-Code)";
}
let _client = null;

function randomToken(len) {
  if (len === undefined) len = 10;
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes).map(function(b) { return alphabet[b % alphabet.length]; }).join("");
}

async function getClient() {
  if (!hasSupabase()) return null;
  if (_client) return _client;
  const host = "cdn." + "jsdelivr.net";
  const path = "/npm/@supabase/supabase-js@2/+esm";
  const mod = await import("https://" + host + path);
  const c = cfg();
  _client = mod.createClient(c.supabaseUrl, c.supabaseAnonKey);
  return _client;
}

export function makeRoomIds() {
  return { roomId: "r" + randomToken(8), keyA: "ka" + randomToken(12), keyB: "kb" + randomToken(12) };
}

function emptyRoom(roomId, keyA, keyB) {
  return { id: roomId, key_a: keyA, key_b: keyB, phase: "voting", fill_round: 0, dinner_ids: null, unused_ids: null, accumulated_ids: [], submissions: {} };
}

function lsLoad(roomId) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + roomId);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function lsSave(room) {
  localStorage.setItem(LS_PREFIX + room.id, JSON.stringify(room));
}
function subKey(partner, round) { return partner + ":" + round; }

export async function createRoom() {
  const ids = makeRoomIds();
  const roomId = ids.roomId, keyA = ids.keyA, keyB = ids.keyB;
  if (hasSupabase()) {
    const sb = await getClient();
    const result = await sb.rpc("create_room", { p_room_id: roomId, p_key_a: keyA, p_key_b: keyB });
    if (result.error) throw new Error(result.error.message);
    if (result.data && result.data.ok === false) throw new Error(result.data.error || "create failed");
  } else {
    lsSave(emptyRoom(roomId, keyA, keyB));
  }
  const base = location.origin + location.pathname;
  return {
    roomId: roomId, keyA: keyA, keyB: keyB,
    urlA: base + "?room=" + encodeURIComponent(roomId) + "&p=a&key=" + encodeURIComponent(keyA),
    urlB: base + "?room=" + encodeURIComponent(roomId) + "&p=b&key=" + encodeURIComponent(keyB)
  };
}

export async function getRoomStatus(roomId) {
  if (hasSupabase()) {
    const sb = await getClient();
    const result = await sb.rpc("get_room_status", { p_room_id: roomId });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }
  const room = lsLoad(roomId);
  if (!room) return { ok: false, error: "room_not_found" };
  const rnd = room.fill_round;
  const a = room.submissions[subKey("a", rnd)];
  const b = room.submissions[subKey("b", rnd)];
  return {
    ok: true, phase: room.phase, fill_round: room.fill_round,
    dinner_ids: room.dinner_ids, unused_ids: room.unused_ids,
    accumulated_ids: room.accumulated_ids || [],
    a_locked: !!(a && a.locked), b_locked: !!(b && b.locked),
    a_count: a ? (a.menu_ids || []).length : 0,
    b_count: b ? (b.menu_ids || []).length : 0,
    both_locked: !!(a && a.locked && b && b.locked)
  };
}

export async function getOwnSubmission(roomId, partner, key, round) {
  if (hasSupabase()) {
    const sb = await getClient();
    const result = await sb.from("submissions").select("menu_ids, locked, round").eq("room_id", roomId).eq("partner", partner).eq("round", round).eq("partner_key", key).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return result.data || { menu_ids: [], locked: false, round: round };
  }
  const room = lsLoad(roomId);
  if (!room) return { menu_ids: [], locked: false, round: round };
  const expected = partner === "a" ? room.key_a : room.key_b;
  if (key !== expected) throw new Error("bad_key");
  const s = room.submissions[subKey(partner, round)];
  return s ? { menu_ids: s.menu_ids, locked: s.locked, round: round } : { menu_ids: [], locked: false, round: round };
}

export async function submitPicks(roomId, partner, key, menuIds, lock) {
  if (lock === undefined) lock = false;
  if (hasSupabase()) {
    const sb = await getClient();
    const result = await sb.rpc("submit_picks", { p_room_id: roomId, p_partner: partner, p_key: key, p_menu_ids: menuIds, p_lock: lock });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }
  const room = lsLoad(roomId);
  if (!room) throw new Error("room_not_found");
  const expected = partner === "a" ? room.key_a : room.key_b;
  if (key !== expected) throw new Error("bad_key");
  if (room.phase === "done") throw new Error("room_done");
  const rnd = room.fill_round;
  const sk = subKey(partner, rnd);
  const existing = room.submissions[sk];
  if (existing && existing.locked) return { ok: true, locked: true, round: rnd, note: "already_locked" };
  room.submissions[sk] = { menu_ids: menuIds.slice(), locked: !!lock, partner_key: key };
  lsSave(room);
  return { ok: true, locked: !!lock, round: rnd };
}

export async function getMatches(roomId) {
  if (hasSupabase()) {
    const sb = await getClient();
    const result = await sb.rpc("get_matches", { p_room_id: roomId });
    if (result.error) throw new Error(result.error.message);
    const data = result.data;
    let matches = data.matches;
    if (typeof matches === "string") { try { matches = JSON.parse(matches); } catch (e) { matches = []; } }
    if (!Array.isArray(matches)) matches = [];
    return Object.assign({}, data, { matches: matches });
  }
  const room = lsLoad(roomId);
  if (!room) return { ok: false, error: "room_not_found" };
  const rnd = room.fill_round;
  const a = room.submissions[subKey("a", rnd)];
  const b = room.submissions[subKey("b", rnd)];
  if (!(a && a.locked && b && b.locked)) {
    return { ok: true, ready: false, phase: room.phase, fill_round: rnd, matches: [], a_locked: !!(a && a.locked), b_locked: !!(b && b.locked), accumulated_ids: room.accumulated_ids || [] };
  }
  const setB = new Set(b.menu_ids || []);
  const matches = (a.menu_ids || []).filter(function(id) { return setB.has(id); }).sort();
  return { ok: true, ready: true, phase: room.phase, fill_round: rnd, matches: matches, a_locked: true, b_locked: true, dinner_ids: room.dinner_ids, unused_ids: room.unused_ids, accumulated_ids: room.accumulated_ids || [] };
}

export async function startFillRound(roomId, partner, key, accumulatedMatches) {
  if (hasSupabase()) {
    const sb = await getClient();
    const result = await sb.rpc("start_fill_round", { p_room_id: roomId, p_partner: partner, p_key: key, p_accumulated_matches: accumulatedMatches });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }
  const room = lsLoad(roomId);
  if (!room) throw new Error("room_not_found");
  const expected = partner === "a" ? room.key_a : room.key_b;
  if (key !== expected) throw new Error("bad_key");
  room.accumulated_ids = accumulatedMatches.slice();
  room.fill_round += 1;
  room.phase = "fill";
  lsSave(room);
  return { ok: true, fill_round: room.fill_round };
}

export async function finalizeDinners(roomId, partner, key, dinnerIds, unusedIds) {
  if (hasSupabase()) {
    const sb = await getClient();
    const result = await sb.rpc("finalize_dinners", { p_room_id: roomId, p_partner: partner, p_key: key, p_dinner_ids: dinnerIds, p_unused_ids: unusedIds });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }
  const room = lsLoad(roomId);
  if (!room) throw new Error("room_not_found");
  const expected = partner === "a" ? room.key_a : room.key_b;
  if (key !== expected) throw new Error("bad_key");
  room.phase = "done";
  room.dinner_ids = dinnerIds.slice();
  room.unused_ids = unusedIds.slice();
  room.accumulated_ids = dinnerIds.slice();
  lsSave(room);
  return { ok: true };
}

export function exportSyncCode(roomId) {
  const room = lsLoad(roomId);
  if (!room) throw new Error("Kein Raum lokal gefunden");
  const json = JSON.stringify({ v: 1, room: room });
  return btoa(unescape(encodeURIComponent(json)));
}

export function importSyncCode(code) {
  const trimmed = code.trim().replace(/\s+/g, "");
  var payload;
  try { payload = JSON.parse(decodeURIComponent(escape(atob(trimmed)))); }
  catch (e) { throw new Error("Ungueltiger Sync-Code"); }
  if (!payload || !payload.room || !payload.room.id) throw new Error("Ungueltiger Sync-Code");
  const incoming = payload.room;
  const existing = lsLoad(incoming.id);
  if (existing) { const merged = mergeRooms(existing, incoming); lsSave(merged); return merged; }
  lsSave(incoming);
  return incoming;
}

function mergeRooms(a, b) {
  const out = Object.assign({}, a);
  if ((b.fill_round || 0) > (a.fill_round || 0)) { out.fill_round = b.fill_round; out.phase = b.phase; }
  if (b.phase === "done") { out.phase = "done"; out.dinner_ids = b.dinner_ids; out.unused_ids = b.unused_ids; }
  if ((b.accumulated_ids || []).length > (a.accumulated_ids || []).length) out.accumulated_ids = b.accumulated_ids;
  out.submissions = Object.assign({}, a.submissions);
  Object.keys(b.submissions || {}).forEach(function(k) {
    const v = b.submissions[k];
    const cur = out.submissions[k];
    if (!cur || (v.locked && !cur.locked) || (v.locked && cur.locked)) out.submissions[k] = v;
  });
  return out;
}

export function ensureLocalRoom(roomId, partner, key) {
  var room = lsLoad(roomId);
  if (room) {
    if (partner === "a") room.key_a = key;
    if (partner === "b") room.key_b = key;
    lsSave(room);
    return room;
  }
  const keyA = partner === "a" ? key : "pending_a";
  const keyB = partner === "b" ? key : "pending_b";
  room = emptyRoom(roomId, keyA, keyB);
  lsSave(room);
  return room;
}
