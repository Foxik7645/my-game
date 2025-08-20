import { map, spawnTreesBatch, spawnRocksBatch, spawnCornBatch } from './map.js';

// ===== Маркеры и данные =====
export const markers = new Map();
export const buildingData = new Map();

// ===== Функция отрисовки здания =====
export function renderBuildingDoc(id, data){
  if(!map) return;

  const icon = L.icon({
    iconUrl: `./images/${data.type}.png`,
    iconSize: [48,48]
  });

  const marker = L.marker([data.lat, data.lng], { icon }).addTo(map);
  markers.set(id, marker);
  buildingData.set(id, data);

  marker.bindPopup(`<b>${data.type}</b> (Lv.${data.level||1})`);

  // === Спавн ресурсов по типу здания ===
  if(data.type === "drovosekdom"){
    spawnTreesBatch(6, data.lat, data.lng);
  }
  if(data.type === "minehouse"){
    spawnRocksBatch(4, data.lat, data.lng);
  }
  if(data.type === "fermerdom"){
    spawnCornBatch(8, data.lat, data.lng);
  }
}
