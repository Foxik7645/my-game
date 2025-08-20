diff --git a//dev/null b/js/game.js
index 0000000000000000000000000000000000000000..dbb97e008665b56adc583d0dffa1465af14d203c 100644
--- a//dev/null
+++ b/js/game.js
@@ -0,0 +1,620 @@
+import { db, collection, addDoc, onSnapshot, doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, query, getDocs, where } from "./firebase.js";
+import { resources, addXP, schedulePlayerSave, WORKER_COST_FOOD, WORKER_DURATION_MS, uid, playerDocRef, ensurePlayerDoc, setLevelXp } from "./state.js";
+import { showToast, updateResourcePanel } from "./ui.js";
+
+/* ---------- Map ---------- */
+await new Promise(r => { if (window.L) r(); else window.addEventListener('load', r, {once:true}); });
+const map = L.map('map').setView([55.751244,37.618423], 13);
+L.tileLayer('https://cartodb-basemaps-a.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}{r}.png',
+  { attribution: '©OpenStreetMap ©Carto', subdomains: 'abcd', maxZoom: 19 }).addTo(map);
+
+// natural resources placeholders
+const trees = [], rocks = [], corn = [];
+function metersToLat(m){ return m/111000; }
+function metersToLng(m, lat){ return m/(111000*Math.cos(lat*Math.PI/180)); }
+
+const SPRITES_Z_MIN = 0;
+function isSpriteZoomVisible(z){ return z >= SPRITES_Z_MIN; }
+function setMarkerHidden(m, hidden){
+  const el = m?.getElement?.();
+  if(el){ el.classList.toggle('is-hidden', hidden); }
+  if(hidden && m?.isPopupOpen && m.isPopupOpen()) m.closePopup();
+}
+map.on('zoomend', ()=>{
+  const hidden = !isSpriteZoomVisible(map.getZoom());
+  [...markers.values()].forEach(m=>setMarkerHidden(m, hidden));
+  trees.forEach(t=>setMarkerHidden(t.marker, hidden));
+  rocks.forEach(r=>setMarkerHidden(r.marker, hidden));
+  corn.forEach(c=>setMarkerHidden(c.marker, hidden));
+  workerDocs.forEach(rec=>setMarkerHidden(rec.marker, hidden));
+  if(ghostMarker) setMarkerHidden(ghostMarker, hidden);
+});
+
+/* ---------- Buildings ---------- */
+export const markers=new Map();
+export const buildingData=new Map();
+export const selectedMarkers=new Set();
+export const otherBaseZones = new Map();
+
+export let baseMarker=null, baseZone=null;
+export let baseMeta={ level:0, color:'#00ffcc', poly:{angles:[], radii:[]} };
+
+export const BASE_LEVELS = {
+  1: { radius: 150, icon: 120, cost: 0, paint: 32 },
+  2: { radius: 220, icon: 148, cost: 200, paint: 64 },
+  3: { radius: 300, icon: 176, cost: 500, paint: 128 },
+  4: { radius: 380, icon: 208, cost: 1000, paint: 256 },
+};
+export const DROVOSEKDOM_LEVELS = {
+  1: { icon: 96, cost: 150, workers: 3, paint: 60 },
+  2: { icon: 112, cost: 350, workers: 5, paint: 72 },
+  3: { icon: 128, cost: 650, workers: 9, paint: 84 },
+  4: { icon: 144, cost: 1050, workers: 15, paint: 96 },
+};
+export const MINEHOUSE_LEVELS = JSON.parse(JSON.stringify(DROVOSEKDOM_LEVELS));
+export const FERMERDOM_LEVELS = JSON.parse(JSON.stringify(DROVOSEKDOM_LEVELS));
+export const HOUSEEAT_LEVELS = {
+  1: { icon: 112, cost: 200, cookMs: 60_000, paint: 72 },
+  2: { icon: 128, cost: 400, cookMs: 45_000, paint: 84 },
+  3: { icon: 144, cost: 700, cookMs: 30_000, paint: 96 },
+  4: { icon: 160, cost: 1100, cookMs: 20_000, paint: 112 }
+};
+
+function randomBrightColor(){ const h = Math.floor(Math.random()*360); return `hsl(${h} 95% 60%)`; }
+function makeBasePolyAround(center, radiusM){
+  const start = Math.random()*Math.PI*2;
+  const angles=[], radii=[];
+  for(let i=0;i<5;i++){
+    const ang = start + i*(2*Math.PI/5);
+    const r = radiusM * (0.9 + Math.random()*0.2);
+    angles.push(ang); radii.push(r);
+  }
+  return {angles, radii};
+}
+function polyToLatLngs(center, poly){
+  const pts=[];
+  for(let i=0;i<poly.angles.length;i++){
+    const ang=poly.angles[i], r=poly.radii[i];
+    const dy = metersToLat( Math.sin(ang)*r );
+    const dx = metersToLng( Math.cos(ang)*r, center.lat );
+    pts.push([ center.lat + dy, center.lng + dx ]);
+  }
+  return pts;
+}
+function pointInPolygon(latlng, polyLatLngs){
+  let inside=false;
+  for(let i=0,j=polyLatLngs.length-1; i<polyLatLngs.length; j=i++){
+    const xi=polyLatLngs[i][1], yi=polyLatLngs[i][0];
+    const xj=polyLatLngs[j][1], yj=polyLatLngs[j][0];
+    const x=latlng.lng, y=latlng.lat;
+    const intersect = ((yi>y)!=(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi+1e-12)+xi);
+    if(intersect) inside=!inside;
+  }
+  return inside;
+}
+function applyBaseZone(){
+  if(!baseMarker || !baseMeta.level) return;
+  const center = baseMarker.getLatLng();
+  const pts = polyToLatLngs(center, baseMeta.poly);
+  if(baseZone) baseZone.remove();
+  baseZone = L.polygon(pts, {
+    color: baseMeta.color, weight: 3, opacity: 1,
+    fillColor: baseMeta.color, fillOpacity: 0.15, interactive: false
+  }).addTo(map);
+}
+function applyOtherBaseZone(id, b){
+  const center = L.latLng(b.lat, b.lng);
+  const pts = polyToLatLngs(center, b.poly || makeBasePolyAround(center, BASE_LEVELS[b.level].radius));
+  const color = b.color || '#888';
+  const zone = L.polygon(pts, {
+    color, weight: 3, opacity: 1,
+    fillColor: color, fillOpacity: 0.15, interactive: false
+  }).addTo(map);
+  otherBaseZones.set(id, zone);
+}
+export function iconSpecForType(type, level=1){
+  if(type==='base'){
+    const lvl = BASE_LEVELS[level] || BASE_LEVELS[1];
+    return {size:[lvl.icon,lvl.icon], anchor:[lvl.icon/2,lvl.icon/2]};
+  }
+  const table = type==='houseeat'?HOUSEEAT_LEVELS
+              : type==='drovosekdom'?DROVOSEKDOM_LEVELS
+              : type==='minehouse'?MINEHOUSE_LEVELS
+              : FERMERDOM_LEVELS;
+  const lvl = table[level] || table[1];
+  return {size:[lvl.icon,lvl.icon], anchor:[lvl.icon/2,lvl.icon/2]};
+}
+export function iconUrlForType(type){
+  if(type==='base') return './images/Base.png';
+  if(type==='drovosekdom') return './images/DrovosekDom.png';
+  if(type==='minehouse') return './images/Minehouse.png';
+  if(type==='fermerdom') return './images/FermerDom.png';
+  if(type==='houseeat') return './images/HouseEat.png';
+  return './images/House.png';
+}
+export function nextBaseCost(){ return (baseMeta.level>=4)?null:BASE_LEVELS[baseMeta.level+1].cost; }
+export function nextCostFor(b){
+  if(b.type==='drovosekdom') return (b.level>=4)?null:DROVOSEKDOM_LEVELS[b.level+1].cost;
+  if(b.type==='minehouse') return (b.level>=4)?null:MINEHOUSE_LEVELS[b.level+1].cost;
+  if(b.type==='fermerdom') return (b.level>=4)?null:FERMERDOM_LEVELS[b.level+1].cost;
+  if(b.type==='houseeat') return (b.level>=4)?null:HOUSEEAT_LEVELS[b.level+1].cost;
+  return null;
+}
+
+/* Сеты рабочих у домов */
+export const woodcuttersByHome = new Map();
+export const minersByHome = new Map();
+export const farmersByHome = new Map();
+
+/* живой кэш worker-доков */
+export const workerDocs = new Map(); // workerId -> {homeId,type,marker,localOnly?:true}
+
+/* utils */
+function getTotalWorkers(type) {
+  let total = 0;
+  const homes = (type === 'drovosekdom') ? woodcuttersByHome : (type === 'minehouse') ? minersByHome : farmersByHome;
+  homes.forEach(set => total += set.size);
+  return total;
+}
+function getTotalHouseLevel(type) {
+  let total = 0;
+  buildingData.forEach(b => {
+    if (b.type === type && b.owner === uid) total += b.level;
+  });
+  return total;
+}
+
+/* Popup */
+export function refreshPopupForBuilding(id){
+  const marker = markers.get(id);
+  const b = buildingData.get(id);
+  if(marker && b){
+    const html = makePopupHtml(b);
+    const popup = marker.getPopup?.();
+    if(popup){ popup.setContent(html); } else { marker.bindPopup(html); }
+  }
+}
+export function makePopupHtml(b){
+  const owner = b.owner ? (b.owner===uid?'(вы)':b.owner.slice(0,6)) : '';
+  const name = b.name || b.type;
+  const canEdit = (b.owner===uid);
+  let workersText='';
+  if(b.type==='drovosekdom'){
+    const set = woodcuttersByHome.get(b.id) || new Set();
+    const max = DROVOSEKDOM_LEVELS[b.level].workers;
+    workersText = `<br/>Рабочие: ${set.size}/${max} (наём: ${WORKER_COST_FOOD} 🍔 • 5 мин)`;
+  } else if(b.type==='minehouse'){
+    const set = minersByHome.get(b.id) || new Set();
+    const max = MINEHOUSE_LEVELS[b.level].workers;
+    workersText = `<br/>Рабочие: ${set.size}/${max} (наём: ${WORKER_COST_FOOD} 🍔 • 5 мин)`;
+  } else if(b.type==='fermerdom'){
+    const set = farmersByHome.get(b.id) || new Set();
+    const max = FERMERDOM_LEVELS[b.level].workers;
+    workersText = `<br/>Рабочие: ${set.size}/${max} (наём: ${WORKER_COST_FOOD} 🍔 • 5 мин)`;
+  }
+  const hireWood = (canEdit && b.type==='drovosekdom') ? `<button onclick="hireWoodcutter('${b.id}')">Нанять дровосека (−${WORKER_COST_FOOD} 🍔)</button>` : '';
+  const hireMiner= (canEdit && b.type==='minehouse') ? `<button onclick="hireMiner('${b.id}')">Нанять шахтёра (−${WORKER_COST_FOOD} 🍔)</button>` : '';
+  const hireFermer = (canEdit && b.type==='fermerdom') ? `<button onclick="hireFermer('${b.id}')">Нанять фермера (−${WORKER_COST_FOOD} 🍔)</button>` : '';
+  const upBtn = (canEdit && b.type!=='base')
+    ? `<button onclick="window.upgradeBuilding('${b.id}')">Улучшить (${nextCostFor(b)}💰)</button>` : '';
+  const baseUp = (canEdit && b.type==='base' && nextBaseCost()!=null)
+    ? `<button onclick="window.upgradeBase()">Улучшить базу (${nextBaseCost()}💰)</button>` : '';
+  let eatBlock='';
+  if (b.type==='houseeat') {
+    const lvl = HOUSEEAT_LEVELS[b.level] || HOUSEEAT_LEVELS[1];
+    const endsAt = b.cookActive ? (b.cookStartMs + lvl.cookMs) : 0;
+    const status = b.cookActive
+      ? `Статус: готовится… Осталось: <span data-end="${endsAt}" class="cook-eta">—</span>`
+      : 'Статус: свободна';
+    const btn = (!b.cookActive && canEdit)
+      ? `<button onclick="window.cookFood('${b.id}')">Приготовить 10 🍔 (−5 🌽, −50 💰)</button>`
+      : '';
+    eatBlock = `<br/><hr/>🍳 <b>Кухня</b><br/>${status}<br/>Время готовки: ${Math.round(lvl.cookMs/1000)} сек.<br/>${btn}`;
+  }
+  const editBtn = canEdit ? `<button onclick="editBuilding('${b.id}')">Редактировать</button>` : '';
+  const delBtn  = canEdit ? `<button onclick="window.deleteBuilding('${b.id}')">Удалить</button>` : '';
+  return `🏠 <b>${name}</b><br/>Тип: ${b.type}<br/>Уровень: ${b.level} ${owner?('<br/>Владелец: '+owner):''}${workersText}${eatBlock}<br/>${editBtn} ${delBtn} ${hireWood} ${hireMiner} ${hireFermer} ${upBtn} ${baseUp}`;
+}
+
+/* Render building */
+function renderBuildingDoc(id, data){
+  const b = { id, ...data };
+  const existed = markers.has(id);
+  if(!existed){
+    const spec = iconSpecForType(b.type, b.level||1);
+    const iconUrl = b.customIcon || iconUrlForType(b.type);
+    const marker = L.marker([b.lat, b.lng], {icon: L.icon({iconUrl, iconSize: spec.size, iconAnchor: spec.anchor})}).addTo(map);
+    setMarkerHidden(marker, !isSpriteZoomVisible(map.getZoom()));
+    marker.options.owner = b.owner;
+    marker.options.buildingId = id;
+    marker.currentIcon = iconUrl;
+    marker.bindPopup(makePopupHtml(b));
+    marker.on('popupopen', ()=> marker.setPopupContent(makePopupHtml(buildingData.get(id) || b)));
+    marker.on('click', () => {
+      const el = marker.getElement();
+      if(selectedMarkers.has(marker)){
+        marker.setOpacity(1); selectedMarkers.delete(marker); el?.classList.remove('marker-selected');
+      } else if(b.owner===uid){
+        marker.setOpacity(0.7); selectedMarkers.add(marker); el?.classList.add('marker-selected');
+      }
+    });
+    markers.set(id, marker);
+    buildingData.set(id, b);
+    if(b.owner===uid){
+      if(b.type==='drovosekdom' && !woodcuttersByHome.has(id)) woodcuttersByHome.set(id, new Set());
+      if(b.type==='minehouse'   && !minersByHome.has(id))      minersByHome.set(id, new Set());
+      if(b.type==='fermerdom'   && !farmersByHome.has(id))     farmersByHome.set(id, new Set());
+    }
+  } else {
+    const marker = markers.get(id);
+    const prev = buildingData.get(id);
+    buildingData.set(id, b);
+    marker.bindPopup(makePopupHtml(b));
+    if(prev.level !== b.level){
+      const spec = iconSpecForType(b.type, b.level);
+      marker.setIcon(L.icon({iconUrl: marker.currentIcon|| (b.customIcon || iconUrlForType(b.type)), iconSize:spec.size, iconAnchor:spec.anchor}));
+    }
+  }
+  if(b.type==='base' && b.owner===uid){
+    baseMarker = markers.get(id);
+    baseMeta.level = b.level;
+    baseMeta.color = b.color || randomBrightColor();
+    if(b.poly){
+      baseMeta.poly = b.poly;
+    }else{
+      baseMeta.poly = makeBasePolyAround(baseMarker.getLatLng(), BASE_LEVELS[b.level].radius);
+      updateDoc(doc(db,'buildings', id), { poly: baseMeta.poly }).catch(()=>{});
+    }
+    applyBaseZone();
+  } else if(b.type==='base' && b.owner !== uid && b.poly) {
+    applyOtherBaseZone(id, b);
+  }
+}
+function unrenderBuildingDoc(id){
+  const marker = markers.get(id);
+  const b = buildingData.get(id);
+  if(!marker) return;
+  map.removeLayer(marker);
+  markers.delete(id);
+  buildingData.delete(id);
+  if(b?.type==='base' && b.owner===uid){
+    if(baseZone){ baseZone.remove(); baseZone=null; }
+    baseMarker=null; baseMeta={ level:0, color:randomBrightColor(), poly:{angles:[],radii:[]} };
+  } else if (b?.type==='base' && b.owner !== uid) {
+    const zone = otherBaseZones.get(id); zone?.remove(); otherBaseZones.delete(id);
+  }
+}
+
+/* ---------- Firestore listeners ---------- */
+let buildingsUnsub = null;
+let playerUnsub = null;
+let workersUnsub = null;
+
+function getWorkersColRef(owner = uid){
+  return collection(db, 'players', owner, 'workers');
+}
+
+function workerIconFor(type){
+  if(type==='drovosekdom') return './images/Drovosek1.png';
+  if(type==='minehouse') return './images/Miner1.png';
+  return './images/ferma1.png';
+}
+
+function finishWorker(id, data){
+  const rec = workerDocs.get(id);
+  if(!rec) return;
+  if(data.type==='drovosekdom') resources.wood += 10;
+  else if(data.type==='minehouse') resources.stone += 10;
+  else resources.corn += 10;
+  updateResourcePanel();
+  schedulePlayerSave();
+  showToast('Рабочий завершил работу!', [], 1500);
+  deleteDoc(doc(getWorkersColRef(), id)).catch(()=>{});
+}
+
+function startWorkersRealtime(){
+  workersUnsub = onSnapshot(getWorkersColRef(), snap=>{
+    snap.docChanges().forEach(ch=>{
+      const id = ch.doc.id;
+      if(ch.type==='added'){
+        const w = ch.doc.data();
+        const homeMarker = markers.get(w.homeId);
+        const pos = homeMarker?.getLatLng() || map.getCenter();
+        const marker = L.marker(pos, {icon: L.divIcon({className:'worker', html:`<img src="${workerIconFor(w.type)}"/>`})}).addTo(map);
+        setMarkerHidden(marker, !isSpriteZoomVisible(map.getZoom()));
+        const rec = {homeId:w.homeId, type:w.type, marker};
+        const setMap = w.type==='drovosekdom'?woodcuttersByHome:w.type==='minehouse'?minersByHome:farmersByHome;
+        if(!setMap.has(w.homeId)) setMap.set(w.homeId, new Set());
+        setMap.get(w.homeId).add(marker);
+        const endMs = (w.startMs||Date.now()) + WORKER_DURATION_MS;
+        rec.timer = setTimeout(()=>finishWorker(id, w), Math.max(0, endMs - Date.now()));
+        workerDocs.set(id, rec);
+        refreshPopupForBuilding(w.homeId);
+      } else if(ch.type==='removed'){
+        const rec = workerDocs.get(id);
+        if(rec){
+          clearTimeout(rec.timer);
+          try{ map.removeLayer(rec.marker);}catch{};
+          workerDocs.delete(id);
+          const setMap = rec.type==='drovosekdom'?woodcuttersByHome:rec.type==='minehouse'?minersByHome:farmersByHome;
+          setMap.get(rec.homeId)?.delete(rec.marker);
+          refreshPopupForBuilding(rec.homeId);
+        }
+      }
+    });
+  }, err=>showToast('Ошибка рабочих: '+err.message, [], 2500));
+}
+
+async function hireWorker(homeId, type){
+  const b = buildingData.get(homeId);
+  if(!b || b.owner!==uid || b.type!==type) return;
+  const sets = type==='drovosekdom'?woodcuttersByHome:type==='minehouse'?minersByHome:farmersByHome;
+  const levels = type==='drovosekdom'?DROVOSEKDOM_LEVELS:type==='minehouse'?MINEHOUSE_LEVELS:FERMERDOM_LEVELS;
+  const set = sets.get(homeId) || new Set();
+  const max = levels[b.level]?.workers || 0;
+  if(set.size >= max) return showToast('Максимум рабочих.', [], 1500);
+  if(resources.food < WORKER_COST_FOOD) return showToast('Нужно больше еды.', [], 1500);
+  resources.food -= WORKER_COST_FOOD;
+  updateResourcePanel();
+  schedulePlayerSave();
+  try{
+    await addDoc(getWorkersColRef(), {homeId, type, startMs: Date.now()});
+    showToast('Рабочий нанят!', [], 1200);
+  }catch(e){
+    resources.food += WORKER_COST_FOOD;
+    updateResourcePanel();
+    schedulePlayerSave();
+    showToast('Ошибка найма: '+e.message, [], 2500);
+  }
+}
+
+window.hireWoodcutter = id => hireWorker(id,'drovosekdom');
+window.hireMiner = id => hireWorker(id,'minehouse');
+window.hireFermer = id => hireWorker(id,'fermerdom');
+export function startRealtime(){
+  if (!uid) { showToast('Ошибка: пользователь не авторизован.', [], 2500); return; }
+  playerUnsub = onSnapshot(playerDocRef, snap => {
+    if(snap.exists()){
+      const d = snap.data();
+      resources.money = d.money ?? 100;
+      resources.wood  = d.wood  ?? 10;
+      resources.stone = d.stone ?? 0;
+      resources.corn  = d.corn  ?? 0;
+      resources.food  = d.food  ?? 30;
+      setLevelXp(d.level ?? 1, d.xp ?? 0);
+      updateResourcePanel();
+      addXP(0);
+    } else {
+      ensurePlayerDoc();
+    }
+  }, error => showToast('Ошибка получения игрока: ' + error.message, [], 2500));
+
+  buildingsUnsub = onSnapshot(collection(db, 'buildings'), snap => {
+    snap.docChanges().forEach(ch => {
+      if(ch.type === 'added' || ch.type === 'modified') renderBuildingDoc(ch.doc.id, ch.doc.data());
+      if(ch.type === 'removed') unrenderBuildingDoc(ch.doc.id);
+    });
+  }, error => showToast('Ошибка получения зданий: ' + error.message, [], 2500));
+
+  // Пасивный доход — локально; запись в БД дебаунсится
+  setInterval(() => {
+    if (baseMeta.level > 0) {
+      resources.money += baseMeta.level;
+      updateResourcePanel();
+      schedulePlayerSave();
+    }
+  }, 1000);
+
+  startWorkersRealtime();
+  startKitchenPoller();
+}
+
+
+export function resetGame(){
+  buildingsUnsub?.(); playerUnsub?.(); workersUnsub?.();
+  buildingsUnsub = playerUnsub = workersUnsub = null;
+  markers.forEach(m=>{ try{ map.removeLayer(m);}catch(e){} }); markers.clear();
+  buildingData.clear();
+  if(baseZone){ baseZone.remove(); baseZone=null; }
+  baseMarker = null;
+  otherBaseZones.forEach(zone => zone.remove());
+  otherBaseZones.clear();
+  woodcuttersByHome.clear(); minersByHome.clear(); farmersByHome.clear();
+  workerDocs.forEach(rec=>{ try{ map.removeLayer(rec.marker);}catch(e){} }); workerDocs.clear();
+}
+
+let placementMode = { active:false, blueprint:null }, ghostMarker=null, ghostFollow=null, placingLock=false;
+function makeGhostForBlueprint(bp){
+  removeGhost();
+  const spec = iconSpecForType(bp.type, 1);
+  const icon = L.icon({iconUrl: bp.iconUrl, iconSize: spec.size, iconAnchor: spec.anchor});
+  ghostMarker = L.marker(map.getCenter(), {icon, interactive:false, opacity:0.6}).addTo(map);
+  setMarkerHidden(ghostMarker, !isSpriteZoomVisible(map.getZoom()));
+  ghostFollow = (e)=>{ if(ghostMarker) ghostMarker.setLatLng(e.latlng); };
+  map.on('mousemove', ghostFollow);
+}
+function removeGhost(){
+  if(ghostFollow){ map.off('mousemove', ghostFollow); ghostFollow=null; }
+  if(ghostMarker){ map.removeLayer(ghostMarker); ghostMarker=null; }
+}
+function pointInsideBase(latlng){
+  // Базу можно ставить в любом месте, остальные — только в зоне базы, если база существует
+  if(!baseMarker || !baseMeta.level) return true;
+  const pts = polyToLatLngs(baseMarker.getLatLng(), baseMeta.poly);
+  return pointInPolygon(latlng, pts);
+}
+
+export function startPlacement(bp){
+  if(!uid){ showToast('Сначала войдите в аккаунт.',[],1500); return; }
+  if(resources.money < bp.cost){ showToast('Недостаточно денег.',[],1500); return; }
+  placementMode = { active:true, blueprint:bp };
+  makeGhostForBlueprint(bp);
+  showToast('Выберите место в зоне базы и кликните.',[],1800);
+}
+
+
+map.on('click', async e=>{
+  if(!placementMode.active || placingLock) return;
+  const bp = placementMode.blueprint;
+  if(bp.type!=='base' && !pointInsideBase(e.latlng)){ showToast('Строить можно только в зоне вашей базы.',[],1800); return; }
+
+  placingLock = true;
+  removeGhost(); // фикс «летает за курсором»
+  const oldMoney = resources.money;
+  if(bp.cost>0){ resources.money -= bp.cost; updateResourcePanel(); }
+
+  try {
+    let additionalData = {};
+    if (bp.type === 'base') {
+      additionalData.color = randomBrightColor();
+      additionalData.poly = makeBasePolyAround(e.latlng, BASE_LEVELS[1].radius);
+    }
+    const docRef = await addDoc(collection(db,'buildings'), {
+      owner: uid, type: bp.type, name: bp.name||bp.type, level: 1,
+      lat: e.latlng.lat, lng: e.latlng.lng, createdAt: serverTimestamp(), ...additionalData
+    });
+    // локальная отрисовка сразу
+    renderBuildingDoc(docRef.id, {
+      owner: uid, type: bp.type, name: bp.name||bp.type, level: 1,
+      lat: e.latlng.lat, lng: e.latlng.lng, ...additionalData
+    });
+    schedulePlayerSave(true);
+  } catch (err) {
+    resources.money = oldMoney; updateResourcePanel();
+    const code = err?.code || 'unknown';
+    showToast(`❌ Не удалось поставить здание (${code}). Проверь правила Firestore/квоты.`, [], 3000);
+  } finally {
+    placingLock = false;
+    placementMode = {active:false, blueprint:null};
+  }
+});
+
+/* апгрейды/удаление */
+window.deleteBuilding = async function(id){
+  const b = buildingData.get(id); if(!b || b.owner!==uid) return alert('Можно удалять только свои здания.');
+  try {
+    if(['drovosekdom','minehouse','fermerdom'].includes(b.type)){
+      // удалить моих рабочих этой хаты
+      const qW = query(getWorkersColRef(), where('homeId','==', id));
+      const list = await getDocs(qW);
+      const del = [];
+      list.forEach(w => del.push(deleteDoc(w.ref)));
+      await Promise.all(del);
+      // удалить локальных
+      [...workerDocs.entries()].forEach(([wid,rec])=>{
+        if(rec.homeId===id){
+          try{ map.removeLayer(rec.marker);}catch{}
+          workerDocs.delete(wid);
+        }
+      });
+      // подчистить отображение
+      if(b.type==='drovosekdom') woodcuttersByHome.get(id)?.forEach(m=>{try{map.removeLayer(m);}catch{}}), woodcuttersByHome.delete(id);
+      if(b.type==='minehouse')   minersByHome.get(id)?.forEach(m=>{try{map.removeLayer(m);}catch{}}),   minersByHome.delete(id);
+      if(b.type==='fermerdom')   farmersByHome.get(id)?.forEach(m=>{try{map.removeLayer(m);}catch{}}),  farmersByHome.delete(id);
+    }
+    await deleteDoc(doc(db,'buildings', id));
+  } catch (e) {
+    showToast('Ошибка при удалении здания: ' + e.message, [], 2500);
+  }
+};
+
+window.upgradeBuilding = async function(id){
+  const b = buildingData.get(id); if(!b || b.owner!==uid) return;
+  if(b.level>=4) return showToast('Макс. уровень.',[],1200);
+  const cost = nextCostFor(b); if(resources.money<cost) return showToast('Недостаточно денег.',[],1200);
+  const oldMoney = resources.money;
+  resources.money -= cost; updateResourcePanel();
+  try{
+    await updateDoc(doc(db,'buildings', id), { level: b.level+1 });
+    showToast('Здание улучшено!',[],1200);
+  }catch(e){
+    resources.money = oldMoney; updateResourcePanel();
+    showToast('Ошибка при улучшении здания: ' + e.message, [], 2500);
+  }
+};
+
+window.upgradeBase = async function(){
+  if(!baseMarker) return;
+  if(baseMeta.level>=4) return showToast('Макс. уровень базы.',[],1200);
+  const cost = nextBaseCost(); if(resources.money<cost) return showToast('Недостаточно денег.',[],1200);
+  const oldMoney = resources.money;
+  const oldLevel = baseMeta.level;
+  const oldPoly = JSON.parse(JSON.stringify(baseMeta.poly));
+  try{
+    resources.money -= cost; updateResourcePanel();
+    baseMeta.level+=1;
+    const oldR = BASE_LEVELS[oldLevel].radius;
+    const newR = BASE_LEVELS[baseMeta.level].radius;
+    for(let i=0;i<baseMeta.poly.radii.length;i++){ baseMeta.poly.radii[i] += (newR-oldR)*(0.6+Math.random()*0.8); }
+    applyBaseZone();
+    if(baseMarker?.options?.buildingId){
+      await updateDoc(doc(db,'buildings', baseMarker.options.buildingId), { level: baseMeta.level, poly: baseMeta.poly });
+    }
+  }catch(e){
+    // откат
+    baseMeta.level = oldLevel;
+    baseMeta.poly = oldPoly;
+    resources.money = oldMoney;
+    updateResourcePanel(); applyBaseZone();
+    showToast('Ошибка апгрейда базы: ' + e.message, [], 2500);
+  }
+};
+
+/* ---------- КУХНЯ / ГОТОВКА ЕДЫ ---------- */
+window.cookFood = async function(buildingId){
+  const b = buildingData.get(buildingId); if(!b || b.owner!==uid || b.type!=='houseeat') return;
+  const lvl = HOUSEEAT_LEVELS[b.level] || HOUSEEAT_LEVELS[1];
+  if (b.cookActive) return;
+  if (resources.corn < 5 || resources.money < 50){
+    return showToast('Нужно 5 🌽 и 50 💰', [], 1500);
+  }
+  resources.corn -= 5; resources.money -= 50; updateResourcePanel(); schedulePlayerSave();
+  try{
+    await updateDoc(doc(db,'buildings', buildingId), {
+      cookActive: true,
+      cookStartMs: Date.now()
+    });
+    showToast('🍳 Готовка началась!', [], 1200);
+    refreshPopupForBuilding(buildingId);
+  }catch(e){
+    // откат
+    resources.corn += 5; resources.money += 50; updateResourcePanel(); schedulePlayerSave();
+    showToast('Ошибка старта готовки: ' + e.message, [], 2500);
+  }
+};
+
+function startKitchenPoller(){
+  setInterval(async ()=>{
+    for(const [id,b] of buildingData){
+      if(b.owner!==uid || b.type!=='houseeat' || !b.cookActive) continue;
+      const lvl = HOUSEEAT_LEVELS[b.level] || HOUSEEAT_LEVELS[1];
+      const ends = (b.cookStartMs||0) + (lvl.cookMs||60_000);
+      if(Date.now() >= ends){
+        resources.food += 10;
+        updateResourcePanel(); schedulePlayerSave();
+        try{
+          await updateDoc(doc(db,'buildings', id), { cookActive: false });
+        }catch(e){
+          // даже если запись не удалась — локально завершаем
+          buildingData.set(id, {...b, cookActive:false});
+        }
+        showToast('🍔 Готово! +10 еды', [], 1500);
+        refreshPopupForBuilding(id);
+      }
+    }
+    // ETA в попапах
+    document.querySelectorAll('.cook-eta').forEach(span=>{
+      const end = parseInt(span.getAttribute('data-end')||'0',10);
+      const left = Math.max(0, Math.ceil((end - Date.now())/1000));
+      span.textContent = left ? (left+' сек') : '0 сек';
+    });
+  }, 500);
+}
+
+/* ---------- Горячие клавиши ---------- */
+document.addEventListener('keydown', e=>{
+  if(e.key==='Delete'){
+    selectedMarkers.forEach(m=>{ const id=m.options.buildingId; const b=buildingData.get(id); if(b && b.owner===uid) window.deleteBuilding(id); });
+    selectedMarkers.clear();
+  }
+});
