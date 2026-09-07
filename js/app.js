/** Blind-Menue-Match — UI & Flow */
import { MENUS, menuById, labelTag } from "./data.js";
import { computePlan, formatCHF, menuAktionEstimate, stablePick } from "./shopping.js";
import {
  accessStatus, createRoom, getRoomStatus, getOwnSubmission,
  submitPicks, getMatches, startFillRound, finalizeDinners
} from "./sync.js";
import {
  configured, authClient, currentSession, signIn, signOut, incomingPasswordSetup,
  requestPasswordReset, updatePassword
} from "./auth.js";

let activeUserId = null;
let authReady = false;
let passwordSetup = incomingPasswordSetup
  || sessionStorage.getItem('bmm_password_setup') === 'yes';
if (passwordSetup) sessionStorage.setItem('bmm_password_setup','yes');


const TARGET = 5;
const PICK_N = 8;
const DAYS = ["Mo", "Di", "Mi", "Do", "Fr"];

const state = {
  roomId: null, partner: null, key: null,
  selected: new Set(), locked: false,
  fillRound: 0, phase: "voting",
  accumulated: [], dinners: null, unused: null,
  excludedIds: new Set(), pollTimer: null, resolving: false
};

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }
function cfg() { return window.BMM_CONFIG || { pollIntervalMs: 3000 }; }

function parseParams() {
  const u = new URL(location.href);
  return { room: u.searchParams.get("room"), p: u.searchParams.get("p"), key: u.searchParams.get("key") };
}

function showScreen(id) {
  qsa(".screen").forEach(function(el) { el.hidden = el.id !== id; });
}


function availableMenus() {
  return MENUS.filter(function(m) {
    if (state.excludedIds.has(m.id)) return false;
    if (state.accumulated.indexOf(m.id) >= 0) return false;
    return true;
  });
}

function needPickCount() {
  const need = TARGET - state.accumulated.length;
  if (state.fillRound === 0) return PICK_N;
  const avail = availableMenus().length;
  return Math.min(PICK_N, Math.max(need, 1), avail);
}

function updateSticky() {
  const need = needPickCount();
  const n = state.selected.size;
  const sticky = qs("#stickyBar");
  if (!sticky) return;
  qs("#pickCount").textContent = n + "/" + need;
  const btn = qs("#btnLock");
  btn.disabled = state.locked || n !== need;
  btn.textContent = state.locked ? "Festgelegt" : "Festlegen (" + need + ")";
}

function renderMenus() {
  const grid = qs("#menuGrid");
  grid.innerHTML = "";
  const need = needPickCount();
  availableMenus().forEach(function(menu) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "menu-card" + (state.selected.has(menu.id) ? " selected" : "");
    card.disabled = state.locked;
    card.setAttribute("data-id", menu.id);
    const est = menuAktionEstimate(menu);
    const tags = menu.tags.map(function(t) { return "<span class=\"tag\">" + labelTag(t) + "</span>"; }).join("");
    const stores = menu.stores.map(function(s) { return "<span class=\"tag store\">" + s + "</span>"; }).join("");
    card.innerHTML = "<div class=\"card-top\"><span class=\"check\">" + (state.selected.has(menu.id) ? "✓" : "") + "</span><div><strong>" + menu.title + "</strong><p class=\"desc\">" + menu.short + "</p></div></div><div class=\"tags\">" + tags + stores + "<span class=\"tag\">GF</span></div><div class=\"price\">Pack ca. CHF " + formatCHF(est) + "</div>";
    card.addEventListener("click", function() { toggleMenu(menu.id, need); });
    grid.appendChild(card);
  });
  updateSticky();
}

function toggleMenu(id, need) {
  if (state.locked) return;
  if (state.selected.has(id)) state.selected.delete(id);
  else {
    if (state.selected.size >= need) return;
    state.selected.add(id);
  }
  renderMenus();
}

async function onCreateRoom() {
  const btn = qs("#btnCreate");
  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "Erstelle…";
  try {
    const room = await createRoom();
    qs("#urlA").value = room.urlA;
    qs("#urlB").value = room.urlB;
    qs("#createdLinks").hidden = false;
    qs("#roomIdLabel").textContent = room.roomId;
    btn.textContent = "Raum erstellt";
  } catch (e) {
    btn.textContent = prev;
    alert("Raum erstellen fehlgeschlagen: " + (e && e.message ? e.message : e));
    console.error(e);
  } finally {
    btn.disabled = false;
    setTimeout(function() { if (btn.textContent === "Raum erstellt") btn.textContent = prev; }, 1500);
  }
}

function copyText(sel) {
  const el = qs(sel);
  el.select();
  el.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(el.value).then(function() {
    alert("Kopiert");
  }).catch(function() { document.execCommand("copy"); });
}

