import { resources, schedulePlayerSave, addXP, updateResourcePanel } from './resources.js';
import { showToast } from './ui.js';
import { WORKER_COST_FOOD, WORKER_DURATION_MS, WC_FRAMES, MINER_FRAMES, FERM_FRAMES, FRAME_INTERVAL_MS, STEP_SPEED, ARRIVE_EPS } from './constants.js';
import { markers, buildingData } from './buildings.js';
import { map, trees, rocks, corn } from './map.js';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from './main.js';

// ===== Служебные функции =====
function randBetween(a,b){ return a + Math.random()*(b-a); }
function metersToLat(m){ return m/111000; }
function metersToLng(m, lat){ return m/(111000*Math.cos(lat*Math.PI/180)); }
function makeWorkerDiv(frameUrl, flipped){
  const html = `<div class="worker"><img src="${frameUrl}" class="${flipped?'flip-x':''}" draggable="false"/></div>`;
  return L.divIcon({ html, className:'', iconSize:[48,48], iconAnchor:[24,24] });
}
function nearestTarget(latlng, collectionMap){
  let best=null, bestD=Infinity;
  collectionMap.forEach(t=>{
    const d = Math.abs(t.lat - latlng.lat) + Math.abs(t.lng - latlng.lng);
    if(d<bestD){ best=t; bestD=d; }
  });
  return best;
}
function pickWanderPointAround(homeLatLng){
  const r = randBetween(60,120);
  const ang = Math.random()*2*Math.PI;
  return {
    lat: homeLatLng.lat + metersToLat(r)*Math.sin(ang),
    lng: homeLatLng.lng + metersToLng(r*Math.cos(ang), homeLatLng.lat)
  };
}

// ===== Коллекции рабочих =====
export const woodcuttersByHome = new Map();
export const minersByHome = new Map();
export const farmersByHome = new Map();
const workerDocs = new Map(); // id -> {homeId,type,marker,expiresAt,local}
const localWorkerCache = new Map(); // id -> {homeId,type,expiresAt}
let currentUid = null;

const WORKERS_PER_LEVEL = {1:3,2:5,3:9,4:15};

export function getTotalWorkers(type){
  let total = 0;
  const mapSet = type==='drovosekdom'?woodcuttersByHome:type==='minehouse'?minersByHome:farmersByHome;
  mapSet.forEach(set => total += set.size);
  return total;
}

function setAdd(mapSet, key, value){
  const set = mapSet.get(key) || new Set();
  set.add(value); mapSet.set(key, set);
}

export function createWorkerFromDoc(workerId, homeId, type, expiresAtMs, isLocal=false){
  const homeMarker = markers.get(homeId); if(!homeMarker) return null;
  const homePos = homeMarker.getLatLng();
  const startAng=Math.random()*2*Math.PI, startR=randBetween(10,25);
  const lat=homePos.lat + metersToLat(startR)*Math.sin(startAng);
  const lng=homePos.lng + metersToLng(startR*Math.cos(startAng), homePos.lat);
  const frames = type==='wood'?WC_FRAMES:type==='miner'?MINER_FRAMES:FERM_FRAMES;
  const m=L.marker([lat,lng],{icon: makeWorkerDiv(frames[1], false)}).addTo(map);
  m.worker = {
    id: workerId, type,
    state:'wander', target: pickWanderPointAround(homePos), speed:STEP_SPEED,
    selected:false, cargo:0,
    harvest:{targetId:null,startTs:0,durationMs:3000},
    anim:{frameIndex:1, accMs:0, facingRight:true},
    homeId, frames, expiresAt: expiresAtMs, local:isLocal
  };
  m.on('click', ()=>{
    m.worker.selected = !m.worker.selected;
    const el=m.getElement();
    if(m.worker.selected){ el?.classList.add('marker-selected'); m.setOpacity(0.9);} else { el?.classList.remove('marker-selected'); m.setOpacity(1);}
  });
  const setMap = type==='wood'?woodcuttersByHome:type==='miner'?minersByHome:farmersByHome;
  setAdd(setMap, homeId, m);
  workerDocs.set(workerId, {homeId,type,marker:m,expiresAt:expiresAtMs, local:isLocal});
  return m;
}

export function hireWoodcutter(homeId){ hireWorkerGeneric(homeId,'drovosekdom','wood'); }
export function hireMiner(homeId){ hireWorkerGeneric(homeId,'minehouse','miner'); }
export function hireFermer(homeId){ hireWorkerGeneric(homeId,'fermerdom','fermer'); }

