// ===== Инит карты =====
export let map = null;
export function initMap(){
  map = L.map('map').setView([55.751244,37.618423], 13);
  L.tileLayer('https://cartodb-basemaps-a.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}{r}.png',
    { attribution: '©OpenStreetMap ©Carto', subdomains: 'abcd', maxZoom: 19 }).addTo(map);
  // ... (zoomend listener)
}

// ===== Спавн ресурсов (деревья, камни, кукуруза) =====
const TREE_ICONS = [ /* ... */ ];
export const trees = new Map();
// ... (rocks, corn)

export function spawnTreesBatch(){
  // ... 
}

// Аналогично для spawnRocksBatch, spawnCornBatch
