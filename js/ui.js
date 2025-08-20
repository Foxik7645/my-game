// ===== Импорты Firebase =====
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { app } from "./main.js";   
import { buildingData } from "./buildings.js";

const storage = getStorage(app);
const db = getFirestore(app);

// ===== Тосты =====
const toasts = document.getElementById('toasts');
export function showToast(html, actions = [], timeoutMs = 2000) {
  const div = document.createElement('div');
  div.className = 'toast pixel';
  div.innerHTML = html;

  if (actions.length > 0) {
    const btns = document.createElement('div');
    btns.className = 'actions';
    actions.forEach(([label, fn]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = () => { fn(); div.remove(); };
      btns.appendChild(b);
    });
    div.appendChild(btns);
  }

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
const paletteDiv = document.getElementById('palette');
const saveSpriteBtn = document.getElementById('saveSprite');
const closeEditorBtn = document.getElementById('closeEditor');
let currentBuildingId = null;

const ctx = paintCanvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// палитра цветов
const COLORS = ["#000000","#ffffff","#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff"];
let currentColor = COLORS[0];

// создаём палитру
paletteDiv.innerHTML = "";
COLORS.forEach(c => {
  const swatch = document.createElement("div");
  swatch.style.width = "20px";
  swatch.style.height = "20px";
  swatch.style.background = c;
  swatch.style.border = "1px solid #555";
  swatch.style.cursor = "pointer";
  swatch.onclick = () => currentColor = c;
  paletteDiv.appendChild(swatch);
});

// рисование
let drawing = false;
paintCanvas.addEventListener("mousedown", e => {
  drawing = true;
  drawPixel(e);
});
paintCanvas.addEventListener("mousemove", e => {
  if (drawing) drawPixel(e);
});
paintCanvas.addEventListener("mouseup", () => drawing = false);
paintCanvas.addEventListener("mouseleave", () => drawing = false);

function drawPixel(e) {
  const rect = paintCanvas.getBoundingClientRect();
  const scaleX = paintCanvas.width / rect.width;
  const scaleY = paintCanvas.height / rect.height;
  const x = Math.floor((e.clientX - rect.left) * scaleX);
  const y = Math.floor((e.clientY - rect.top) * scaleY);
  ctx.fillStyle = currentColor;
  ctx.fillRect(x, y, 1, 1);
}

// Открыть редактор
export function editBuilding(id) {
  currentBuildingId = id;
  editMenu.style.display = "block";

  ctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);

  const b = buildingData.get(id);
  if (!b) return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    ctx.drawImage(img, 0, 0, paintCanvas.width, paintCanvas.height);
  };

  img.src = b.iconUrl || getDefaultIcon(b.type);
}

// вернуть дефолтный путь
function getDefaultIcon(type) {
  switch (type) {
    case "drovosekdom": return "./images/DrovosekDom.png";
    case "minehouse":   return "./images/Minehouse.png";
    case "base":        return "./images/Base.png";
    case "fermerdom":   return "./images/FermerDom.png";
    case "houseeat":    return "./images/HouseEat.png";
    default:            return "./images/Base.png";
  }
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
    const dataUrl = paintCanvas.toDataURL("image/png");
    const storageRef = ref(storage, `sprites/${currentBuildingId}.png`);
    await uploadString(storageRef, dataUrl, 'data_url');
    const url = await getDownloadURL(storageRef);

    await updateDoc(doc(db, "buildings", currentBuildingId), { iconUrl: url });

    showToast("✅ Спрайт сохранён!");
    editMenu.style.display = "none";
    currentBuildingId = null;

  } catch (e) {
    console.error("Ошибка сохранения:", e);
    showToast("Ошибка сохранения: " + e.message);
  }
};
