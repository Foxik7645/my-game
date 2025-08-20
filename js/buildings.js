import { showToast } from './ui.js';
import { resources, schedulePlayerSave } from './resources.js';

// ===== Константы зданий =====
export const BASE_LEVELS = { /* ... */ };
// ... (DROVOSEKDOM_LEVELS и т.д.)

// ===== Маркеры и данные =====
export const markers = new Map();
export const buildingData = new Map();
// ... (selectedMarkers, otherBaseZones, baseMarker, baseZone, baseMeta)

// ===== Функции зданий =====
export function renderBuildingDoc(id, data){
  // ... (логика отрисовки)
}

export function unrenderBuildingDoc(id){
  // ... 
}

export function makePopupHtml(b){
  // ... (HTML попапа)
}

export function upgradeBuilding(id){
  // ... 
}

export function deleteBuilding(id){
  // ... (с удалением рабочих)
}

export function upgradeBase(){
  // ... 
}

export function cookFood(buildingId){
  // ... 
}

// ===== Кухня поллер =====
function startKitchenPoller(){
  // ... (setInterval для кухни)
}
