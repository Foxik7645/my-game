import { map } from '../map.js';
import { makePopupHtml } from './popup.js';

const markers = new Map();

function renderBuilding(b){
  const marker = L.marker([b.lat, b.lng], { buildingId: b.id }).addTo(map);
  marker.bindPopup(makePopupHtml(b));
  markers.set(b.id, marker);
  return marker;
}

function upgradeBuilding(id){
  return markers.get(id);
}

function initBuildings(){
  // placeholder for loading existing buildings
}

export { initBuildings, renderBuilding, upgradeBuilding };