async function onLock() {
  const need = needPickCount();
  if (state.selected.size !== need) return;
  const ids = Array.from(state.selected).sort();
  qs("#btnLock").disabled = true;
  try {
    const res = await submitPicks(state.roomId, state.partner, state.key, ids, true);
    if (res && res.ok === false) throw new Error(res.error || "lock failed");
    state.locked = true;
    renderMenus();
    enterWaiting();
  } catch (e) {
    alert("Festlegen fehlgeschlagen: " + e.message);
    qs("#btnLock").disabled = false;
  }
}

function enterWaiting() {
  showScreen("screenWait");
  qs("#waitPartner").textContent = state.partner === "a" ? "Partner B" : "Partner A";
  startPolling();
}

function startPolling() {
  stopPolling();
  const ms = cfg().pollIntervalMs || 3000;
  pollOnce();
  state.pollTimer = setInterval(pollOnce, ms);
}

function stopPolling() {
  if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
}

async function pollOnce() {
  try {
    const st = await getRoomStatus(state.roomId);
    if (!st || !st.ok) return;
    state.fillRound = st.fill_round || 0;
    state.phase = st.phase;
    if (st.accumulated_ids && st.accumulated_ids.length) state.accumulated = st.accumulated_ids;
    const meLocked = state.partner === "a" ? st.a_locked : st.b_locked;
    const otherLocked = state.partner === "a" ? st.b_locked : st.a_locked;
    qs("#waitStatus").textContent = otherLocked ? "Beide haben festgelegt — Match wird berechnet…" : (meLocked ? "Warte auf " + (state.partner === "a" ? "Partner B" : "Partner A") + "…" : "Noch nicht festgelegt");
    if (st.phase === "done" && st.dinner_ids && st.dinner_ids.length) {
      state.dinners = st.dinner_ids;
      state.unused = st.unused_ids || [];
      stopPolling();
      showResults();
      return;
    }
    if (st.both_locked && !state.resolving) await resolveMatches();
    // fill round advanced by other partner
    if (st.phase === "fill" && st.fill_round > 0 && !meLocked) {
      // check if we need to vote again for new round
      const own = await getOwnSubmission(state.roomId, state.partner, state.key, st.fill_round);
      if (!own.locked) {
        stopPolling();
        enterFillRound(st.fill_round, st.accumulated_ids || state.accumulated);
      }
    }
  } catch (e) {
    console.warn(e);
    qs("#waitStatus").textContent = "Sync-Fehler: " + e.message;
  }
}

async function resolveMatches() {
  state.resolving = true;
  try {
    const m = await getMatches(state.roomId);
    if (!m.ready) { state.resolving = false; return; }
    const roundMatches = m.matches || [];
    let acc = (m.accumulated_ids || state.accumulated || []).slice();
    // merge new intersection (unique)
    roundMatches.forEach(function(id) { if (acc.indexOf(id) < 0) acc.push(id); });
    acc.sort();
    state.accumulated = acc;

    // Partner A schreibt Ergebnis / startet Nachwahl (vermeidet Doppel-Inkrement)
    const isLeader = state.partner === "a";
    if (acc.length === TARGET) {
      if (isLeader) await finalizeDinners(state.roomId, state.partner, state.key, acc, []);
      state.dinners = acc; state.unused = [];
      stopPolling(); showResults(); return;
    }
    if (acc.length > TARGET) {
      const pick = await stablePick(state.roomId, acc, TARGET);
      if (isLeader) await finalizeDinners(state.roomId, state.partner, state.key, pick.picked, pick.unused);
      state.dinners = pick.picked; state.unused = pick.unused;
      stopPolling(); showResults(); return;
    }
    // acc.length < TARGET → fill round
    const remaining = MENUS.map(function(x) { return x.id; }).filter(function(id) { return acc.indexOf(id) < 0; });
    if (remaining.length === 0) {
      if (isLeader) await finalizeDinners(state.roomId, state.partner, state.key, acc, []);
      state.dinners = acc; state.unused = [];
      stopPolling(); showResults(); return;
    }
    if (isLeader) {
      await startFillRound(state.roomId, state.partner, state.key, acc);
      const st = await getRoomStatus(state.roomId);
      enterFillRound(st.fill_round, acc);
    } else {
      // B wartet kurz bis A die Runde erhöht hat
      qs("#waitStatus").textContent = "Nachwahl wird vorbereitet…";
      startPolling();
    }
  } catch (e) {
    console.warn(e);
    qs("#waitStatus").textContent = "Resolve-Fehler: " + e.message;
  } finally {
    state.resolving = false;
  }
}

