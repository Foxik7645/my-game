// ===== Ресурсы и XP =====
export const BASE_XP = 500;
export let level = 1, xp = 0;
export const resources = { money: 100, wood: 10, stone: 0, corn: 0, food: 30 };

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
  // ... (логика из оригинала)
}

// ===== Сохранение профиля (дебаунс) =====
let dirtyPlayer = true;
let saveTimer = null;
export function schedulePlayerSave(immediate=false){
  // ... (логика из оригинала)
}
window.addEventListener('beforeunload', ()=>schedulePlayerSave(true));
