// ===== Импорты Firebase =====
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { app } from "./main.js";   // экспортируй app в main.js -> export { app };

const storage = getStorage(app);
const db = getFirestore(app);

// ===== Тосты =====
const toasts = document.getElementById('toasts');
export function showToast(html, actions = [], timeoutMs = 2000) {
  const div = document.createElement('div');
  div.className = 'toast pixel';
  div.innerHTML = html;

  const btns = document.createElement('div');
  btns.className = 'actions';
  actions.forEach(([label, fn]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => { fn(); div.remove(); };
    btns.appendChild(b);
  });
  div.appendChild(btns);
  toasts.appendChild(div);

  setTimeout(() => div.remove(), timeoutMs);
}

// ===== Market UI =====
const overlay = document.getElementById('overlay');
const marketMenu = document.getElementById('marketMenu');
const marketBtn = document.getElementById('marketBtn');
const mCancel = document.getElementById('m-cancel');

export function openMarket() {
  overlay.style.display = 'block';
  marketMenu.style.display = 'block';
}
export function closeMarket() {
  overlay.style.display = 'none';
  marketMenu.style.display = 'none';
}

marketBtn.onclick = openMarket;
mCancel.onclick = closeMarket;

// ===== Shop UI =====
const shopPanel = document.getElementById('shopPanel');
const shopToggle = document.getElementById('shopToggle');
const shopClose = document.getElementById('shopClose');

export function openShop() {
  shopPanel.style.display = 'block';
}
export function closeShop() {
  shopPanel.style.display = 'none';
}

shopToggle.onclick = openShop;
shopClose.onclick = closeShop;

// ===== Editor спрайта =====
const editMenu = document.getElementById('editMenu');
const paintCanvas = document.getElementById('paintCanvas');
const saveSpriteBtn = document.getElementById('saveSprite');
const closeEditorBtn = document.getElementById('closeEditor');
let currentBuildingId = null;

const ctx = paintCanvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// Открыть редактор
export function editBuilding(id) {
  currentBuildingId = id;
  editMenu.style.display = "block";
}

// Закрыть редактор
closeEditorBtn.onclick = () => {
  editMenu.style.display = "none";
  currentBuildingId = null;
};

// Сохранить спрайт
saveSpriteBtn.onclick = async () => {
  if (!currentBuildingId) return;

  try {
    // base64 PNG
    const dataUrl = paintCanvas.toDataURL("image/png");

    // Firebase Storage path
    const storageRef = ref(storage, `sprites/${currentBuildingId}.png`);

    // upload
    await uploadString(storageRef, dataUrl, 'data_url');

    // get download url
    const url = await getDownloadURL(storageRef);

    // обновить Firestore
    await updateDoc(doc(db, "buildings", currentBuildingId), {
      iconUrl: url
    });

    showToast("✅ Спрайт сохранён!");
    editMenu.style.display = "none";
    currentBuildingId = null;

  } catch (e) {
    console.error("Ошибка сохранения:", e);
    showToast("Ошибка сохранения: " + e.message);
  }
};
