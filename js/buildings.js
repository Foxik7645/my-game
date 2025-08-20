// js/buildings.js
import { map, spawnTreesBatch, spawnRocksBatch, spawnCornBatch } from './map.js';
import { showToast } from './ui.js';
import { resources, updateResourcePanel } from './resources.js';

// ===== Иконки зданий (маппинг тип -> файл) =====
const BUILDING_ICONS = {
  drovosekdom: './images/DrovosekDom.png',
  minehouse:   './images/Minehouse.png',
  base:        './images/Base.png',
  fermerdom:   './images/FermerDom.png',
  houseeat:    './images/HouseEat.png',
};

// ===== Маркеры/данные =====
export const markers = new Map();       // id -> Leaflet marker
export const buildingData = new Map();  // id -> {type, lat, lng, level, ...}

// ===== Отрисовка здания =====
export function renderBuildingDoc(id, data){
  if (!map) return;

  const url = BUILDING_ICONS[data.type] || BUILDING_ICONS.base;
  const icon = L.icon({ iconUrl: url, iconSize: [48,48] });
  const marker = L.marker([data.lat, data.lng], { icon }).addTo(map);

  markers.set(id, marker);
  buildingData.set(id, { ...data });

  marker.bindPopup(makePopupHtml({ id, ...data }));

  // Ресурсы появляются ТОЛЬКО при постройке здания рядом с ним
  if (data.type === 'drovosekdom')  spawnTreesBatch(6, data.lat, data.lng);
  if (data.type === 'minehouse')    spawnRocksBatch(4, data.lat, data.lng);
  if (data.type === 'fermerdom')    spawnCornBatch(8, data.lat, data.lng);
}

export function unrenderBuildingDoc(id){
  const m = markers.get(id);
  if (m) { m.remove(); markers.delete(id); }
  buildingData.delete(id);
}

// ===== Попапы =====
export function makePopupHtml(b){
  const lvl = b.level || 1;

  if (b.type === 'houseeat') {
    return `
      <div class="pixel">
        <b>Кухня</b> • Lv.${lvl}<br/>
        Готовит 10 🍔 за 5 🌽 + 50 💰<br/>
        <button onclick="cookFood('${b.id}')">Приготовить</button>
      </div>`;
  }
  if (b.type === 'drovosekdom') return `<div class="pixel"><b>Дом дровосека</b> • Lv.${lvl}</div>`;
  if (b.type === 'minehouse')   return `<div class="pixel"><b>Дом шахтёра</b> • Lv.${lvl}</div>`;
  if (b.type === 'fermerdom')   return `<div class="pixel"><b>Дом фермера</b> • Lv.${lvl}</div>`;
  if (b.type === 'base')        return `<div class="pixel"><b>База</b> • Lv.${lvl}</div>`;
  return `<div class="pixel"><b>${b.type}</b> • Lv.${lvl}</div>`;
}

// ===== Простейшие заглушки апгрейдов/удаления =====
export function upgradeBuilding(id){
  const b = buildingData.get(id);
  if (!b) return;
  b.level = (b.level || 1) + 1;
  const m = markers.get(id);
  if (m) m.bindPopup(makePopupHtml({ id, ...b }));
  showToast(`Здание улучшено до уровня ${b.level}`);
}

export function deleteBuilding(id){
  unrenderBuildingDoc(id);
  showToast('Здание удалено');
}

export function upgradeBase(){
  showToast('База: апгрейд (заглушка)');
}

// ===== Кухня: готовка =====
const COOK_COST_MONEY = 50;
const COOK_COST_CORN  = 5;
const COOK_GAIN_FOOD  = 10;

export function cookFood(buildingId){
  // buildingId сейчас не используется, оставлен для совместимости API
  if (resources.money < COOK_COST_MONEY || resources.corn < COOK_COST_CORN){
    showToast('Недостаточно ресурсов для готовки');
    return;
  }
  resources.money -= COOK_COST_MONEY;
  resources.corn  -= COOK_COST_CORN;
  resources.food  += COOK_GAIN_FOOD;
  updateResourcePanel();
  showToast(`Приготовлено ${COOK_GAIN_FOOD} 🍔`);
}
