// ===== Ресурсы и XP =====
import { updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { showToast } from './ui.js';

export const BASE_XP = 500;
export let level = 1, xp = 0;
export const resources = { money: 100, wood: 10, stone: 0, corn: 0, food: 30 };

// ссылки на документ игрока в Firestore, которые выставляет main.js
let currentUid = null;
let playerDocRef = null;
export function setPlayerRef(uid, docRef){ currentUid = uid; playerDocRef = docRef; }

// ===== Обновление панели ресурсов =====
export function updateResourcePanel(){
  document.getElementById('resources').innerHTML = `
    <div class="res">💰 <b id="r-money">${resources.money}</b></div>
    <div class="res">🪵 <b id="r-wood">${resources.wood}</b></div>
    <div class="res">🪨 <b id="r-stone">${resources.stone}</b></div>
    <div class="res">🌽 <b id="r-corn">${resources.corn}</b></div>
    <div class="res">🍔 <b id="r-food">${resources.food}</b></div>`;
}

// ===== Добавление XP =====
export function getRequiredXp(lvl) { return BASE_XP * lvl; }
export function addXP(amount){
  xp += amount;
  let required = getRequiredXp(level);
  while (xp >= required) {
    xp -= required;
    level++;
    required = getRequiredXp(level);
    showToast(`📈 Уровень ${level}!`, [], 1500);
  }
  document.querySelector('#xpText').textContent = `Lv ${level} • ${xp}/${required}`;
  const p = Math.max(0, Math.min(1, xp / required)) * 100;
  document.querySelector('#xpBar .fill').style.width = p + '%';
  schedulePlayerSave();
}

// ===== Сохранение профиля (дебаунс) =====
let dirtyPlayer = true;
let saveTimer = null;
export function schedulePlayerSave(immediate=false){
  if(!currentUid || !playerDocRef) return;
  dirtyPlayer = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    if(!dirtyPlayer) return;
    dirtyPlayer = false;
    try{
      await updateDoc(playerDocRef, {
        money: resources.money,
        wood: resources.wood,
        stone: resources.stone,
        corn: resources.corn,
        food: resources.food,
        level,
        xp
      });
    }catch(e){
      console.warn('Save skipped:', e?.code, e?.message);
    }
  }, immediate ? 0 : 10_000);
}
window.addEventListener('beforeunload', ()=>schedulePlayerSave(true));
