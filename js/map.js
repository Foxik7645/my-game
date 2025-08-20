// ===== Карта =====
export let map = null;

export function initMap(){
  map = L.map('map').setView([55.751244,37.618423], 13);
  L.tileLayer('https://cartodb-basemaps-a.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}{r}.png',
    { attribution: '©OpenStreetMap ©Carto', subdomains: 'abcd', maxZoom: 19 }).addTo(map);
}

// ===== Иконки =====
const treeIcons = [
  L.icon({ iconUrl: './images/Tree1.png', iconSize:[32,32] }),
  L.icon({ iconUrl: './images/Tree2.png', iconSize:[32,32] }),
  L.icon({ iconUrl: './images/Tree3.png', iconSize:[32,32] })
];
const rockIcons = [
  L.icon({ iconUrl: './images/Rock1.png', iconSize:[32,32] }),
  L.icon({ iconUrl: './images/Rock2.png', iconSize:[32,32] })
];
const cornIcons = [
  L.icon({ iconUrl: './images/Corn1.png', iconSize:[28,28] }),
  L.icon({ iconUrl: './images/Corn2.png', iconSize:[28,28] })
];

// ===== Коллекции =====
export const trees = new Map();
export const rocks = new Map();
export const corn = new Map();

let treeId = 0, rockId = 0, cornId = 0;

// ===== Функции спавна около здания =====
export function spawnTreesBatch(count=5, baseLat=55.75, baseLng=37.61){
  if(!map) return;
  for(let i=0;i<count;i++){
    const lat = baseLat + (Math.random()-0.5)*0.01; 
    const lng = baseLng + (Math.random()-0.5)*0.01;
    const icon = treeIcons[Math.floor(Math.random()*treeIcons.length)];
    const marker = L.marker([lat,lng],{icon}).addTo(map);
    trees.set(`tree_${treeId++}`, marker);
  }
}

export function spawnRocksBatch(count=3, baseLat=55.75, baseLng=37.61){
  if(!map) return;
  for(let i=0;i<count;i++){
    const lat = baseLat + (Math.random()-0.5)*0.01;
    const lng = baseLng + (Math.random()-0.5)*0.01;
    const icon = rockIcons[Math.floor(Math.random()*rockIcons.length)];
    const marker = L.marker([lat,lng],{icon}).addTo(map);
    rocks.set(`rock_${rockId++}`, marker);
  }
}

export function spawnCornBatch(count=4, baseLat=55.75, baseLng=37.61){
  if(!map) return;
  for(let i=0;i<count;i++){
    const lat = baseLat + (Math.random()-0.5)*0.01;
    const lng = baseLng + (Math.random()-0.5)*0.01;
    const icon = cornIcons[Math.floor(Math.random()*cornIcons.length)];
    const marker = L.marker([lat,lng],{icon}).addTo(map);
    corn.set(`corn_${cornId++}`, marker);
  }
}
