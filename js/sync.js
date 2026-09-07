/** All planning data requires an approved, authenticated account. */
import { sessionHeaders } from './auth.js';

export async function rpc(name, args = {}) {
  const config = window.BMM_CONFIG;
  const res = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST', cache: 'no-store',
    headers: { ...await sessionHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (!res.ok || data?.ok === false) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Kein Zugriff. Bitte melde dich mit deinem freigeschalteten Konto an und verwende deinen eigenen Partner-Link.');
    }
    throw new Error(data?.error || data?.message || `Serverfehler (${res.status})`);
  }
  return data;
}

function randomToken(length) {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), b => b.toString(16).padStart(2, '0')).join('');
}

export function partnerUrls(roomId, keyA, keyB) {
  const base = new URL('.', location.href);
  function link(partner, key) {
    const url = new URL(base);
    url.search = new URLSearchParams({ room: roomId, p: partner, key }).toString();
    return url.href;
  }
  return { roomId, urlA: link('a', keyA), urlB: link('b', keyB) };
}

export async function createRoom() {
  const roomId = 'r' + randomToken(12), keyA = 'ka' + randomToken(24), keyB = 'kb' + randomToken(24);
  await rpc('create_room', { p_room_id: roomId, p_key_a: keyA, p_key_b: keyB });
  return partnerUrls(roomId, keyA, keyB);
}
export const accessStatus = () => rpc('access_status');
export const getRoomStatus = roomId => rpc('get_room_status', { p_room_id: roomId });
export const getMatches = roomId => rpc('get_matches', { p_room_id: roomId });
export const getOwnSubmission = (roomId, partner, key, round) => rpc('get_own_submission', {
  p_room_id: roomId, p_partner: partner, p_key: key, p_round: round,
});
export const submitPicks = (roomId, partner, key, ids, lock = false) => rpc('submit_picks', {
  p_room_id: roomId, p_partner: partner, p_key: key, p_menu_ids: ids, p_lock: lock,
});
export const startFillRound = (roomId, partner, key, accumulated) => rpc('start_fill_round', {
  p_room_id: roomId, p_partner: partner, p_key: key, p_accumulated_matches: accumulated,
});
export const finalizeDinners = (roomId, partner, key, dinners, unused) => rpc('finalize_dinners', {
  p_room_id: roomId, p_partner: partner, p_key: key, p_dinner_ids: dinners, p_unused_ids: unused,
});