async function hireWorkerGeneric(homeId, buildingType, type){
  const b = buildingData.get(homeId);
  if(!b || b.type!==buildingType) return;
  const setMap = type==='wood'?woodcuttersByHome:type==='miner'?minersByHome:farmersByHome;
  const set = setMap.get(homeId) || new Set();
  const max = WORKERS_PER_LEVEL[b.level] || 3;
  if(set.size>=max){ showToast(`Лимит рабочих ${set.size}/${max}.`,[],1400); return; }
  if(resources.food < WORKER_COST_FOOD){ showToast('Недостаточно еды 🍔',[],1400); return; }

  resources.food -= WORKER_COST_FOOD;
  updateResourcePanel();
  schedulePlayerSave();

  const expiresAt = Date.now()+WORKER_DURATION_MS;
  try {
    if(!currentUid) throw new Error('no uid');
    const workersRef = collection(db, 'players', currentUid, 'workers');
    const docRef = await addDoc(workersRef, { homeId, type, expiresAt });
    createWorkerFromDoc(docRef.id, homeId, type, expiresAt);
  } catch(e){
    const id = 'local-'+Math.random().toString(36).slice(2);
    localWorkerCache.set(id, {homeId,type,expiresAt});
    createWorkerFromDoc(id, homeId, type, expiresAt, true);
  }
  showToast('👷 Рабочий нанят на 5 минут!',[],1500);
}

export function startWorkersRealtime(uid){
  currentUid = uid;
  workerDocs.forEach(({marker})=>map.removeLayer(marker));
  workerDocs.clear();
  woodcuttersByHome.clear(); minersByHome.clear(); farmersByHome.clear();
  buildingData.forEach((b,id)=>{
    if(b.type==='drovosekdom') woodcuttersByHome.set(id,new Set());
    if(b.type==='minehouse')   minersByHome.set(id,new Set());
    if(b.type==='fermerdom')   farmersByHome.set(id,new Set());
  });

  if(!uid) return;

  const workersRef = collection(db, 'players', uid, 'workers');
  const q = query(workersRef, where('expiresAt', '>', Date.now()));
  try {
    onSnapshot(q, snapshot => {
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        if(change.type === 'added'){
          if(workerDocs.has(change.doc.id)) return;
          createWorkerFromDoc(change.doc.id, data.homeId, data.type, data.expiresAt);
        }
        if(change.type === 'removed'){
          const info = workerDocs.get(change.doc.id);
          if(info){
            const setMap = info.type==='wood'?woodcuttersByHome:info.type==='miner'?minersByHome:farmersByHome;
            setMap.get(info.homeId)?.delete(info.marker);
            map.removeLayer(info.marker);
            workerDocs.delete(change.doc.id);
          }
        }
      });
    }, err => {
      console.warn('worker realtime error', err);
      localWorkerCache.forEach((d,id)=>createWorkerFromDoc(id,d.homeId,d.type,d.expiresAt,true));
    });
  } catch(e){
    console.warn('worker realtime init failed', e);
    localWorkerCache.forEach((d,id)=>createWorkerFromDoc(id,d.homeId,d.type,d.expiresAt,true));
  }
}

function startHarvest(workerMarker, targetMap){
  const w = workerMarker.worker;
  const tgt = targetMap.get(w.harvest.targetId);
  if(!tgt) return;
  w.harvest.startTs = performance.now();
  w.state='harvest';
}
function completeHarvest(workerMarker, targetMap, gainMin=2, gainMax=5){
  const w = workerMarker.worker;
  const tgt = targetMap.get(w.harvest.targetId);
  if(tgt){ map.removeLayer(tgt.marker); targetMap.delete(tgt.id); }
  w.cargo += Math.floor(randBetween(gainMin,gainMax));
  w.harvest.targetId=null; w.state='return';
}
async function deliverResources(workerMarker){
  const w = workerMarker.worker; if(w.cargo<=0) return;
  if(w.type==='wood'){ resources.wood += w.cargo; showToast(`🪵 +${w.cargo}`,[],900); }
  else if(w.type==='miner'){ resources.stone += w.cargo; showToast(`🪨 +${w.cargo}`,[],900); }
  else { resources.corn += w.cargo; showToast(`🌽 +${w.cargo}`,[],900); }
  addXP(w.cargo*2);
  w.cargo=0; updateResourcePanel(); schedulePlayerSave();
}

