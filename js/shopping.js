/** Full-pack shopping list + Bern cluster short route (from aktionen-menue-planer) */
import { STORES, STAPLES, ING, MENUS, menuById } from "./data.js";

export function formatCHF(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function fullPackPrice(ing) {
  if (!ing || ing.price == null) return null;
  return ing.price;
}

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function menuAktionEstimate(menu) {
  let sum = 0;
  const seen = new Set();
  for (const item of menu.ingredients) {
    if (item.staple) continue;
    const ing = ING[item.ref];
    const cost = fullPackPrice(ing);
    if (cost == null) continue;
    const key = ing.shareKey || ing.id;
    if (seen.has(key)) continue;
    seen.add(key);
    sum += cost;
  }
  return sum;
}

/** Deterministic stable pick of n ids from list using hash(room+ids) */
export async function stablePick(roomId, ids, n) {
  const sorted = [...ids].sort();
  const scored = [];
  for (const id of sorted) {
    const h = await sha256Hex(`${roomId}|${sorted.join(",")}|${id}`);
    scored.push({ id, h });
  }
  scored.sort((a, b) => (a.h < b.h ? -1 : a.h > b.h ? 1 : a.id.localeCompare(b.id)));
  const picked = scored.slice(0, n).map(s => s.id).sort();
  const unused = sorted.filter(id => !picked.includes(id));
  return { picked, unused };
}

async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function computePlan(menuIds) {
  const menus = menuIds.map(id => menuById(id)).filter(Boolean);
  const packs = new Map();
  const staplesNeeded = new Set();

  menus.forEach(menu => {
    menu.ingredients.forEach(item => {
      if (item.staple) {
        staplesNeeded.add(item.staple);
        return;
      }
      const ing = ING[item.ref];
      if (!ing) return;
      const key = ing.shareKey || ing.id;
      if (!packs.has(key)) packs.set(key, { ing, menus: [] });
      packs.get(key).menus.push(menu.id);
    });
  });

  let aktionTotal = 0;
  const byStore = new Map();

  packs.forEach(({ ing, menus: mids }) => {
    const cost = fullPackPrice(ing);
    if (cost != null) aktionTotal += cost;
    const sid = ing.store;
    if (!byStore.has(sid)) byStore.set(sid, []);
    byStore.get(sid).push({
      name: ing.name,
      packSize: ing.packSize || null,
      price: cost,
      storeLabel: ing.storeLabel,
      origin: ing.origin || null,
      glutenRisk: ing.glutenRisk || null,
      gfUnique: !!ing.gfUnique,
      usedIn: mids.length,
      shareKey: ing.shareKey
    });
  });

  const clusterSpend = {};
  byStore.forEach((items, sid) => {
    const store = STORES[sid];
    if (!store) return;
    const spend = items.filter(i => i.price != null).reduce((a, i) => a + i.price, 0);
    clusterSpend[store.cluster] = (clusterSpend[store.cluster] || 0) + spend;
  });

  let primary = null;
  let maxSpend = -1;
  Object.entries(clusterSpend).forEach(([c, s]) => {
    if (s > maxSpend) {
      maxSpend = s;
      primary = c;
    }
  });

  const clustersNeeded = new Set();
  if (primary) clustersNeeded.add(primary);

  byStore.forEach((items, sid) => {
    const store = STORES[sid];
    items.forEach(it => {
      if (it.gfUnique && store.cluster !== primary) clustersNeeded.add(store.cluster);
    });
  });

  const brandToStores = {};
  Object.values(STORES).forEach(s => {
    const brand = s.name.split(" ")[0];
    if (!brandToStores[brand]) brandToStores[brand] = [];
    brandToStores[brand].push(s);
  });

  function brandOf(storeId) {
    return STORES[storeId].name.split(" ")[0];
  }

  const finalByStore = new Map();
  byStore.forEach((items, sid) => {
    const store = STORES[sid];
    let targetSid = sid;
    if (!clustersNeeded.has(store.cluster)) {
      const brand = brandOf(sid);
      const alt = (brandToStores[brand] || []).find(s => clustersNeeded.has(s.cluster));
      if (alt) targetSid = alt.id;
      else clustersNeeded.add(store.cluster);
    }
    if (!finalByStore.has(targetSid)) finalByStore.set(targetSid, []);
    finalByStore.get(targetSid).push(...items.map(i => ({ ...i, assignedStore: targetSid })));
  });

  const stopIds = [...finalByStore.keys()].filter(sid => finalByStore.get(sid).length > 0);
  const clusterOrder = [...clustersNeeded].sort((a, b) => {
    if (a === primary) return -1;
    if (b === primary) return 1;
    return (clusterSpend[b] || 0) - (clusterSpend[a] || 0);
  });

  const orderedStops = [];
  clusterOrder.forEach(cl => {
    const inCl = stopIds.filter(id => STORES[id].cluster === cl);
    if (!inCl.length) return;
    let remaining = [...inCl];
    remaining.sort((a, b) => {
      const sa = finalByStore.get(a).filter(i => i.price).reduce((x, i) => x + i.price, 0);
      const sb = finalByStore.get(b).filter(i => i.price).reduce((x, i) => x + i.price, 0);
      return sb - sa;
    });
    let cur = remaining.shift();
    orderedStops.push(cur);
    while (remaining.length) {
      remaining.sort((a, b) => haversineKm(STORES[cur], STORES[a]) - haversineKm(STORES[cur], STORES[b]));
      cur = remaining.shift();
      orderedStops.push(cur);
    }
  });

  const legs = [];
  let totalKm = 0;
  for (let i = 0; i < orderedStops.length; i++) {
    const sid = orderedStops[i];
    let kmFromPrev = 0;
    if (i > 0) {
      kmFromPrev = haversineKm(STORES[orderedStops[i - 1]], STORES[sid]);
      totalKm += kmFromPrev;
    }
    legs.push({ storeId: sid, store: STORES[sid], kmFromPrev, items: finalByStore.get(sid) });
  }

  return {
    menus,
    aktionTotal,
    storeCount: orderedStops.length,
    primaryCluster: primary,
    clusters: [...clustersNeeded],
    legs,
    totalKm,
    staples: [...staplesNeeded].map(k => STAPLES[k].name),
    menuCount: menus.length
  };
}
