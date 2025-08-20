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

// ===== Служебные функции =====
function randBetween(a,b){ return a + Math.random()*(b-a); }
function metersToLat(m){ return m/111000; }
function metersToLng(m, lat){ return m/(111000*Math.cos(lat*Math.PI/180)); }

// ===== Функции спавна ресурсов =====
import { getDomAnchors } from './buildings.js';
import { getTotalWorkers } from './worker.js';

function spawnAroundAnchors(poolMap, icons, genId, type){
  if(!map) return;
  const anchors = getDomAnchors(type);
  if(anchors.length===0) return;
  const totalLevels = anchors.reduce((s,a)=>s+(a.level||1),0);
  const totalWorkers = getTotalWorkers(type);
  const capacity = totalLevels*5 + totalWorkers*2;
  while(poolMap.size < capacity){
    const anc = anchors[Math.floor(Math.random()*anchors.length)];
    const ang = Math.random()*2*Math.PI;
    const r = randBetween(20,60);
    const lat = anc.lat + metersToLat(r*Math.sin(ang));
    const lng = anc.lng + metersToLng(r*Math.cos(ang), anc.lat);
    const icon = icons[Math.floor(Math.random()*icons.length)];
    const marker = L.marker([lat,lng],{icon}).addTo(map);
    const id = genId();
    poolMap.set(id,{id,lat,lng,marker});
  }
}

export function spawnTreesBatch(){
  spawnAroundAnchors(trees, treeIcons, () => `tree_${treeId++}`, 'drovosekdom');
}

export function spawnRocksBatch(){
  spawnAroundAnchors(rocks, rockIcons, () => `rock_${rockId++}`, 'minehouse');
}

export function spawnCornBatch(){
  spawnAroundAnchors(corn, cornIcons, () => `corn_${cornId++}`, 'fermerdom');
}