function enterFillRound(round, acc) {
  stopPolling();
  state.fillRound = round;
  state.phase = "fill";
  state.accumulated = acc || [];
  state.excludedIds = new Set(state.accumulated);
  state.selected = new Set();
  state.locked = false;
  state.resolving = false;
  showScreen("screenVote");
  const need = needPickCount();
  qs("#voteTitle").textContent = "Nachwahl-Runde " + round;
  qs("#voteHint").textContent = "Bisher " + state.accumulated.length + " gemeinsame Menüs. Wählt je " + need + " weitere aus den Restmenüs (blind). Ziel: " + TARGET + " Abendessen.";
  qs("#partnerLabel").textContent = "Partner " + state.partner.toUpperCase();
  renderMenus();
}

function showResults() {
  showScreen("screenResult");
  const list = qs("#dinnerList");
  list.innerHTML = "";
  (state.dinners || []).forEach(function(id, i) {
    const m = menuById(id);
    const li = document.createElement("li");
    li.innerHTML = "<strong>" + DAYS[i] + "</strong> — " + (m ? m.short : id);
    list.appendChild(li);
  });
  const unusedBox = qs("#unusedBox");
  if (state.unused && state.unused.length) {
    unusedBox.hidden = false;
    qs("#unusedList").innerHTML = state.unused.map(function(id) {
      const m = menuById(id);
      return "<li>" + (m ? m.title : id) + " <em>(diese Woche ungenutzt)</em></li>";
    }).join("");
  } else unusedBox.hidden = true;
  renderShopping();
}

function renderShopping() {
  const plan = computePlan(state.dinners || []);
  qs("#shopTotal").textContent = "CHF " + formatCHF(plan.aktionTotal);
  qs("#shopMeta").textContent = plan.storeCount + " Stops · ca. " + plan.totalKm.toFixed(1) + " km · Cluster: " + (plan.clusters || []).join(", ");
  const route = qs("#routeList");
  route.innerHTML = "";
  plan.legs.forEach(function(leg, i) {
    const li = document.createElement("li");
    const km = i === 0 ? "Start" : ("+" + leg.kmFromPrev.toFixed(1) + " km");
    const items = (leg.items || []).map(function(it) {
      const price = it.price != null ? "CHF " + formatCHF(it.price) : "";
      const risk = it.glutenRisk ? " <span class=\"warn\">⚠ " + it.glutenRisk + "</span>" : "";
      const pack = it.packSize ? " · " + it.packSize : "";
      return "<li>" + it.name + pack + " — <strong>" + price + "</strong>" + risk + "</li>";
    }).join("");
    li.innerHTML = "<div class=\"route-head\"><span class=\"num\">" + (i + 1) + "</span><div><strong>" + leg.store.name + "</strong><div class=\"muted\">" + leg.store.address + " · " + leg.store.cluster + " · " + km + "</div></div></div><ul class=\"shop-items\">" + items + "</ul>";
    route.appendChild(li);
  });
  const staples = qs("#staplesList");
  staples.innerHTML = (plan.staples || []).map(function(s) { return "<li>" + s + "</li>"; }).join("") || "<li>—</li>";
}

async function enterVoteRoom() {
  qs("#partnerLabel").textContent = "Partner " + state.partner.toUpperCase();
  qs("#voteTitle").textContent = "Blind wählen";
  qs("#voteHint").textContent = "Wähle genau " + PICK_N + " Menüs. Die Auswahl des Partners bleibt geheim. Danach Festlegen.";
  try {
    await getOwnSubmission(state.roomId, state.partner, state.key, 0);
    const st = await getRoomStatus(state.roomId);
    if (st && st.ok) {
      state.fillRound = st.fill_round || 0;
      state.phase = st.phase;
      if (st.accumulated_ids) state.accumulated = st.accumulated_ids;
      if (st.phase === "done" && st.dinner_ids) {
        state.dinners = st.dinner_ids; state.unused = st.unused_ids || [];
        showResults(); return;
      }
      if (st.phase === "fill" && state.fillRound > 0) {
        state.excludedIds = new Set(state.accumulated);
        qs("#voteTitle").textContent = "Nachwahl-Runde " + state.fillRound;
        qs("#voteHint").textContent = "Bisher " + state.accumulated.length + "/" + TARGET + " Matches. Wähle weitere Menüs blind.";
      }
      const own = await getOwnSubmission(state.roomId, state.partner, state.key, state.fillRound);
      if (own && own.menu_ids) state.selected = new Set(own.menu_ids);
      if (own && own.locked) { state.locked = true; enterWaiting(); return; }
    }
  } catch (e) { showAccessError(e.message); return; }
  showScreen("screenVote");
  renderMenus();
}

function bindHome() {
  qs("#btnCreate").addEventListener("click", onCreateRoom);
  qs("#btnCopyA").addEventListener("click", function() { copyText("#urlA"); });
  qs("#btnCopyB").addEventListener("click", function() { copyText("#urlB"); });
}

