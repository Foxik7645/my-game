import { resources, schedulePlayerSave, addXP } from './resources.js';
import { showToast } from './ui.js';
import { WORKER_COST_FOOD, WORKER_DURATION_MS } from './constants.js';  // Если добавишь constants.js, иначе hardcode

// ===== Константы рабочих =====
const WC_FRAMES = ['./images/Drovosek1.png','./images/Drovosek2.png','./images/Drovosek3.png','./images/Drovosek4.png'];
const MINER_FRAMES= ['./images/Miner1.png','./images/Miner2.png','./images/Miner3.png','./images/Miner4.png'];
const FERM_FRAMES = ['./images/ferma1.png','./images/ferma2.png','./images/ferma3.png','./images/ferma4.png'];
const IDLE_INDEX = 1, FRAME_INTERVAL_MS = 160;
const STEP_SPEED = 0.0009, ARRIVE_EPS = 0.00008;

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