// ===== Движение и сбор =====
let __lastTs = performance.now();
export function moveWorkers(){
  const now = performance.now(); const dt = now - __lastTs; __lastTs = now;

  function updateSet(set, homeId, type){
    const homeMarker = markers.get(homeId); if(!homeMarker) return;
    const homePos = homeMarker.getLatLng();
      for(const marker of Array.from(set)){
        const w = marker.worker; const pos = marker.getLatLng();

        if(Date.now() >= w.expiresAt){
          set.delete(marker);
          map.removeLayer(marker);
          workerDocs.delete(w.id);
          if(w.local){
            localWorkerCache.delete(w.id);
          } else if(currentUid){
            try { deleteDoc(doc(db,'players',currentUid,'workers',w.id)); } catch(e){}
          }
          continue;
        }

      if(w.state==='wander'){
        const pool = type==='wood'?trees:type==='miner'?rocks:corn;
        if(pool.size>0){ const nt=nearestTarget(pos,pool); if(nt){ w.state='toTarget'; w.target={lat:nt.lat,lng:nt.lng}; w.harvest.targetId=nt.id; } }
      }
      if(w.state==='toTarget'){
        const pool = type==='wood'?trees:type==='miner'?rocks:corn;
        if(!pool.has(w.harvest.targetId)){ w.state='wander'; w.target=pickWanderPointAround(homePos); }
      }
      if(w.state==='harvest'){
        const elapsed = performance.now() - w.harvest.startTs;
        if(elapsed >= w.harvest.durationMs){
          const pool = type==='wood'?trees:type==='miner'?rocks:corn;
          completeHarvest(marker,pool);
        }
      }

      let target;
      if(w.state==='wander' || w.state==='toTarget') target = w.target;
      else if(w.state==='harvest') target = pos;
      else target = homePos;

      if(w.state!=='harvest'){
        const dLat = target.lat - pos.lat;
        const dLng = target.lng - pos.lng;
        if(Math.abs(dLat)+Math.abs(dLng) < ARRIVE_EPS){
          if(w.state==='wander'){
            const pool = type==='wood'?trees:type==='miner'?rocks:corn;
            const nt=nearestTarget(pos,pool);
            if(nt){ w.state='toTarget'; w.target={lat:nt.lat,lng:nt.lng}; w.harvest.targetId=nt.id; }
            else { w.state='return'; }
          } else if(w.state==='toTarget'){
            const pool = type==='wood'?trees:type==='miner'?rocks:corn;
            const tgt = pool.get(w.harvest.targetId);
            if(tgt){ marker.setLatLng([tgt.lat,tgt.lng]); startHarvest(marker,pool); }
            else { w.state='wander'; w.target=pickWanderPointAround(homePos); }
          } else if(w.state==='return'){
            deliverResources(marker); w.state='wander'; w.target=pickWanderPointAround(homePos);
          }
        } else {
          marker.setLatLng([pos.lat + dLat*w.speed, pos.lng + dLng*w.speed]);
        }
      }

      const isMoving=(w.state==='wander'||w.state==='toTarget'||w.state==='return');
      if(isMoving){
        w.anim.accMs+=dt; if(w.anim.accMs>=FRAME_INTERVAL_MS){
          w.anim.accMs=0; w.anim.frameIndex=(w.anim.frameIndex+1)%w.frames.length;
          marker.setIcon(makeWorkerDiv(w.frames[w.anim.frameIndex], !w.anim.facingRight));
        }
        if(Math.abs(target.lng-pos.lng)>1e-8){
          const goingRight=target.lng>pos.lng;
          if(goingRight!==w.anim.facingRight){
            w.anim.facingRight=goingRight;
            marker.setIcon(makeWorkerDiv(w.frames[w.anim.frameIndex], !w.anim.facingRight));
          }
        }
      } else if(w.anim.frameIndex!==1){
        w.anim.frameIndex=1; w.anim.accMs=0;
        marker.setIcon(makeWorkerDiv(w.frames[1], !w.anim.facingRight));
      }
    }
  }

  woodcuttersByHome.forEach((set,homeId)=>updateSet(set,homeId,'wood'));
  minersByHome.forEach((set,homeId)=>updateSet(set,homeId,'miner'));
  farmersByHome.forEach((set,homeId)=>updateSet(set,homeId,'fermer'));
  requestAnimationFrame(moveWorkers);
}

