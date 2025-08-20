// js/buildings.js
import { map, spawnTreesBatch, spawnRocksBatch, spawnCornBatch } from './map.js';
import { showToast } from './ui.js';
import { resources, updateResourcePanel } from './resources.js';

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, doc, collection, query, updateDoc, deleteDoc, getDoc, getDocs, where } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-cKsUyDM2H1Hs3ouKjRjO2Vxg9QvC880",
  authDomain: "gamemap-84ae8.firebaseapp.com",
  projectId: "gamemap-84ae8",
  storageBucket: "gamemap-84ae8.firebasestorage.app",
  messagingSenderId: "198147414309",
  appId: "1:198147414309:web:33b340d6bf6dbd3d01a2cc",
  measurementId: "G-M2TKZCT4LT"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===== Иконки зданий (по умолчанию) =====
const BUILDING_ICONS = {
  drovosekdom: './images/DrovosekDom.png',
  minehouse:   './images/Minehouse.png',
  base:        './images/Base.png',
  fermerdom:   './images/FermerDom.png',
  houseeat:    './images/HouseEat.png',
};

// ===== Маркеры и данные =====
export const markers = new Map();       // id -> Leaflet marker
export const buildingData = new Map();  // id -> {type, lat, lng, level, iconUrl?, ...}

// ===== Отрисовка здания =====
export function renderBuildingDoc(id, data) {
  if (!map) return;

  // если есть кастомный url — используем его
  const url = data.iconUrl || BUILDING_ICONS[data.type] || BUILDING_ICONS.base;

  const icon = L.icon({ iconUrl: url, iconSize: [48, 48] });
  const marker = L.marker([data.lat, data.lng], { icon }).addTo(map);

  markers.set(id, marker);
  buildingData.set(id, { ...data });

  marker.bindPopup(makePopupHtml({ id, ...data }));

  // Спавн ресурсов только при постройке соответствующего здания
  if (data.type === 'drovosekdom') spawnTreesBatch(6, data.lat, data.lng);
  if (data.type === 'minehouse')   spawnRocksBatch(4, data.lat, data.lng);
  if (data.type === 'fermerdom')   spawnCornBatch(8, data.lat, data.lng);
}

// ===== Удаление здания =====
export function unrenderBuildingDoc(id) {
  const m = markers.get(id);
  if (m) {
    m.remove();
    markers.delete(id);
  }
  buildingData.delete(id);
}

// ===== Попапы зданий =====
export function makePopupHtml(b) {
  const lvl = b.level || 1;
  const id = b.id;
  const editBtn = `<button onclick="editBuilding('${id}')">✏️ Редактировать</button>`;
  const delBtn  = `<button onclick="window.deleteBuilding('${id}')">Удалить</button>`;
  const upBtn   = `<button onclick="window.upgradeBuilding('${id}')">Улучшить</button>`;

  if (b.type === 'houseeat') {
    return `<div class="pixel"><b>Кухня</b> • Lv.${lvl}<br/>Готовит 10 🍔 за 5 🌽 + 50 💰<br/><button onclick="cookFood('${id}')">Приготовить</button><br/>${editBtn} ${delBtn}</div>`;
  }
  if (b.type === 'drovosekdom') {
    return `<div class="pixel"><b>Дом дровосека</b> • Lv.${lvl}<br/><button onclick="hireWoodcutter('${id}')">Нанять рабочего</button><br/>${upBtn}<br/>${editBtn} ${delBtn}</div>`;
  }
  if (b.type === 'minehouse') {
    return `<div class="pixel"><b>Дом шахтёра</b> • Lv.${lvl}<br/><button onclick="hireMiner('${id}')">Нанять рабочего</button><br/>${upBtn}<br/>${editBtn} ${delBtn}</div>`;
  }
  if (b.type === 'fermerdom') {
    return `<div class="pixel"><b>Дом фермера</b> • Lv.${lvl}<br/><button onclick="hireFermer('${id}')">Нанять рабочего</button><br/>${upBtn}<br/>${editBtn} ${delBtn}</div>`;
  }
  if (b.type === 'base') {
    return `<div class="pixel"><b>База</b> • Lv.${lvl}<br/><button onclick="window.upgradeBase()">Улучшить базу</button><br/>${editBtn} ${delBtn}</div>`;
  }
  return `<div class="pixel"><b>${b.type}</b> • Lv.${lvl}<br/>${upBtn}<br/>${editBtn} ${delBtn}</div>`;
}

// ===== Апгрейды / удаление =====
const UPGRADE_COST_MONEY = 100;

export async function upgradeBuilding(id) {
  const b = buildingData.get(id);
  if (!b) return;
  if (resources.money < UPGRADE_COST_MONEY) {
    showToast('Недостаточно денег');
    return;
  }
  resources.money -= UPGRADE_COST_MONEY;
  updateResourcePanel();
  b.level = (b.level || 1) + 1;
  const m = markers.get(id);
  if (m) m.bindPopup(makePopupHtml({ id, ...b }));
  try {
    await updateDoc(doc(db, 'buildings', id), { level: b.level });
  } catch (e) {
    console.error('upgradeBuilding updateDoc', e);
  }
  showToast(`Здание улучшено до уровня ${b.level}`);
}

export async function deleteBuilding(id) {
  const user = auth.currentUser;
  if (user) {
    try {
      const workersRef = collection(db, `players/${user.uid}/workers`);
      const q = query(workersRef, where('homeId', '==', id));
      const snap = await getDocs(q);
      for (const w of snap.docs) {
        await deleteDoc(w.ref);
      }
    } catch (e) {
      console.error('deleteBuilding workers cleanup', e);
    }
  }
  try {
    await deleteDoc(doc(db, 'buildings', id));
  } catch (e) {
    console.error('deleteBuilding deleteDoc', e);
  }
  unrenderBuildingDoc(id);
  showToast('Здание удалено');
}

export function upgradeBase() {
  showToast('База: апгрейд (заглушка)');
}

// ===== Кухня: готовка =====
const COOK_COST_MONEY = 50;
const COOK_COST_CORN  = 5;
const COOK_GAIN_FOOD  = 10;
const COOK_TIME_MS    = 5000;

export async function cookFood(buildingId) {
  if (resources.money < COOK_COST_MONEY || resources.corn < COOK_COST_CORN) {
    showToast('Недостаточно ресурсов для готовки');
    return;
  }
  resources.money -= COOK_COST_MONEY;
  resources.corn  -= COOK_COST_CORN;
  updateResourcePanel();
  const docRef = doc(db, 'buildings', buildingId);
  try {
    await updateDoc(docRef, { cookActive: true, cookStartMs: Date.now() });
  } catch (e) {
    console.error('cookFood start', e);
  }
  const timer = setInterval(async () => {
    try {
      const snap = await getDoc(docRef);
      const data = snap.data();
      if (!data?.cookActive) {
        clearInterval(timer);
        return;
      }
      if (Date.now() - (data.cookStartMs || 0) >= COOK_TIME_MS) {
        await updateDoc(docRef, { cookActive: false });
        resources.food += COOK_GAIN_FOOD;
        updateResourcePanel();
        showToast(`Приготовлено ${COOK_GAIN_FOOD} 🍔`);
        clearInterval(timer);
      }
    } catch (e) {
      console.error('cookFood poll', e);
    }
  }, 1000);
}
