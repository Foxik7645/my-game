// js/buildings.js
import { map, spawnTreesBatch, spawnRocksBatch, spawnCornBatch } from './map.js';
import { showToast } from './ui.js';
import { resources, updateResourcePanel } from './resources.js';

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

// ===== Проверка попадания точки в полигон базы =====
export function isPointInBase(lat, lng) {
  const base = [...buildingData.values()].find(b => b.type === 'base');
  const poly = base?.polygon;
  if (!poly || poly.length < 3) return true;
  return pointInPolygon([lat, lng], poly);
}

function pointInPolygon(point, vs) {
  const x = point[1], y = point[0];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][1], yi = vs[i][0];
    const xj = vs[j][1], yj = vs[j][0];
    const intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

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
export function upgradeBuilding(id) {
  const b = buildingData.get(id);
  if (!b) return;
  b.level = (b.level || 1) + 1;
  const m = markers.get(id);
  if (m) m.bindPopup(makePopupHtml({ id, ...b }));
  showToast(`Здание улучшено до уровня ${b.level}`);
}

export function deleteBuilding(id) {
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

export function cookFood(buildingId) {
  if (resources.money < COOK_COST_MONEY || resources.corn < COOK_COST_CORN) {
    showToast('Недостаточно ресурсов для готовки');
    return;
  }
  resources.money -= COOK_COST_MONEY;
  resources.corn  -= COOK_COST_CORN;
  resources.food  += COOK_GAIN_FOOD;
  updateResourcePanel();
  showToast(`Приготовлено ${COOK_GAIN_FOOD} 🍔`);
}
