// ============================ main.js (module) ============================

// ============================ Firebase (TOP OF FILE) ============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection, addDoc, onSnapshot, doc, setDoc, getDoc,
  updateDoc, deleteDoc, serverTimestamp, getDocs, query, where,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ---- Firebase config ----
const firebaseConfig = {
  apiKey: "AIzaSyC-cKsUyDM2H1Hs3ouKjRjO2Vxg9QvC880",
  authDomain: "gamemap-84ae8.firebaseapp.com",
  projectId: "gamemap-84ae8",
  storageBucket: "gamemap-84ae8.firebasestorage.app",
  messagingSenderId: "198147414309",
  appId: "1:198147414309:web:33b340d6bf6dbd3d01a2cc",
  measurementId: "G-M2TKZCT4LT",
};

// ---- Init ----
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// Сохраняем сессию между перезагрузками
try { await setPersistence(auth, browserLocalPersistence); } catch {}

// Гугл-провайдер (создаём ровно один раз!)
const provider = new GoogleAuthProvider();

// Если был редирект после выбора аккаунта — подберём результат
try {
  await getRedirectResult(auth);
} catch (e) {
  if (e && e.code !== "auth/no-auth-event") {
    console.warn("[auth] redirect error:", e);
  }
}

// ============================ Helpers (для UI/логики) ============================
const $id = (s) => document.getElementById(s);
const exists = (_name, el) => el || null;
const setOnClick = (el, fn) => { if (el) el.onclick = fn; };
const dlog = (...a) => {
  // В проде можно отключить, оставлю условие на Github Pages/localhost
  if (location.hostname === "localhost" || location.hostname.endsWith(".github.io")) {
    console.log(...a);
  }
};

// Глобальные состояния — держим выше всех функций, чтобы не было ReferenceError
let uid = null;
let playerDocRef = null;
let profileAvatar = "";
let profileNickname = "";
let avatarDraft = "";

// Контейнер тостов — объявляем до showToast
const toasts = $id("toasts");
function showToast(html, actions = [], timeoutMs = 0) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = html;
  if (actions.length) {
    const row = document.createElement("div");
    row.className = "actions";
    actions.forEach((a) => {
      const btn = document.createElement("button");
      btn.textContent = a.text;
      btn.onclick = () => {
        try { a.onClick?.(); } finally { toasts.removeChild(t); }
      };
      row.appendChild(btn);
    });
    t.appendChild(row);
  }
  toasts.appendChild(t);
  if (timeoutMs > 0) {
    setTimeout(() => { if (t.parentNode) toasts.removeChild(t); }, timeoutMs);
  }
}

// ============================ Ресурсы / XP ============================
const BASE_XP = 500;
let level = 1, xp = 0;
const resources = { money: 100, wood: 10, stone: 0, corn: 0, food: 30 };

const rMoney = () => $id("r-money");
const rWood  = () => $id("r-wood");
const rStone = () => $id("r-stone");
const rCorn  = () => $id("r-corn");
const rFood  = () => $id("r-food");

function updateResourcePanel() {
  const box = $id("resources");
  if (!box) return;
  box.innerHTML = `
    <div class="res">💰 <b id="r-money">${resources.money}</b></div>
    <div class="res">🪵 <b id="r-wood">${resources.wood}</b></div>
    <div class="res">🪨 <b id="r-stone">${resources.stone}</b></div>
    <div class="res">🌽 <b id="r-corn">${resources.corn}</b></div>
    <div class="res">🍔 <b id="r-food">${resources.food}</b></div>
  `;
}
updateResourcePanel();

function getRequiredXp(lvl) { return BASE_XP * lvl; }
function addXP(amount) {
  xp += amount;
  let required = getRequiredXp(level);
  while (xp >= required) {
    xp -= required; level++; required = getRequiredXp(level);
    showToast(`📈 Уровень ${level}!`, [], 1500);
  }
  const xpText = $id("xpText");
  const xpFill = document.querySelector("#xpBar .fill");
  if (xpText) xpText.textContent = `Lv ${level} • ${xp}/${required}`;
  if (xpFill) xpFill.style.width = Math.max(0, Math.min(1, xp / required)) * 100 + "%";
}

// Сохранение профиля с дебаунсом
let dirtyPlayer = true;
let saveTimer = null;
function schedulePlayerSave(immediate = false) {
  if (!uid || !playerDocRef) return;
  dirtyPlayer = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!dirtyPlayer) return;
    dirtyPlayer = false;
    try {
      await updateDoc(playerDocRef, {
        money: resources.money, wood: resources.wood, stone: resources.stone,
        corn: resources.corn, food: resources.food, level, xp
      });
    } catch (e) {
      console.warn("Save skipped:", e?.code, e?.message);
    }
  }, immediate ? 0 : 10000);
}
window.addEventListener("beforeunload", () => schedulePlayerSave(true));

// ============================ Карта ============================
await new Promise((r) => { if (window.L) r(); else window.addEventListener("load", r, { once: true }); });
const map = L.map("map").setView([55.751244, 37.618423], 13);
L.tileLayer("https://cartodb-basemaps-a.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}{r}.png", {
  attribution: "©OpenStreetMap ©Carto", subdomains: "abcd", maxZoom: 19
}).addTo(map);

function metersToLat(m) { return m / 111000; }
function metersToLng(m, lat) { return m / (111000 * Math.cos((lat * Math.PI) / 180)); }

const SPRITES_Z_MIN = 0;
function isSpriteZoomVisible(z) { return z >= SPRITES_Z_MIN; }
function setMarkerHidden(m, hidden) {
  const el = m?.getElement?.();
  if (el) el.classList.toggle("is-hidden", hidden);
  if (hidden && m?.isPopupOpen && m.isPopupOpen()) m.closePopup();
}
map.on("zoomend", () => {
  const hidden = !isSpriteZoomVisible(map.getZoom());
  [...markers.values()].forEach((m) => setMarkerHidden(m, hidden));
  trees.forEach((t) => setMarkerHidden(t.marker, hidden));
  rocks.forEach((r) => setMarkerHidden(r.marker, hidden));
  corn.forEach((c) => setMarkerHidden(c.marker, hidden));
  if (ghostMarker) setMarkerHidden(ghostMarker, hidden);
});

// ============================ Здания/Маркер/База ============================
const markers = new Map();        // id -> Leaflet Marker
const buildingData = new Map();   // id -> building doc
const selectedMarkers = new Set();
const otherBaseZones = new Map();

let baseMarker = null, baseZone = null;
let baseMeta = { level: 0, color: "#00ffcc", poly: { angles: [], radii: [] } };

const BASE_LEVELS = {
  1: { radius: 150, icon: 120, cost: 0, paint: 32 },
  2: { radius: 220, icon: 148, cost: 200, paint: 64 },
  3: { radius: 300, icon: 176, cost: 500, paint: 128 },
  4: { radius: 380, icon: 208, cost: 1000, paint: 256 }
};
const DROVOSEKDOM_LEVELS = {
  1: { icon: 96, cost: 150, workers: 3, paint: 60 },
  2: { icon: 112, cost: 350, workers: 5, paint: 72 },
  3: { icon: 128, cost: 650, workers: 9, paint: 84 },
  4: { icon: 144, cost: 1050, workers: 15, paint: 96 }
};
const MINEHOUSE_LEVELS = JSON.parse(JSON.stringify(DROVOSEKDOM_LEVELS));
const FERMERVOM_LEVELS = JSON.parse(JSON.stringify(DROVOSEKDOM_LEVELS));
const HOUSEEAT_LEVELS = {
  1: { icon: 112, cost: 200, cookMs: 60000, paint: 72 },
  2: { icon: 128, cost: 400, cookMs: 45000, paint: 84 },
  3: { icon: 144, cost: 700, cookMs: 30000, paint: 96 },
  4: { icon: 160, cost: 1100, cookMs: 20000, paint: 112 }
};