function bindVote() {
  qs("#btnLock").addEventListener("click", onLock);
}

function bindWait() {
  qs("#btnRefresh").addEventListener("click", pollOnce);
}

function showAccessError(message) {
  stopPolling();
  qs('#accessMessage').textContent = message;
  showScreen('screenAccess');
}

function bindAuth() {
  qs('#loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = qs('#btnLogin');
    button.disabled = true;
    qs('#authMessage').textContent = 'Anmeldung läuft…';
    try {
      await signIn(qs('#loginEmail').value, qs('#loginPassword').value);
      location.reload();
    } catch (error) {
      qs('#authMessage').textContent = error.message;
    } finally {
      qs('#loginPassword').value = '';
      button.disabled = false;
    }
  });
  qs('#btnResetPassword').addEventListener('click', async () => {
    const email = qs('#loginEmail');
    if (!email.reportValidity()) return;
    const button = qs('#btnResetPassword'); button.disabled = true;
    try {
      await requestPasswordReset(email.value);
      qs('#authMessage').textContent = 'Falls dein Konto eingerichtet ist, erhältst du eine E-Mail mit einem Link zum Passwortsetzen.';
    } catch (error) { qs('#authMessage').textContent = error.message; }
    finally { button.disabled = false; }
  });
  qs('#passwordForm').addEventListener('submit', async event => {
    event.preventDefault();
    const password = qs('#newPassword').value;
    if (password !== qs('#repeatPassword').value) {
      qs('#passwordMessage').textContent = 'Die Passwörter stimmen nicht überein.'; return;
    }
    const button = qs('#btnSavePassword'); button.disabled = true;
    try {
      await updatePassword(password);
      sessionStorage.removeItem('bmm_password_setup');
      location.replace(location.pathname + location.search);
    } catch (error) { qs('#passwordMessage').textContent = error.message; }
    finally { button.disabled = false; }
  });
  qs('#btnLogout').addEventListener('click', async () => {
    stopPolling();
    // Remove all private UI immediately, including links and rendered results.
    document.querySelector('main').hidden = true;
    qs('#stickyBar').hidden = true;
    try {
      await signOut(); sessionStorage.removeItem('bmm_password_setup'); location.reload();
    } catch {
      document.querySelector('main').hidden = false;
      showAccessError('Abmelden fehlgeschlagen. Bitte versuche es erneut.');
    }
  });
}

async function init() {
  bindAuth(); bindHome(); bindVote(); bindWait();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
  if (!configured) {
    qs('#authMessage').textContent = 'Die Anmeldung ist noch nicht eingerichtet.';
    qs('#btnLogin').disabled = true; qs('#btnResetPassword').disabled = true;
    showScreen('screenAuth'); return;
  }
  authClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      passwordSetup = true; sessionStorage.setItem('bmm_password_setup','yes');
      if (authReady && activeUserId) showScreen('screenPassword');
    }
    // Account switches and logout in another tab must discard old private DOM.
    if (authReady && (session?.user?.id || null) !== activeUserId && event !== 'TOKEN_REFRESHED') {
      document.querySelector('main').hidden = true;
      qs('#stickyBar').hidden = true;
      location.reload();
    }
  });
  try {
    const session = await currentSession();
    activeUserId = session?.user?.id || null;
    authReady = true;
    if (!session) {
      qs('#modeBadge').textContent = 'Privat';
      if (location.hash.includes('error')) qs('#authMessage').textContent = 'Der Einrichtungslink ist abgelaufen oder ungültig. Bitte fordere einen neuen Link an.';
      showScreen('screenAuth'); return;
    }
    qs('#accountBar').hidden = false;
    const access = await accessStatus();
    qs('#accountLabel').textContent = 'Angemeldet als Partner ' + access.partner.toUpperCase();
    qs('#modeBadge').textContent = 'Privat · Live-Sync';
    qs('#modeBadge').className = 'badge live';
    if (passwordSetup) { showScreen('screenPassword'); return; }
    const params = parseParams();
    if (params.room || params.p || params.key) {
      if (!params.room || !params.key || !['a','b'].includes(params.p)) {
        showAccessError('Dieser Partner-Link ist unvollständig. Bitte öffne den vollständigen Link.'); return;
      }
      if (params.p !== access.partner) {
        showAccessError('Dieser Link gehört zum anderen Partner. Bitte verwende deinen eigenen Link oder melde dich mit dem passenden Konto an.'); return;
      }
      state.roomId=params.room; state.partner=params.p; state.key=params.key;
      await enterVoteRoom();
    } else { showScreen('screenHome'); }
  } catch (error) { showAccessError(error.message); }
}

window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
init();
