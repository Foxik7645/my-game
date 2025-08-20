// ===== Импорты Firebase =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, collection, doc, serverTimestamp, onSnapshot, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ===== Импорты из модулей =====
import { resources, updateResourcePanel, addXP, schedulePlayerSave, setPlayerRef } from './resources.js';
import { startWorkersRealtime, hireWoodcutter, hireMiner, hireFermer, moveWorkers } from './worker.js';
import { showToast, openMarket, closeMarket, openShop, closeShop, editBuilding } from './ui.js';
import { renderBuildingDoc, unrenderBuildingDoc, upgradeBuilding, deleteBuilding, upgradeBase, cookFood } from './buildings.js';
import { map, initMap } from './map.js';

// ===== Конфиг Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyC-cKsUyDM2H1Hs3ouKjRjO2Vxg9QvC880",
  authDomain: "gamemap-84ae8.firebaseapp.com",
  projectId: "gamemap-84ae8",
  storageBucket: "gamemap-84ae8.firebasestorage.app",
  messagingSenderId: "198147414309",
  appId: "1:198147414309:web:33b340d6bf6dbd3d01a2cc",
  measurementId: "G-M2TKZCT4LT"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const db = getFirestore(app);   // 👈 экспорт для ui.js

// ===== Глобальные переменные =====
let uid = null;
let playerDocRef = null;

// ===== Auth UI =====
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');
loginBtn.onclick = async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { showToast('Ошибка входа: ' + (e?.message||e), [], 2500); }
};
logoutBtn.onclick = async () => { try{ await signOut(auth); }catch(e){} };

// ===== Auth слушатель =====
onAuthStateChanged(auth, async user => {
  if(user){
    uid = user.uid;
    userName.textContent = user.displayName || user.email || 'Player';
    loginBtn.textContent = 'Сменить аккаунт';
    logoutBtn.style.display = 'inline-block';
    playerDocRef = doc(db, 'players', uid);
    await ensurePlayerDoc();
    setPlayerRef(uid, playerDocRef);
    startRealtime();   // 👈 запуск подписок
  } else {
    uid = null;
    userName.textContent = '';
    loginBtn.textContent = 'Войти с Google';
    logoutBtn.style.display = 'none';
  }
}, error => {
  showToast('Ошибка аутентификации: ' + error.message, [], 2500);
});

// ===== Обеспечение профиля игрока =====
async function ensurePlayerDoc(){
  if (!uid) return;
  try {
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

// ===== Realtime слушатели =====
function startRealtime(){
  // Подписка на здания
  const buildingsRef = collection(db, "buildings");
  onSnapshot(buildingsRef, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        renderBuildingDoc(change.doc.id, change.doc.data());
      }
      if (change.type === "removed") {
        unrenderBuildingDoc(change.doc.id);
      }
    });
  });

  // Подписка на рабочих (если реализовано в worker.js)
  startWorkersRealtime(db, uid);
}

// ===== Инит игры =====
initMap();  
updateResourcePanel(); 
addXP(0);
requestAnimationFrame(moveWorkers);

// ===== Экспорт глобальных функций =====
window.hireWoodcutter = hireWoodcutter;
window.hireMiner = hireMiner;
window.hireFermer = hireFermer;

window.upgradeBuilding = upgradeBuilding;
window.deleteBuilding = deleteBuilding;
window.upgradeBase = upgradeBase;
window.cookFood = cookFood;
window.editBuilding = editBuilding;   // 👈 теперь тоже глобально

// ===== UI =====
window.openMarket = openMarket;
window.closeMarket = closeMarket;
window.openShop = openShop;   
window.closeShop = closeShop; 
