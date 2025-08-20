import { resources, schedulePlayerSave, addXP } from './resources.js';
import { showToast } from './ui.js';
import { WORKER_COST_FOOD, WORKER_DURATION_MS, WC_FRAMES, MINER_FRAMES, FERM_FRAMES } from './constants.js';  // Если добавишь constants.js, иначе hardcode

// ===== Константы рабочих =====
const IDLE_INDEX = 1, FRAME_INTERVAL_MS = 160;
const STEP_SPEED = 0.0009, ARRIVE_EPS = 0.00008;
export const FRAME_SETS = { woodcutter: WC_FRAMES, miner: MINER_FRAMES, farmer: FERM_FRAMES };

// ===== Сеты рабочих =====
export const woodcuttersByHome = new Map();
export const minersByHome = new Map();
export const farmersByHome = new Map();

// ===== Функции рабочих =====
export function getTotalWorkers(type) {
  // ... (логика из оригинала)
}

export function createWorkerFromDoc(workerId, homeId, type, expiresAtMs, localOnly=false){
  // ... (логика создания маркера рабочего)
}

export function hireWoodcutter(homeId){
  // ... (найм, с использованием hireWorkerGeneric)
}

export function hireMiner(homeId){
  // ... 
}

export function hireFermer(homeId){
  // ...
}

// Общая функция найма
async function hireWorkerGeneric(homeId, buildingType, type){
  // ... (логика из оригинала)
}

// ===== Realtime для рабочих =====
export function startWorkersRealtime(){
  // ... (onSnapshot для workers, loadLocalWorkers и т.д.)
}

// ===== Движение и harvest =====
let __lastTs = performance.now();
export function moveWorkers(){
  // ... (логика animation frame, updateSet, истечение, wander, toTarget, harvest)
  requestAnimationFrame(moveWorkers);
}