function randomBrightColor() {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h} 95% 60%)`;
}
function makeBasePolyAround(center, radiusM) {
  const start = Math.random() * Math.PI * 2;
  const angles = [], radii = [];
  for (let i = 0; i < 5; i++) {
    const ang = start + i * (2 * Math.PI / 5);
    const r = radiusM * (0.9 + Math.random() * 0.2);
    angles.push(ang); radii.push(r);
  }
  return { angles, radii };
}
function polyToLatLngs(center, poly) {
  const pts = [];
  for (let i = 0; i < poly.angles.length; i++) {
    const ang = poly.angles[i], r = poly.radii[i];
    const dy = metersToLat(Math.sin(ang) * r);
    const dx = metersToLng(Math.cos(ang) * r, center.lat);
    pts.push([center.lat + dy, center.lng + dx]);
  }
  return pts;
}
function pointInPolygon(latlng, polyLatLngs) {
  let inside = false;
  for (let i = 0, j = polyLatLngs.length - 1; i < polyLatLngs.length; j = i++) {
    const xi = polyLatLngs[i][1], yi = polyLatLngs[i][0];
    const xj = polyLatLngs[j][1], yj = polyLatLngs[j][0];
    const x = latlng.lng, y = latlng.lat;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function applyBaseZone() {
  if (!baseMarker || !baseMeta.level) return;
  const center = baseMarker.getLatLng();
  const pts = polyToLatLngs(center, baseMeta.poly);
  if (baseZone) baseZone.remove();
  baseZone = L.polygon(pts, {
    color: baseMeta.color, weight: 3, opacity: 1,
    fillColor: baseMeta.color, fillOpacity: 0.15, interactive: false
  }).addTo(map);
}
function applyOtherBaseZone(id, b) {
  const center = L.latLng(b.lat, b.lng);
  const pts = polyToLatLngs(center, b.poly || makeBasePolyAround(center, BASE_LEVELS[b.level].radius));
  const color = b.color || "#888";
  const zone = L.polygon(pts, {
    color, weight: 3, opacity: 1,
    fillColor: color, fillOpacity: 0.15, interactive: false
  }).addTo(map);
  otherBaseZones.set(id, zone);
}
function iconSpecForType(type, level = 1) {
  if (type === "base") {
    const lvl = BASE_LEVELS[level] || BASE_LEVELS[1];
    return { size: [lvl.icon, lvl.icon], anchor: [lvl.icon / 2, lvl.icon / 2] };
  }
  const table = type === "houseeat" ? HOUSEEAT_LEVELS
    : type === "drovosekdom" ? DROVOSEKDOM_LEVELS
      : type === "minehouse" ? MINEHOUSE_LEVELS
        : FERMERVOM_LEVELS;
  const lvl = table[level] || table[1];
  return { size: [lvl.icon, lvl.icon], anchor: [lvl.icon / 2, lvl.icon / 2] };
}
function iconUrlForType(type) {
  if (type === "base") return "./images/Base.png";
  if (type === "drovosekdom") return "./images/DrovosekDom.png";
  if (type === "minehouse") return "./images/Minehouse.png";
  if (type === "fermerdom") return "./images/FermerDom.png";
  if (type === "houseeat") return "./images/HouseEat.png";
  return "./images/House.png";
}
function nextBaseCost() { return (baseMeta.level >= 4) ? null : BASE_LEVELS[baseMeta.level + 1].cost; }
function nextCostFor(b) {
  if (b.type === "drovosekdom") return (b.level >= 4) ? null : DROVOSEKDOM_LEVELS[b.level + 1].cost;
  if (b.type === "minehouse") return (b.level >= 4) ? null : MINEHOUSE_LEVELS[b.level + 1].cost;
  if (b.type === "fermerdom") return (b.level >= 4) ? null : FERMERVOM_LEVELS[b.level + 1].cost;
  if (b.type === "houseeat") return (b.level >= 4) ? null : HOUSEEAT_LEVELS[b.level + 1].cost;
  return null;
}

// Рабочие-хранилища по дому
const woodcuttersByHome = new Map();
const minersByHome = new Map();
const farmersByHome = new Map();

// Попап здания
function makePopupHtml(b) {
  const owner = b.owner ? (b.owner === uid ? "(вы)" : b.owner.slice(0, 6)) : "";
  const name = b.name || b.type;
  const canEdit = (b.owner === uid);
  let workersText = "";
  if (b.type === "drovosekdom") {
    const set = woodcuttersByHome.get(b.id) || new Set();
    const max = DROVOSEKDOM_LEVELS[b.level].workers;
    workersText = `<br/>Рабочие: ${set.size}/${max} (наём: 2 🍔 • 5 мин)`;
  } else if (b.type === "minehouse") {
    const set = minersByHome.get(b.id) || new Set();
    const max = MINEHOUSE_LEVELS[b.level].workers;
    workersText = `<br/>Рабочие: ${set.size}/${max} (наём: 2 🍔 • 5 мин)`;
  } else if (b.type === "fermerdom") {
    const set = farmersByHome.get(b.id) || new Set();
    const max = FERMERVOM_LEVELS[b.level].workers;
    workersText = `<br/>Рабочие: ${set.size}/${max} (наём: 2 🍔 • 5 мин)`;
  }
  const hireWood  = (canEdit && b.type === "drovosekdom") ? `<button onclick="hireWoodcutter('${b.id}')">Нанять дровосека (−2 🍔)</button>` : "";
  const hireMiner = (canEdit && b.type === "minehouse")   ? `<button onclick="hireMiner('${b.id}')">Нанять шахтёра (−2 🍔)</button>` : "";
  const hireFarm  = (canEdit && b.type === "fermerdom")   ? `<button onclick="hireFermer('${b.id}')">Нанять фермера (−2 🍔)</button>` : "";

  const upBtn  = (canEdit && b.type !== "base") ? `<button onclick="window.upgradeBuilding('${b.id}')">Улучшить (${nextCostFor(b)}💰)</button>` : "";
  const baseUp = (canEdit && b.type === "base" && nextBaseCost() != null)
    ? `<button onclick="window.upgradeBase()">Улучшить базу (${nextBaseCost()}💰)</button>` : "";

  let eatBlock = "";
  if (b.type === "houseeat") {
    const lvl = HOUSEEAT_LEVELS[b.level] || HOUSEEAT_LEVELS[1];
    const endsAt = b.cookActive ? (b.cookStartMs + lvl.cookMs) : 0;
    const status = b.cookActive
      ? `Статус: готовится… Осталось: <span data-end="${endsAt}" class="cook-eta">—</span>`
      : "Статус: свободна";
    const btn = (!b.cookActive && canEdit)
      ? `<button onclick="window.cookFood('${b.id}')">Приготовить 10 🍔 (−5 🌽, −50 💰)</button>` : "";
    eatBlock = `<br/><hr/>🍳 <b>Кухня</b><br/>${status}<br/>Время готовки: ${Math.round(lvl.cookMs / 1000)} сек.<br/>${btn}`;
  }

  const editBtn = canEdit ? `<button onclick="editBuilding('${b.id}')">Редактировать</button>` : "";
  const delBtn  = canEdit ? `<button onclick="window.deleteBuilding('${b.id}')">Удалить</button>` : "";

  return `🏠 <b>${name}</b><br/>Тип: ${b.type}<br/>Уровень: ${b.level} ${owner ? ("<br/>Владелец: " + owner) : ""}${workersText}${eatBlock}<br/>${editBtn} ${delBtn} ${hireWood} ${hireMiner} ${hireFarm} ${upBtn} ${baseUp}`;
}

// Отрисовка/снятие зданий
function renderBuildingDoc(id, data) {
  const b = { id, ...data };
  b.hp = b.hp ?? 100;
  const existed = markers.has(id);

  if (!existed) {
    const spec = iconSpecForType(b.type, b.level || 1);
    const iconUrl = b.customIcon || iconUrlForType(b.type);
    const marker = L.marker([b.lat, b.lng], { icon: L.icon({ iconUrl, iconSize: spec.size, iconAnchor: spec.anchor }) }).addTo(map);
    setMarkerHidden(marker, !isSpriteZoomVisible(map.getZoom()));
    marker.options.owner = b.owner;
    marker.options.buildingId = id;
    marker.currentIcon = iconUrl;
    marker.bindPopup(makePopupHtml(b));
    marker.on("popupopen", () => marker.setPopupContent(makePopupHtml(buildingData.get(id) || b)));
    marker.on("click", () => {
      const el = marker.getElement();
      if (selectedMarkers.has(marker)) {
        marker.setOpacity(1); selectedMarkers.delete(marker); el?.classList.remove("marker-selected");
      } else if (b.owner === uid) {
        marker.setOpacity(0.7); selectedMarkers.add(marker); el?.classList.add("marker-selected");
      }
    });
    markers.set(id, marker);
    buildingData.set(id, b);
    if (b.owner === uid) {
      if (b.type === "drovosekdom" && !woodcuttersByHome.has(id)) woodcuttersByHome.set(id, new Set());
      if (b.type === "minehouse"   && !minersByHome.has(id))      minersByHome.set(id, new Set());
      if (b.type === "fermerdom"   && !farmersByHome.has(id))     farmersByHome.set(id, new Set());
    }
  } else {
    const marker = markers.get(id);
    const prev = buildingData.get(id);
    buildingData.set(id, b);
    marker.bindPopup(makePopupHtml(b));
    if (prev.level !== b.level) {
      const spec = iconSpecForType(b.type, b.level);
      marker.setIcon(L.icon({ iconUrl: marker.currentIcon || (b.customIcon || iconUrlForType(b.type)), iconSize: spec.size, iconAnchor: spec.anchor }));
    }
  }

  // Зоны баз
  if (b.type === "base" && b.owner === uid) {
    baseMarker = markers.get(id);
    baseMeta.level = b.level;
    baseMeta.color = b.color || randomBrightColor();
    baseMeta.poly = b.poly || makeBasePolyAround(baseMarker.getLatLng(), BASE_LEVELS[b.level].radius);
    applyBaseZone();
  } else if (b.type === "base" && b.owner !== uid && b.poly) {
    applyOtherBaseZone(id, b);
  }

  // Хук для туториала — сообщаем о своих постройках
  try { if (b.owner === uid) window.dispatchEvent(new CustomEvent("mg:building-added", { detail: b })); } catch {}
}
function unrenderBuildingDoc(id) {
  const marker = markers.get(id);
  const b = buildingData.get(id);
  if (!marker) return;
  map.removeLayer(marker);
  markers.delete(id);
  buildingData.delete(id);
  if (b?.type === "base" && b.owner === uid) {
    if (baseZone) { baseZone.remove(); baseZone = null; }
    baseMarker = null; baseMeta = { level: 0, color: randomBrightColor(), poly: { angles: [], radii: [] } };
  } else if (b?.type === "base" && b.owner !== uid) {
    const zone = otherBaseZones.get(id); zone?.remove(); otherBaseZones.delete(id);
  }
}

// ============================ Realtime Firestore ============================
let buildingsUnsub = null;
let playerUnsub = null;
let workersUnsub = null;

function getWorkersColRef(owner = uid) { return collection(db, "players", owner, "workers"); }

function startRealtime() {
  if (!uid) { showToast("Ошибка: пользователь не авторизован.", [], 2500); return; }
  playerDocRef = doc(db, "players", uid);

  playerUnsub = onSnapshot(playerDocRef, (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      resources.money = d.money ?? 100;
      resources.wood  = d.wood ?? 10;
      resources.stone = d.stone ?? 0;
      resources.corn  = d.corn ?? 0;
      resources.food  = d.food ?? 30;
      level = d.level ?? 1;
      xp    = d.xp ?? 0;
      updateResourcePanel();
      addXP(0);
    } else {
      ensurePlayerDoc();
    }
  }, (error) => showToast("Ошибка получения игрока: " + error.message, [], 2500));

  buildingsUnsub = onSnapshot(collection(db, "buildings"), (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type === "added" || ch.type === "modified") renderBuildingDoc(ch.doc.id, ch.doc.data());
      if (ch.type === "removed") unrenderBuildingDoc(ch.doc.id);
    });
  }, (error) => showToast("Ошибка получения зданий: " + error.message, [], 2500));

  // пассивный доход
  setInterval(() => {
    if (baseMeta.level > 0) {
      resources.money += baseMeta.level;
      updateResourcePanel();
      schedulePlayerSave();
    }
  }, 1000);

  startWorkersRealtime();
  startKitchenPoller();
}
async function ensurePlayerDoc() {
  if (!uid) return;
  try {
    const s = await getDoc(playerDocRef);
    if (!s.exists()) {
      await setDoc(playerDocRef, {
        money: 100, wood: 10, stone: 0, corn: 0, food: 30,
        level: 1, xp: 0, createdAt: serverTimestamp()
      });
    }
  } catch (e) {
    showToast("Ошибка создания профиля: " + e.message, [], 2500);
  }
}

// ============================ Ресурсы на карте (спавн с owner) ============================
const TREE_ICONS = [
  new L.Icon({ iconUrl: "./images/Tree1.png", iconSize: [48, 48], iconAnchor: [24, 36] }),
  new L.Icon({ iconUrl: "./images/Tree2.png", iconSize: [48, 48], iconAnchor: [24, 36] }),
  new L.Icon({ iconUrl: "./images/Tree3.png", iconSize: [48, 48], iconAnchor: [24, 36] }),
];
const trees = new Map();
const TREE_SPAWN_INTERVAL_MS = 60000, TREE_RADIUS_MAX_M = 100, TREE_RADIUS_MIN_M = 20;

const ROCK_ICONS = [
  new L.Icon({ iconUrl: "./images/Kamen.png", iconSize: [48, 48], iconAnchor: [24, 36] }),
  new L.Icon({ iconUrl: "./images/Kamen2.png", iconSize: [48, 48], iconAnchor: [24, 36] }),
  new L.Icon({ iconUrl: "./images/Kamen3.png", iconSize: [48, 48], iconAnchor: [24, 36] }),
];
const rocks = new Map();
const ROCK_SPAWN_INTERVAL_MS = 60000, ROCK_RADIUS_MAX_M = 100, ROCK_RADIUS_MIN_M = 20;

const CORN_ICONS = [
  new L.Icon({ iconUrl: "./images/Corn.png", iconSize: [48, 48], iconAnchor: [24, 36] }),
  new L.Icon({ iconUrl: "./images/Corn2.png", iconSize: [48, 48], iconAnchor: [24, 36] }),
  new L.Icon({ iconUrl: "./images/Corn3.png", iconSize: [48, 48], iconAnchor: [24, 36] }),
];
const corn = new Map();
const CORN_SPAWN_INTERVAL_MS = 60000, CORN_RADIUS_MAX_M = 100, CORN_RADIUS_MIN_M = 20;

function randBetween(a, b) { return a + Math.random() * (b - a); }
function pickPointNear(latlng, maxM, minM) {
  const r = randBetween(minM, maxM);
  const ang = Math.random() * 2 * Math.PI;
  return {
    lat: latlng.lat + metersToLat(r) * Math.sin(ang),
    lng: latlng.lng + metersToLng(r * Math.cos(ang), latlng.lat)
  };
}
function getDomAnchors(type) {
  const anchors = [];
  buildingData.forEach((b, id) => {
    if (b.type === type && b.owner === uid) {
      const m = markers.get(id); if (m) anchors.push(m.getLatLng());
    }
  });
  return anchors;
}
function spawnTreesBatch() {
  const anchors = getDomAnchors("drovosekdom"); if (anchors.length === 0) return;
  const totalWorkers = getTotalWorkers("drovosekdom");
  const totalLevel   = getTotalHouseLevel("drovosekdom");
  const CAP = (totalWorkers * 10) + (totalLevel * 5) || 50;
  const need = Math.max(0, CAP - trees.size); if (need === 0) return;
  const toSpawn = Math.min(6, need);
  for (let i = 0; i < toSpawn; i++) {
    const anchor = anchors[Math.floor(Math.random() * anchors.length)];
    const pt = pickPointNear(anchor, TREE_RADIUS_MAX_M, TREE_RADIUS_MIN_M);
    const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    const m = L.marker([pt.lat, pt.lng], { icon: TREE_ICONS[Math.floor(Math.random() * TREE_ICONS.length)] }).addTo(map);
    setMarkerHidden(m, !isSpriteZoomVisible(map.getZoom()));
    trees.set(id, { id, marker: m, lat: pt.lat, lng: pt.lng, owner: uid }); // << owner
  }
}
function spawnRocksBatch() {
  const anchors = getDomAnchors("minehouse"); if (anchors.length === 0) return;
  const totalWorkers = getTotalWorkers("minehouse");
  const totalLevel   = getTotalHouseLevel("minehouse");
  const CAP = (totalWorkers * 10) + (totalLevel * 5) || 50;
  const need = Math.max(0, CAP - rocks.size); if (need === 0) return;
  const toSpawn = Math.min(6, need);
  for (let i = 0; i < toSpawn; i++) {
    const anchor = anchors[Math.floor(Math.random() * anchors.length)];
    const pt = pickPointNear(anchor, ROCK_RADIUS_MAX_M, ROCK_RADIUS_MIN_M);
    const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    const m = L.marker([pt.lat, pt.lng], { icon: ROCK_ICONS[Math.floor(Math.random() * ROCK_ICONS.length)] }).addTo(map);
    setMarkerHidden(m, !isSpriteZoomVisible(map.getZoom()));
    rocks.set(id, { id, marker: m, lat: pt.lat, lng: pt.lng, owner: uid }); // << owner
  }
}
function spawnCornBatch() {
  const anchors = getDomAnchors("fermerdom"); if (anchors.length === 0) return;
  const totalWorkers = getTotalWorkers("fermerdom");
  const totalLevel   = getTotalHouseLevel("fermerdom");
  const CAP = (totalWorkers * 10) + (totalLevel * 5) || 50;
  const need = Math.max(0, CAP - corn.size); if (need === 0) return;
  const toSpawn = Math.min(6, need);
  for (let i = 0; i < toSpawn; i++) {
    const anchor = anchors[Math.floor(Math.random() * anchors.length)];
    const pt = pickPointNear(anchor, CORN_RADIUS_MAX_M, CORN_RADIUS_MIN_M);
    const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    const m = L.marker([pt.lat, pt.lng], { icon: CORN_ICONS[Math.floor(Math.random() * CORN_ICONS.length)] }).addTo(map);
    setMarkerHidden(m, !isSpriteZoomVisible(map.getZoom()));
    corn.set(id, { id, marker: m, lat: pt.lat, lng: pt.lng, owner: uid }); // << owner
  }
}

// ============================ Рабочие ============================
const WC_FRAMES    = ["./images/Drovosek1.png", "./images/Drovosek2.png", "./images/Drovosek3.png", "./images/Drovosek4.png"];
const MINER_FRAMES = ["./images/Miner1.png",   "./images/Miner2.png",   "./images/Miner3.png",   "./images/Miner4.png"];
const FERM_FRAMES  = ["./images/ferma1.png",   "./images/ferma2.png",   "./images/ferma3.png",   "./images/ferma4.png"];
const IDLE_INDEX = 1, FRAME_INTERVAL_MS = 160;
const STEP_SPEED = 0.0009, ARRIVE_EPS = 0.00008;

const WORKER_COST_FOOD = 2;
const WORKER_DURATION_MS = 5 * 60 * 1000;

function makeWorkerDiv(frameUrl, flipped) {
  const html = `<div class="worker"><img src="${frameUrl}" class="${flipped ? "flip-x" : ""}" draggable="false"/></div>`;
  return L.divIcon({ html, className: "", iconSize: [48, 48], iconAnchor: [24, 24] });
}
function nearestTarget(latlng, collectionMap, ownerId) {
  let best = null, bestD = Infinity;
  collectionMap.forEach((t) => {
    if (ownerId && t.owner && t.owner !== ownerId) return; // не чужие
    const d = Math.abs(t.lat - latlng.lat) + Math.abs(t.lng - latlng.lng);
    if (d < bestD) { best = t; bestD = d; }
  });
  return best;
}
function pickWanderPointAround(homeLatLng) {
  const r = randBetween(60, 120);
  const ang = Math.random() * 2 * Math.PI;
  return {
    lat: homeLatLng.lat + metersToLat(r) * Math.sin(ang),
    lng: homeLatLng.lng + metersToLng(r * Math.cos(ang), homeLatLng.lat)
  };
}
function createProgressMarker(anchorLatLng) {
  const div = document.createElement("div"); div.className = "progress-wrap";
  const bar = document.createElement("div"); bar.className = "progress-bar";
  div.appendChild(bar);
  const icon = L.divIcon({ html: div, className: "", iconSize: [64, 8], iconAnchor: [32, 14] });
  const m = L.marker(anchorLatLng, { icon, interactive: false }).addTo(map);
  setMarkerHidden(m, !isSpriteZoomVisible(map.getZoom()));
  return { marker: m, bar };
}
function setAdd(mapSet, key, value) {
  const set = mapSet.get(key) || new Set();
  set.add(value); mapSet.set(key, set);
}

const workerDocs = new Map(); // workerId -> {homeId,type,marker,localOnly?:true}

function createWorkerFromDoc(workerId, homeId, type, expiresAtMs, localOnly = false) {
  const homeMarker = markers.get(homeId); if (!homeMarker) return null;
  const homePos = homeMarker.getLatLng();
  const startAng = Math.random() * 2 * Math.PI, startR = randBetween(10, 25);
  const lat = homePos.lat + metersToLat(startR) * Math.sin(startAng);
  const lng = homePos.lng + metersToLng(startR * Math.cos(startAng), homePos.lat);
  const frames = (type === "wood") ? WC_FRAMES : (type === "miner") ? MINER_FRAMES : FERM_FRAMES;

  const m = L.marker([lat, lng], { icon: makeWorkerDiv(frames[IDLE_INDEX], false) }).addTo(map);
  setMarkerHidden(m, !isSpriteZoomVisible(map.getZoom()));

  const homeOwner = (buildingData.get(homeId) || {}).owner || uid;

  m.worker = {
    id: workerId, type, owner: homeOwner, state: "wander",
    target: pickWanderPointAround(homePos), speed: STEP_SPEED, selected: false, cargo: 0,
    harvest: { targetId: null, startTs: 0, durationMs: 3000, ui: null },
    anim: { frameIndex: IDLE_INDEX, accMs: 0, facingRight: true },
    homeId, frames, expiresAt: expiresAtMs || (Date.now() + WORKER_DURATION_MS)
  };
  m.on("click", () => {
    m.worker.selected = !m.worker.selected; const el = m.getElement();
    if (m.worker.selected) { el?.classList.add("marker-selected"); m.setOpacity(0.9); }
    else { el?.classList.remove("marker-selected"); m.setOpacity(1); }
  });

  const setMap = (type === "wood") ? woodcuttersByHome : (type === "miner") ? minersByHome : farmersByHome;
  setAdd(setMap, homeId, m);
  workerDocs.set(workerId, { homeId, type, marker: m, localOnly });
  refreshPopupForBuilding(homeId);
  return m;
}

// LS fallback для рабочих
function lsKeyWorkers() { return uid ? `mg_workers_${uid}` : "mg_workers_anonymous"; }
function loadLocalWorkers() {
  try { const raw = localStorage.getItem(lsKeyWorkers()); if (!raw) return []; const arr = JSON.parse(raw); const now = Date.now(); return arr.filter((w) => w.expiresAt > now); }
  catch { return []; }
}
function saveLocalWorker(rec) {
  try { const arr = loadLocalWorkers(); arr.push(rec); localStorage.setItem(lsKeyWorkers(), JSON.stringify(arr)); } catch {}
}
function removeLocalWorkerById(id) {
  try { const arr = loadLocalWorkers().filter((w) => w.id !== id); localStorage.setItem(lsKeyWorkers(), JSON.stringify(arr)); } catch {}
}

// наём
window.hireWoodcutter = async (homeId) => hireWorkerGeneric(homeId, "drovosekdom", "wood");
window.hireMiner     = async (homeId) => hireWorkerGeneric(homeId, "minehouse",   "miner");
window.hireFermer    = async (homeId) => hireWorkerGeneric(homeId, "fermerdom",   "fermer");

async function hireWorkerGeneric(homeId, buildingType, type) {
  const b = buildingData.get(homeId);
  if (!b || b.owner !== uid || b.type !== buildingType) return;
  const setMap = (type === "wood") ? woodcuttersByHome : (type === "miner") ? minersByHome : farmersByHome;
  const set = setMap.get(homeId) || new Set();
  const max = (buildingType === "drovosekdom") ? DROVOSEKDOM_LEVELS[b.level].workers
    : (buildingType === "minehouse") ? MINEHOUSE_LEVELS[b.level].workers
      : FERMERVOM_LEVELS[b.level].workers;
  if (set.size >= max) { showToast(`Лимит рабочих ${set.size}/${max}.`, [], 1400); return; }
  if (resources.food < WORKER_COST_FOOD) { showToast("Недостаточно еды 🍔", [], 1400); return; }

  resources.food -= WORKER_COST_FOOD; updateResourcePanel(); schedulePlayerSave();
  const workerDoc = { owner: uid, homeId, type, hiredAt: Date.now(), expiresAt: Date.now() + WORKER_DURATION_MS };

  try {
    await addDoc(getWorkersColRef(), workerDoc);
    showToast("👷 Рабочий нанят на 5 минут!", [], 1500);
  } catch (e) {
    showToast("⚠️ Облако недоступно. Включён локальный режим.", [], 2500);
    const id = "local-" + Math.random().toString(36).slice(2);
    saveLocalWorker({ id, ...workerDoc });
    createWorkerFromDoc(id, homeId, type, workerDoc.expiresAt, true);
  }
}

function startWorkersRealtime() {
  workersUnsub?.(); workersUnsub = null;

  woodcuttersByHome.clear(); minersByHome.clear(); farmersByHome.clear();
  buildingData.forEach((b, id) => {
    if (b.owner === uid) {
      if (b.type === "drovosekdom") woodcuttersByHome.set(id, new Set());
      if (b.type === "minehouse")   minersByHome.set(id, new Set());
      if (b.type === "fermerdom")   farmersByHome.set(id, new Set());
    }
  });

  try {
    workersUnsub = onSnapshot(getWorkersColRef(), (snap) => {
      snap.docChanges().forEach((ch) => {
        const id = ch.doc.id; const data = ch.doc.data();
        if (ch.type === "added") {
          if (!workerDocs.has(id)) createWorkerFromDoc(id, data.homeId, data.type, data.expiresAt);
        } else if (ch.type === "removed") {
          const rec = workerDocs.get(id);
          if (rec) {
            const setMap = (rec.type === "wood") ? woodcuttersByHome : (rec.type === "miner") ? minersByHome : farmersByHome;
            const set = setMap.get(rec.homeId); set?.delete(rec.marker);
            try { map.removeLayer(rec.marker); } catch {}
            workerDocs.delete(id);
            refreshPopupForBuilding(rec.homeId);
          }
        }
      });
    }, (err) => {
      console.warn("Workers snapshot error:", err?.code, err?.message);
      const locals = loadLocalWorkers();
      locals.forEach((w) => { if (!workerDocs.has(w.id)) createWorkerFromDoc(w.id, w.homeId, w.type, w.expiresAt, true); });
    });
  } catch (err) { console.warn("Workers listen failed:", err); }
}

function updateHarvestUI(workerMarker) {
  const w = workerMarker.worker;
  const elapsed = performance.now() - w.harvest.startTs;
  const progress = Math.min(1, elapsed / w.harvest.durationMs);
  if (w.harvest.ui?.bar) { w.harvest.ui.bar.style.width = progress * 100 + "%"; }
  if (elapsed >= w.harvest.durationMs) {
    completeHarvest(workerMarker, (w.type === "wood") ? trees : (w.type === "miner") ? rocks : corn);
  }
}
function startHarvest(workerMarker, targetMap) {
  const w = workerMarker.worker; const tgt = targetMap.get(w.harvest.targetId); if (!tgt) return;
  w.harvest.startTs = performance.now(); w.state = "harvest"; w.anim.frameIndex = IDLE_INDEX; w.anim.accMs = 0;
  workerMarker.setIcon(makeWorkerDiv(w.frames[IDLE_INDEX], !w.anim.facingRight));
  if (w.harvest.ui) map.removeLayer(w.harvest.ui.marker);
  w.harvest.ui = createProgressMarker(workerMarker.getLatLng());
}
function completeHarvest(workerMarker, targetMap, gainMin = 2, gainMax = 5) {
  const w = workerMarker.worker; const tgt = targetMap.get(w.harvest.targetId);
  if (tgt) { map.removeLayer(tgt.marker); targetMap.delete(tgt.id); }
  w.cargo += Math.floor(randBetween(gainMin, gainMax));
  if (w.harvest.ui) { map.removeLayer(w.harvest.ui.marker); w.harvest.ui = null; }
  w.harvest.targetId = null; w.state = "return";
}
async function deliverResources(workerMarker) {
  const w = workerMarker.worker; if (w.cargo <= 0) return;
  if (w.type === "wood") { resources.wood += w.cargo; showToast(`🪵 +${w.cargo}`, [], 900); }
  else if (w.type === "miner") { resources.stone += w.cargo; showToast(`🪨 +${w.cargo}`, [], 900); }
  else { resources.corn += w.cargo; showToast(`🌽 +${w.cargo}`, [], 900); }
  addXP(w.cargo * 2); w.cargo = 0; updateResourcePanel(); schedulePlayerSave();
}

let __lastTs = performance.now();
function moveWorkers() {
  const now = performance.now(); const dt = now - __lastTs; __lastTs = now;
  function updateSet(set, homeId, type) {
    const homeMarker = markers.get(homeId); if (!homeMarker) return;
    const homePos = homeMarker.getLatLng();
    for (const marker of Array.from(set)) {
      const w = marker.worker; const pos = marker.getLatLng();

      // истечение найма
      if (Date.now() >= (w.expiresAt || 0)) {
        const entry = [...workerDocs.entries()].find(([, rec]) => rec.marker === marker);
        if (entry) {
          const [docId, rec] = entry;
          if (rec.localOnly) {
            const setMap = (rec.type === "wood") ? woodcuttersByHome : (rec.type === "miner") ? minersByHome : farmersByHome;
            setMap.get(rec.homeId)?.delete(marker); map.removeLayer(marker);
            workerDocs.delete(docId); removeLocalWorkerById(docId); refreshPopupForBuilding(rec.homeId);
          } else {
            deleteDoc(doc(getWorkersColRef(), docId)).catch(() => {});
          }
        }
        continue;
      }

      if (w.state === "wander") {
        const pool = (type === "wood") ? trees : (type === "miner") ? rocks : corn;
        if (pool.size > 0) {
          const nt = nearestTarget(pos, pool, w.owner); // << только свои
          if (nt) { w.state = "toTarget"; w.target = { lat: nt.lat, lng: nt.lng }; w.harvest.targetId = nt.id; }
        }
      }
      if (w.state === "toTarget") {
        const pool = (type === "wood") ? trees : (type === "miner") ? rocks : corn;
        if (!pool.has(w.harvest.targetId)) { w.state = "wander"; w.target = pickWanderPointAround(homePos); }
      }
      if (w.state === "harvest") updateHarvestUI(marker);

      let target;
      if (w.state === "wander" || w.state === "toTarget") target = w.target;
      else if (w.state === "harvest") target = pos;
      else target = homePos;

      if (w.state !== "harvest") {
        const dLat = target.lat - pos.lat, dLng = target.lng - pos.lng;
        if (Math.abs(dLng) > 1e-8) {
          const goingRight = dLng > 0;
          if (goingRight !== w.anim.facingRight) {
            w.anim.facingRight = goingRight; marker.setIcon(makeWorkerDiv(w.frames[w.anim.frameIndex], !w.anim.facingRight));
          }
        }
        if (Math.abs(dLat) + Math.abs(dLng) < ARRIVE_EPS) {
          if (w.state === "wander") {
            const pool = (type === "wood") ? trees : (type === "miner") ? rocks : corn;
            const nt = nearestTarget(pos, pool, w.owner);
            if (nt) { w.state = "toTarget"; w.target = { lat: nt.lat, lng: nt.lng }; w.harvest.targetId = nt.id; }
            else { w.state = "return"; }
          } else if (w.state === "toTarget") {
            const pool = (type === "wood") ? trees : (type === "miner") ? rocks : corn;
            const tgt = pool.get(w.harvest.targetId);
            if (tgt) { marker.setLatLng([tgt.lat, tgt.lng]); startHarvest(marker, pool); }
            else { w.state = "wander"; w.target = pickWanderPointAround(homePos); }
          } else if (w.state === "return") {
            deliverResources(marker); w.state = "wander"; w.target = pickWanderPointAround(homePos);
          }
        } else {
          marker.setLatLng([pos.lat + dLat * w.speed, pos.lng + dLng * w.speed]);
        }
      }

      const isMoving = (w.state === "wander" || w.state === "toTarget" || w.state === "return");
      if (isMoving) {
        w.anim.accMs += dt;
        if (w.anim.accMs >= FRAME_INTERVAL_MS) {
          w.anim.accMs = 0; w.anim.frameIndex = (w.anim.frameIndex + 1) % w.frames.length;
          marker.setIcon(makeWorkerDiv(w.frames[w.anim.frameIndex], !w.anim.facingRight));
        }
      } else if (w.anim.frameIndex !== IDLE_INDEX) {
        w.anim.frameIndex = IDLE_INDEX; w.anim.accMs = 0; marker.setIcon(makeWorkerDiv(w.frames[IDLE_INDEX], !w.anim.facingRight));
      }
    }
  }
  woodcuttersByHome.forEach((set, homeId) => updateSet(set, homeId, "wood"));
  minersByHome.forEach((set, homeId) => updateSet(set, homeId, "miner"));
  farmersByHome.forEach((set, homeId) => updateSet(set, homeId, "fermer"));
  requestAnimationFrame(moveWorkers);
}
requestAnimationFrame(moveWorkers);

// ============================ Рынок ============================
const overlay = $id("overlay");
const marketMenu = $id("marketMenu");
const marketBtn = $id("marketBtn");
const tabWood = $id("tabWood");
const tabStone = $id("tabStone");
const tabCorn = $id("tabCorn");
const mRate = $id("m-rate");
const mHave = $id("m-have");
const mPacks = $id("m-packs");
const mGet = $id("m-get");
const mDec = $id("m-dec");
const mInc = $id("m-inc");
const mMax = $id("m-max");
const mSell = $id("m-sell");
const mCancel = $id("m-cancel");
const mSellAll = $id("m-sell-all");
const WOOD_PER_PACK = 10, WOOD_PRICE = 50;
const STONE_PER_PACK = 10, STONE_PRICE = 150;
const CORN_PER_PACK = 10, CORN_PRICE = 150;

let marketResource = "wood";
function openMarket() { if (overlay) overlay.style.display = "block"; if (marketMenu) marketMenu.style.display = "block"; setMarketResource(marketResource); updateMarketUI(0, true); }
function closeMarket() { if (overlay) overlay.style.display = "none"; if (marketMenu) marketMenu.style.display = "none"; }
if (marketBtn) marketBtn.onclick = openMarket;
if (overlay) overlay.onclick = closeMarket; if (mCancel) mCancel.onclick = closeMarket;

function setMarketResource(res) {
  marketResource = res;
  if (tabWood) tabWood.classList.toggle("active", res === "wood");
  if (tabStone) tabStone.classList.toggle("active", res === "stone");
  if (tabCorn) tabCorn.classList.toggle("active", res === "corn");
  if (res === "wood") { if (mRate) mRate.textContent = "10 🪵 = 50 💰"; if (mHave) mHave.textContent = resources.wood; }
  else if (res === "stone") { if (mRate) mRate.textContent = "10 🪨 = 150 💰"; if (mHave) mHave.textContent = resources.stone; }
  else { if (mRate) mRate.textContent = "10 🌽 = 150 💰"; if (mHave) mHave.textContent = resources.corn; }
  updateMarketUI(0, true);
}
if (tabWood) tabWood.onclick = () => setMarketResource("wood");
if (tabStone) tabStone.onclick = () => setMarketResource("stone");
if (tabCorn) tabCorn.onclick = () => setMarketResource("corn");
function maxPacks() { return marketResource === "wood" ? Math.floor(resources.wood / WOOD_PER_PACK) : marketResource === "stone" ? Math.floor(resources.stone / STONE_PER_PACK) : Math.floor(resources.corn / CORN_PER_PACK); }
function priceFor(packs) { return marketResource === "wood" ? packs * WOOD_PRICE : marketResource === "stone" ? packs * STONE_PRICE : packs * CORN_PRICE; }
function updateMarketUI(packs, clamp = false) {
  const mx = maxPacks(); if (clamp) packs = Math.max(0, Math.min(mx, packs));
  if (mHave) mHave.textContent = marketResource === "wood" ? resources.wood : marketResource === "stone" ? resources.stone : resources.corn;
  if (mPacks) { mPacks.textContent = packs; mPacks.dataset.value = packs; }
  if (mGet) mGet.textContent = priceFor(packs);
}
function getPacks() { return parseInt(mPacks?.dataset?.value || "0", 10); }
if (mDec) mDec.onclick = () => updateMarketUI(getPacks() - 1, true);
if (mInc) mInc.onclick = () => updateMarketUI(getPacks() + 1, true);
if (mMax) mMax.onclick = () => updateMarketUI(9999, true);
if (mSell) mSell.onclick = async () => {
  const packs = getPacks(); if (packs <= 0) return;
  if (marketResource === "wood") { const need = packs * WOOD_PER_PACK; if (resources.wood < need) return showToast("Недостаточно дерева", [], 1500); resources.wood -= need; resources.money += packs * WOOD_PRICE; }
  else if (marketResource === "stone") { const need = packs * STONE_PER_PACK; if (resources.stone < need) return showToast("Недостаточно камня", [], 1500); resources.stone -= need; resources.money += packs * STONE_PRICE; }
  else { const need = packs * CORN_PER_PACK; if (resources.corn < need) return showToast("Недостаточно кукурузы", [], 1500); resources.corn -= need; resources.money += packs * CORN_PRICE; }
  updateResourcePanel(); schedulePlayerSave(); closeMarket(); showToast("Сделка совершена!", [], 1200);
};
if (mSellAll) mSellAll.onclick = () => { updateMarketUI(maxPacks(), true); mSell?.click(); };

// ============================ Магазин / Постановка ============================
const shopPanel = $id("shopPanel");
setOnClick($id("shopToggle"), () => { if (shopPanel) shopPanel.style.display = (shopPanel.style.display === "block" ? "none" : "block"); });
setOnClick($id("shopClose"), () => { if (shopPanel) shopPanel.style.display = "none"; });
shopPanel?.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("click", (e) => {
    shopPanel.querySelectorAll(".card").forEach((c) => { if (c !== card) c.classList.remove("active"); });
    card.classList.toggle("active"); e.stopPropagation();
  });
});

let placementMode = { active: false, blueprint: null }, ghostMarker = null, ghostFollow = null, placingLock = false;
function makeGhostForBlueprint(bp) {
  removeGhost();
  const spec = iconSpecForType(bp.type, 1);
  const icon = L.icon({ iconUrl: bp.iconUrl, iconSize: spec.size, iconAnchor: spec.anchor });
  ghostMarker = L.marker(map.getCenter(), { icon, interactive: false, opacity: 0.6 }).addTo(map);
  setMarkerHidden(ghostMarker, !isSpriteZoomVisible(map.getZoom()));
  ghostFollow = (e) => { if (ghostMarker) ghostMarker.setLatLng(e.latlng); };
  map.on("mousemove", ghostFollow);
}
function removeGhost() {
  if (ghostFollow) { map.off("mousemove", ghostFollow); ghostFollow = null; }
  if (ghostMarker) { map.removeLayer(ghostMarker); ghostMarker = null; }
}
function pointInsideBase(latlng) {
  if (!baseMarker || !baseMeta.level) return true;
  const pts = polyToLatLngs(baseMarker.getLatLng(), baseMeta.poly);
  return pointInPolygon(latlng, pts);
}
shopPanel?.querySelectorAll(".buyBtn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const card = btn.closest(".card");
    const bp = { type: card.dataset.type, cost: parseInt(card.dataset.cost, 10) || 0, iconUrl: card.dataset.icon, name: card.dataset.name };
    if (!uid) { showToast("Сначала войдите в аккаунт.", [], 1500); return; }
    if (resources.money < bp.cost) { showToast("Недостаточно денег.", [], 1500); return; }
    placementMode = { active: true, blueprint: bp };
    makeGhostForBlueprint(bp);
    if (shopPanel) shopPanel.style.display = "none";
    showToast("Выберите место в зоне базы и кликните.", [], 1800);
  });
});
map.on("click", async (e) => {
  if (!placementMode.active || placingLock) return;
  const bp = placementMode.blueprint;
  if (bp.type !== "base" && !pointInsideBase(e.latlng)) { showToast("Строить можно только в зоне вашей базы.", [], 1800); return; }

  placingLock = true;
  removeGhost();
  const oldMoney = resources.money;
  if (bp.cost > 0) { resources.money -= bp.cost; updateResourcePanel(); }

  try {
    let additionalData = {};
    if (bp.type === "base") {
      additionalData.color = randomBrightColor();
      additionalData.poly = makeBasePolyAround(e.latlng, BASE_LEVELS[1].radius);
    }
    const docRef = await addDoc(collection(db, "buildings"), {
      owner: uid, type: bp.type, name: bp.name || bp.type, level: 1,
      lat: e.latlng.lat, lng: e.latlng.lng, createdAt: serverTimestamp(), ...additionalData
    });
    renderBuildingDoc(docRef.id, {
      owner: uid, type: bp.type, name: bp.name || bp.type, level: 1,
      lat: e.latlng.lat, lng: e.latlng.lng, ...additionalData
    });
    schedulePlayerSave(true);
  } catch (err) {
    resources.money = oldMoney; updateResourcePanel();
    const code = err?.code || "unknown";
    showToast(`❌ Не удалось поставить здание (${code}).`, [], 3000);
  } finally {
    placingLock = false;
    placementMode = { active: false, blueprint: null };
  }
});

// апгрейд/удаление
window.deleteBuilding = async function (id) {
  const b = buildingData.get(id); if (!b || b.owner !== uid) return alert("Можно удалять только свои здания.");
  try {
    if (["drovosekdom", "minehouse", "fermerdom"].includes(b.type)) {
      const qW = query(getWorkersColRef(), where("homeId", "==", id));
      const list = await getDocs(qW);
      const del = [];
      list.forEach((w) => del.push(deleteDoc(w.ref)));
      await Promise.all(del);

      [...workerDocs.entries()].forEach(([wid, rec]) => {
        if (rec.homeId === id) { try { map.removeLayer(rec.marker); } catch {} workerDocs.delete(wid); }
      });

      if (b.type === "drovosekdom") woodcuttersByHome.get(id)?.forEach((m) => { try { map.removeLayer(m); } catch {} }); woodcuttersByHome.delete(id);
      if (b.type === "minehouse")   minersByHome.get(id)?.forEach((m) => { try { map.removeLayer(m); } catch {} });   minersByHome.delete(id);
      if (b.type === "fermerdom")   farmersByHome.get(id)?.forEach((m) => { try { map.removeLayer(m); } catch {} });  farmersByHome.delete(id);
    }
    await deleteDoc(doc(db, "buildings", id));
  } catch (e) {
    showToast("Ошибка при удалении здания: " + e.message, [], 2500);
  }
};
window.upgradeBuilding = async function (id) {
  const b = buildingData.get(id); if (!b || b.owner !== uid) return;
  if (b.level >= 4) return showToast("Макс. уровень.", [], 1200);
  const cost = nextCostFor(b); if (resources.money < cost) return showToast("Недостаточно денег.", [], 1200);
  const oldMoney = resources.money;
  resources.money -= cost; updateResourcePanel();
  try {
    await updateDoc(doc(db, "buildings", id), { level: b.level + 1 });
    showToast("Здание улучшено!", [], 1200);
  } catch (e) {
    resources.money = oldMoney; updateResourcePanel();
    showToast("Ошибка при улучшении здания: " + e.message, [], 2500);
  }
};
window.upgradeBase = async function () {
  if (!baseMarker) return;
  if (baseMeta.level >= 4) return showToast("Макс. уровень базы.", [], 1200);
  const cost = nextBaseCost(); if (resources.money < cost) return showToast("Недостаточно денег.", [], 1200);
  const oldMoney = resources.money;
  const oldLevel = baseMeta.level;
  const oldPoly = JSON.parse(JSON.stringify(baseMeta.poly));
  try {
    resources.money -= cost; updateResourcePanel();
    baseMeta.level += 1;
    const oldR = BASE_LEVELS[oldLevel].radius, newR = BASE_LEVELS[baseMeta.level].radius;
    for (let i = 0; i < baseMeta.poly.radii.length; i++) baseMeta.poly.radii[i] += (newR - oldR) * (0.6 + Math.random() * 0.8);
    applyBaseZone();
    if (baseMarker?.options?.buildingId) {
      await updateDoc(doc(db, "buildings", baseMarker.options.buildingId), { level: baseMeta.level, poly: baseMeta.poly });
    }
  } catch (e) {
    baseMeta.level = oldLevel; baseMeta.poly = oldPoly; resources.money = oldMoney; updateResourcePanel(); applyBaseZone();
    showToast("Ошибка апгрейда базы: " + e.message, [], 2500);
  }
};

// ============================ Кухня ============================
window.cookFood = async function (buildingId) {
  const b = buildingData.get(buildingId); if (!b || b.owner !== uid || b.type !== "houseeat") return;
  const lvl = HOUSEEAT_LEVELS[b.level] || HOUSEEAT_LEVELS[1];
  if (b.cookActive) return;
  if (resources.corn < 5 || resources.money < 50) return showToast("Нужно 5 🌽 и 50 💰", [], 1500);

  resources.corn -= 5; resources.money -= 50; updateResourcePanel(); schedulePlayerSave();
  try {
    await updateDoc(doc(db, "buildings", buildingId), { cookActive: true, cookStartMs: Date.now() });
    showToast("🍳 Готовка началась!", [], 1200);
    refreshPopupForBuilding(buildingId);
  } catch (e) {
    resources.corn += 5; resources.money += 50; updateResourcePanel(); schedulePlayerSave();
    showToast("Ошибка старта готовки: " + e.message, [], 2500);
  }
};
function startKitchenPoller() {
  setInterval(async () => {
    for (const [id, b] of buildingData) {
      if (b.owner !== uid || b.type !== "houseeat" || !b.cookActive) continue;
      const lvl = HOUSEEAT_LEVELS[b.level] || HOUSEEAT_LEVELS[1];
      const ends = (b.cookStartMs || 0) + (lvl.cookMs || 60000);
      if (Date.now() >= ends) {
        resources.food += 10; updateResourcePanel(); schedulePlayerSave();
        try { await updateDoc(doc(db, "buildings", id), { cookActive: false }); }
        catch (e) { buildingData.set(id, { ...b, cookActive: false }); }
        showToast("🍔 Готово! +10 еды", [], 1500);
        refreshPopupForBuilding(id);
      }
    }
    document.querySelectorAll(".cook-eta").forEach((span) => {
      const end = parseInt(span.getAttribute("data-end") || "0", 10);
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      span.textContent = left ? left + " сек" : "0 сек";
    });
  }, 500);
}

// ============================ Редактор спрайта ============================
const editMenu = $id("editMenu");
const canvas = $id("paintCanvas");
const ctx = canvas?.getContext("2d");
const paletteDiv = $id("palette");
const closeEditorBtn = $id("closeEditor");
const canvasInfo = $id("canvasInfo");
let editingMarker = null, logicalSize = 60;
const colors = ["#000","#fff","#ff0000","#00ff00","#0000ff","#ffff00","#00ffff","#ff00ff","#888","#444","#ccc","#fa0","#0af","#f0a","#aaa","#555","#222","#111","#333","#666","#999","#b00","#0b0","#00b","#bb0","#0bb","#b0b"];
let currentColor = colors[0];

function setCanvasLogicalSize(s) { logicalSize = s; if (!canvas || !ctx) return; canvas.width = s; canvas.height = s; if (canvasInfo) canvasInfo.textContent = `Логическое разрешение: ${s}×${s}`; ctx.imageSmoothingEnabled = false; }
function drawPixel(x, y) { if (!ctx) return; ctx.fillStyle = currentColor; ctx.fillRect(x, y, 1, 1); }
canvas?.addEventListener("mousedown", (e) => {
  const r = canvas.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left) * logicalSize / r.width); const y = Math.floor((e.clientY - r.top) * logicalSize / r.height);
  const drag = (ev) => { const rr = canvas.getBoundingClientRect(); const xx = Math.floor((ev.clientX - rr.left) * logicalSize / rr.width); const yy = Math.floor((ev.clientY - rr.top) * logicalSize / rr.height); drawPixel(xx, yy); };
  const up = () => { document.removeEventListener("mousemove", drag); document.removeEventListener("mouseup", up); };
  drawPixel(x, y); document.addEventListener("mousemove", drag); document.addEventListener("mouseup", up);
});
if (paletteDiv) {
  paletteDiv.innerHTML = "";
  colors.forEach((c) => { const d = document.createElement("div"); d.className = "colorTile"; d.style.background = c; d.onclick = () => currentColor = c; paletteDiv.appendChild(d); });
}
window.editBuilding = function (id) {
  const m = markers.get(id); if (!m) return; editingMarker = m; if (editMenu) editMenu.style.display = "flex";
  const b = buildingData.get(id);
  let size;
  if (b.type === "base") size = BASE_LEVELS[b.level].paint;
  else if (b.type === "houseeat") size = HOUSEEAT_LEVELS[b.level].paint;
  else { const table = b.type === "drovosekdom" ? DROVOSEKDOM_LEVELS : b.type === "minehouse" ? MINEHOUSE_LEVELS : FERMERVOM_LEVELS; size = table[b.level].paint; }
  setCanvasLogicalSize(size);
  const img = new Image(); img.crossOrigin = "anonymous"; img.src = m.currentIcon; img.onload = () => { if (!ctx) return; ctx.clearRect(0, 0, logicalSize, logicalSize); ctx.drawImage(img, 0, 0, logicalSize, logicalSize); };
};
$id("saveSprite")?.addEventListener("click", async () => {
  if (!editingMarker) return;
  const id = editingMarker.options.buildingId; const b = buildingData.get(id);
  const dataUrl = canvas.toDataURL();
  const spec = iconSpecForType(b?.type || "", b?.level || 1);
  editingMarker.setIcon(new L.Icon({ iconUrl: dataUrl, iconSize: spec.size, iconAnchor: spec.anchor }));
  editingMarker.currentIcon = dataUrl; editingMarker.bindPopup(makePopupHtml(b));
  if (editMenu) editMenu.style.display = "none"; editingMarker = null;
  try { await updateDoc(doc(db, "buildings", id), { customIcon: dataUrl }); } catch {}
});
if (closeEditorBtn) closeEditorBtn.onclick = () => { if (editMenu) editMenu.style.display = "none"; editingMarker = null; };

// ============================ Горячие клавиши ============================
document.addEventListener("keydown", (e) => {
  if (e.key === "Delete") {
    selectedMarkers.forEach((m) => { const id = m.options.buildingId; const b = buildingData.get(id); if (b && b.owner === uid) window.deleteBuilding(id); });
    selectedMarkers.clear();
  }
});

// ============================ Инициализация ресурсов/воркеров ============================
spawnTreesBatch(); spawnRocksBatch(); spawnCornBatch();
setInterval(spawnTreesBatch, TREE_SPAWN_INTERVAL_MS);
setInterval(spawnRocksBatch, ROCK_SPAWN_INTERVAL_MS);
setInterval(spawnCornBatch, CORN_SPAWN_INTERVAL_MS);

/* ---------- AUTH (Redirect) ---------- */
// Утилиты (если у тебя уже есть свои exists/$id/setOnClick — можно использовать их)

const loginBtn         = $id('loginBtn');
const logoutBtn        = $id('logoutBtn');
const userName         = $id('userName');
const profileBtn       = $id('profileBtn');
const profileOverlay   = $id('profileOverlay');
const profileMenu      = $id('profileMenu');
const avatarInput      = $id('avatarInput');
const profileNameInput = $id('profileName');
const profileIdSpan    = $id('profileId');
const profileAvatarDiv = $id('profileAvatar');
const profileSave      = $id('profileSave');
const profileCancel    = $id('profileCancel');

// Всегда ставим local persistence ДО любых попыток логина/парсинга редиректа
await setPersistence(auth, browserLocalPersistence).catch(()=>{});

// Разбираем результат редиректа, если он был
try {
  const rr = await getRedirectResult(auth);
  if (rr?.user) dlog('[auth] redirect result:', rr.user.uid);
} catch (e) {
  // auth/no-auth-event — это нормально, когда редиректа не было
  if (e?.code !== 'auth/no-auth-event') {
    console.warn('[auth] getRedirectResult error:', e?.code, e?.message);
  }
}

// Кнопка входа — только redirect (надёжно для GitHub Pages)
setOnClick(loginBtn, async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithRedirect(auth, provider);
  } catch (e) {
    showToast('Ошибка входа: ' + (e?.message || e), [], 3000);
  }
});

// Кнопка выхода
setOnClick(logoutBtn, async () => { try { await signOut(auth); } catch {} });

// Профиль (если у тебя есть UI профиля)
function openProfile(){
  if(!uid) return;
  if (profileOverlay) profileOverlay.style.display='block';
  if (profileMenu) profileMenu.style.display='block';
  avatarDraft='';
  if (profileIdSpan) profileIdSpan.textContent = uid;
  if (profileNameInput) profileNameInput.value = profileNickname || '';
  if (profileAvatarDiv) profileAvatarDiv.style.backgroundImage = profileAvatar ? `url('${profileAvatar}')` : '';
  if (avatarInput) avatarInput.value='';
}
function closeProfile(){
  if (profileOverlay) profileOverlay.style.display='none';
  if (profileMenu) profileMenu.style.display='none';
  if (avatarInput) avatarInput.value='';
}
setOnClick(profileBtn, openProfile);
setOnClick(profileCancel, closeProfile);
if (profileOverlay) profileOverlay.onclick = closeProfile;
if (avatarInput) {
  avatarInput.onchange = e => {
    const file = e.target.files?.[0];
    if(file){
      const reader = new FileReader();
      reader.onload = () => {
        avatarDraft = reader.result;
        if (profileAvatarDiv) profileAvatarDiv.style.backgroundImage = `url('${avatarDraft}')`;
      };
      reader.readAsDataURL(file);
    }
  };
}
setOnClick(profileSave, async () => {
  if(!uid || !playerDocRef) return;
  const newName = (profileNameInput?.value?.trim()) || 'Игрок';
  const newAvatar = avatarDraft || profileAvatar;
  try{
    await updateDoc(playerDocRef, { nick: newName, avatar: newAvatar });
    profileNickname = newName; profileAvatar = newAvatar;
    if (userName) userName.textContent = profileNickname;
    if (profileBtn) profileBtn.style.backgroundImage = profileAvatar ? `url('${profileAvatar}')` : '';
    closeProfile();
  }catch(e){
    showToast('Ошибка сохранения профиля: ' + e.message, [], 2500);
  }
});

// ЕДИНСТВЕННЫЙ слушатель состояния — без дублей
onAuthStateChanged(auth, async (user) => {
  dlog('[auth] state:', !!user, user?.uid);

  if (user) {
    // вошли
    uid = user.uid;
    profileNickname = user.displayName || user.email || 'Player';
    profileAvatar = user.photoURL || '';

    if (userName) userName.textContent = profileNickname;
    if (profileBtn) { profileBtn.style.backgroundImage = profileAvatar ? `url('${profileAvatar}')` : ''; profileBtn.style.display='inline-block'; }
    if (loginBtn){ loginBtn.style.display='inline-block'; loginBtn.textContent = 'Сменить аккаунт'; }
    if (logoutBtn) logoutBtn.style.display='inline-block';

    playerDocRef = doc(db, 'players', uid);
    await ensurePlayerDoc();
    startRealtime(); // твоя функция подписок/таймеров
  } else {
    // вышли / нет сессии
    uid = null;
    if (userName) userName.textContent = '';
    if (loginBtn) loginBtn.textContent = 'Войти с Google';
    if (logoutBtn) logoutBtn.style.display='none';
    if (profileBtn){ profileBtn.style.display='none'; profileBtn.style.backgroundImage=''; }
    profileNickname=''; profileAvatar='';

    // Чистка локального состояния (оставил как у тебя)
    try { trees.forEach(t=>{ map.removeLayer(t.marker); }); trees.clear(); } catch {}
    try { rocks.forEach(r=>{ map.removeLayer(r.marker); }); rocks.clear(); } catch {}
    try { corn.forEach(c=>{ map.removeLayer(c.marker); }); corn.clear(); } catch {}

    buildingsUnsub?.(); playerUnsub?.(); workersUnsub?.();
    buildingsUnsub = playerUnsub = workersUnsub = null;

    markers.forEach(m=>{ try{ map.removeLayer(m);}catch(e){} }); markers.clear();
    buildingData.clear();
    if(baseZone) { baseZone.remove(); baseZone = null; }
    baseMarker = null;
    otherBaseZones.forEach(zone => zone.remove());
    otherBaseZones.clear();

    woodcuttersByHome.clear(); minersByHome.clear(); farmersByHome.clear();
    workerDocs.forEach(rec=>{ try{ map.removeLayer(rec.marker);}catch(e){} }); workerDocs.clear();
    soldiers?.forEach?.(m=>{ try{ map.removeLayer(m);}catch(e){} }); soldiers?.clear?.();
  }
}, (error) => {
  console.error('[auth] onAuthStateChanged error:', error?.code, error?.message);
  showToast('Ошибка аутентификации: ' + error.message, [], 2500);
});

// ============================ API для tutorial.js ============================
window.__game = {
  get uid() { return uid; },
  openShop() { const p = $id("shopPanel"); if (p) p.style.display = "block"; },
  closeShop() { const p = $id("shopPanel"); if (p) p.style.display = "none"; },
  addResources(delta) {
    resources.money = (resources.money || 0) + (delta.money || 0);
    resources.wood  = (resources.wood  || 0) + (delta.wood  || 0);
    resources.stone = (resources.stone || 0) + (delta.stone || 0);
    resources.corn  = (resources.corn  || 0) + (delta.corn  || 0);
    resources.food  = (resources.food  || 0) + (delta.food  || 0);
    updateResourcePanel(); schedulePlayerSave();
  },
  toast(msg, ms = 1800) { try { showToast(msg, [], ms); } catch {} },
  highlight(selector, on = true) {
    document.querySelectorAll(".highlight-tut").forEach(e => e.classList.remove("highlight-tut", "pulse"));
    if (on && selector) {
      const el = document.querySelector(selector);
      if (el) {
        el.classList.add("highlight-tut", "pulse");
        if (typeof el.scrollIntoView === "function") {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
    }
  }
};

// ============================================================================
// Конец main.js
// ============================================================================
