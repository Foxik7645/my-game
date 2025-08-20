import { updateDoc } from './firebase.js';
import { showToast, updateXPUI } from './ui.js';

export const BASE_XP = 500;
export let level = 1, xp = 0;
export const resources = { money: 100, wood: 10, stone: 0, corn: 0, food: 30 };

export const WORKER_COST_FOOD = 2;
export const WORKER_DURATION_MS = 5 * 60 * 1000;

export let uid = null;
export let playerDocRef = null;
let dirtyPlayer = true;
let saveTimer = null;


export function setPlayerContext(newUid, docRef){
  uid = newUid;
  playerDocRef = docRef;
}

export function schedulePlayerSave(immediate=false){
  if(!uid || !playerDocRef) return;
  dirtyPlayer = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    if(!dirtyPlayer) return;
    dirtyPlayer = false;
    try{
      await updateDoc(playerDocRef, { money:resources.money, wood:resources.wood, stone:resources.stone, corn:resources.corn, food:resources.food, level, xp });
    }catch(e){
      console.warn('Save skipped:', e?.code, e?.message);
    }
  }, immediate ? 0 : 10000);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', ()=>schedulePlayerSave(true));
}

export function getRequiredXp(lvl){ return BASE_XP * lvl; }

export function addXP(amount){
  xp += amount;
  let required = getRequiredXp(level);
  while (xp >= required) {
    xp -= required; level++; required = getRequiredXp(level);
    showToast(`📈 Уровень ${level}!`,[],1500);
  }
  updateXPUI(level, xp, required);
  schedulePlayerSave();
}

export async function ensurePlayerDoc(){
  if (!uid) return;
  try {
    const { getDoc, setDoc, serverTimestamp } = await import('./firebase.js').then(m=>m);
    const snap = await getDoc(playerDocRef);
    if(!snap.exists()){
      await setDoc(playerDocRef, {
        money: 100, wood: 10, stone: 0, corn: 0, food: 30,
        level: 1, xp: 0, createdAt: serverTimestamp()
      });
    }
  } catch (e) {
    showToast('Ошибка создания профиля: ' + e.message, [], 2500);
  }
}
