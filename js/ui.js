// js/ui.js

// ================= Firebase (reuse existing app if main.js already init) =================
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// тот же конфиг, что и в main.js (не будет конфликтовать — см. getApps())
const firebaseConfig = {
  apiKey: "AIzaSyC-cKsUyDM2H1Hs3ouKjRjO2Vxg9QvC880",
  authDomain: "gamemap-84ae8.firebaseapp.com",
  projectId: "gamemap-84ae8",
  storageBucket: "gamemap-84ae8.firebasestorage.app",
  messagingSenderId: "198147414309",
  appId: "1:198147414309:web:33b340d6bf6dbd3d01a2cc",
  measurementId: "G-M2TKZCT4LT"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);

// ================= Импорты локальных модулей =================
import { map } from "./map.js";
import { resources, updateResourcePanel } from "./resources.js";
import { renderBuildingDoc } from "./buildings.js";

// ================= Тосты =================
const toasts = document.getElementById("toasts");
export function showToast(html, actions = [], timeoutMs = 2000) {
  const div = document.createElement("div");
  div.className = "toast pixel";
  div.innerHTML = html;

  if (actions && actions.length) {
    const bar = document.createElement("div");
    bar.className = "toast-actions";
    actions.forEach(a => {
      const btn = document.createElement("button");
      btn.textContent = a.text;
      btn.onclick = () => { try { a.onClick?.(); } finally { div.remove(); } };
      bar.appendChild(btn);
    });
    div.appendChild(bar);
  }

  toasts.appendChild(div);
  if (timeoutMs > 0) setTimeout(() => div.remove(), timeoutMs);
}

// ====================== Рынок ======================
const overlay = document.getElementById("overlay");
const marketMenu = document.getElementById("marketMenu");

const tabWood  = document.getElementById("tabWood");
const tabStone = document.getElementById("tabStone");
const tabCorn  = document.getElementById("tabCorn");

const mRate   = document.getElementById("m-rate");
const mHave   = document.getElementById("m-have");
const mPacks  = document.getElementById("m-packs");
const mGet    = document.getElementById("m-get");

const mDec  = document.getElementById("m-dec");
const mInc  = document.getElementById("m-inc");
const mMax  = document.getElementById("m-max");
const mSell = document.getElementById("m-sell");
const mSellAll = document.getElementById("m-sell-all");
const mCancel  = document.getElementById("m-cancel");

// курсы (набор = 10 ресурсов)
const MARKET = {
  wood:  { pack: 10, moneyPerPack: 50, icon: "🪵" },
  stone: { pack: 10, moneyPerPack: 70, icon: "🪨" },
  corn:  { pack: 10, moneyPerPack: 30, icon: "🌽" }
};

let marketRes = "wood";
let marketPacks = 0;

function setActiveTab(res) {
  marketRes = res;
  tabWood.classList.toggle("active", res === "wood");
  tabStone.classList.toggle("active",res === "stone");
  tabCorn.classList.toggle("active", res === "corn");
  updateMarketUI(true);
}

function maxPacks() {
  const have = (marketRes === "wood" ? resources.wood :
               marketRes === "stone" ? resources.stone : resources.corn) | 0;
  return Math.floor(have / MARKET[marketRes].pack);
}

function updateMarketUI(resetPacks = false) {
  const rate = MARKET[marketRes];
  const have = marketRes === "wood"  ? resources.wood
             : marketRes === "stone" ? resources.stone
             : resources.corn;

  if (resetPacks) marketPacks = Math.min(marketPacks, maxPacks());

  mRate.textContent = `${rate.pack} ${rate.icon} = ${rate.moneyPerPack} 💰`;
  mHave.textContent = have.toString();
  mPacks.textContent = marketPacks.toString();
  mGet.textContent = (marketPacks * rate.moneyPerPack).toString();
}

export function openMarket() {
  marketPacks = 0;
  updateMarketUI(true);
  overlay.style.display = "block";
  marketMenu.style.display = "block";
}
export function closeMarket() {
  overlay.style.display = "none";
  marketMenu.style.display = "none";
}

tabWood.onclick  = () => setActiveTab("wood");
tabStone.onclick = () => setActiveTab("stone");
tabCorn.onclick  = () => setActiveTab("corn");

mDec.onclick = () => { marketPacks = Math.max(0, marketPacks - 1); updateMarketUI(); };
mInc.onclick = () => { marketPacks = Math.min(maxPacks(), marketPacks + 1); updateMarketUI(); };
mMax.onclick = () => { marketPacks = maxPacks(); updateMarketUI(); };

mSell.onclick = () => {
  const rate = MARKET[marketRes];
  if (marketPacks <= 0) return;
  const amount = marketPacks * rate.pack;
  if (marketRes === "wood" && resources.wood < amount) return;
  if (marketRes === "stone" && resources.stone < amount) return;
  if (marketRes === "corn" && resources.corn < amount) return;

  if (marketRes === "wood")  resources.wood  -= amount;
  if (marketRes === "stone") resources.stone -= amount;
  if (marketRes === "corn")  resources.corn  -= amount;

  resources.money += marketPacks * rate.moneyPerPack;
  marketPacks = 0;
  updateResourcePanel();
  updateMarketUI(true);
  showToast("Сделка проведена ✅");
};

mSellAll.onclick = () => {
  const packs = maxPacks();
  if (packs <= 0) return;
  marketPacks = packs;
  mSell.onclick();
};

mCancel.onclick = closeMarket;
overlay.onclick = closeMarket;

// ====================== Магазин и постановка зданий ======================
const shopPanel  = document.getElementById("shopPanel");
const shopToggle = document.getElementById("shopToggle");
const shopClose  = document.getElementById("shopClose");

export function openShop()  { shopPanel.style.display = "block"; }
export function closeShop() { shopPanel.style.display = "none"; }

shopToggle.onclick = openShop;
shopClose.onclick  = closeShop;
document.getElementById("marketBtn").onclick = openMarket;

// режим постановки
let placementMode = null;   // { type, cost, name, iconUrl, ghost }
let mapClickHandler = null;

function cancelPlacement() {
  if (placementMode?.ghost) {
    placementMode.ghost.remove();
  }
  placementMode = null;
  if (mapClickHandler) {
    map.off("click", mapClickHandler);
    mapClickHandler = null;
  }
  showToast("Постановка отменена", [], 1200);
}

// вешаем обработчики на все карточки
document.querySelectorAll("#shopPanel .card").forEach(card => {
  const btn = card.querySelector(".buyBtn");
  btn.onclick = () => {
    const type = card.dataset.type;
    const cost = parseInt(card.dataset.cost || "0", 10);
    const name = card.dataset.name || type;
    const iconUrl = card.dataset.icon;

    if (resources.money < cost) {
      showToast("Недостаточно денег 💰");
      return;
    }

    // вход в режим постановки
    if (!map) {
      showToast("Карта не инициализирована");
      return;
    }

    if (placementMode?.ghost) placementMode.ghost.remove();

    const ghostIcon = L.icon({ iconUrl, iconSize: [48,48], className: "ghost" });
    const ghost = L.marker(map.getCenter(), { icon: ghostIcon, interactive: false }).addTo(map);

    placementMode = { type, cost, name, iconUrl, ghost };
    showToast(`Режим постановки: ${name}. Кликни по карте для размещения. Нажми Esc для отмены.`, [], 3000);

    if (mapClickHandler) map.off("click", mapClickHandler);
    mapClickHandler = (e) => {
      const { lat, lng } = e.latlng;

      // списываем деньги только при фактической установке
      resources.money -= cost;
      updateResourcePanel();

      // рисуем локально (рендер) — id генерируем простым способом
      const id = `local_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
      renderBuildingDoc(id, {
        id,
        type,
        lat,
        lng,
        level: 1
      });

      cancelPlacement();
      showToast(`Поставлено: ${name} ✅`, [], 1600);
    };
    map.on("click", mapClickHandler);
  };
});

// отмена постановки по Esc
window.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && placementMode) {
    ev.preventDefault();
    cancelPlacement();
  }
});

// ====================== Редактор спрайтов ======================
const editMenu = document.getElementById("editMenu");
const canvas = document.getElementById("paintCanvas");
const ctx = canvas.getContext("2d");
const palette = document.getElementById("palette");
const saveSpriteBtn = document.getElementById("saveSprite");
const closeEditorBtn = document.getElementById("closeEditor");

// простая палитра
const COLORS = ["#000000","#ffffff","#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff","#8B5A2B","#FFA500","#808080"];
let currentColor = COLORS[0];

// отрисовка палитры
(function buildPalette(){
  palette.innerHTML = "";
  COLORS.forEach(c => {
    const sw = document.createElement("button");
    sw.className = "swatch";
    sw.style.background = c;
    sw.title = c;
    sw.onclick = () => { currentColor = c; };
    palette.appendChild(sw);
  });
})();

// рисование по клику/перетаскиванию
let drawing = false;
canvas.addEventListener("mousedown", (e) => { drawing = true; drawAt(e); });
canvas.addEventListener("mousemove", (e) => { if (drawing) drawAt(e); });
window.addEventListener("mouseup", () => { drawing = false; });

function drawAt(e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left));
  const y = Math.floor((e.clientY - rect.top));
  ctx.fillStyle = currentColor;
  ctx.fillRect(x, y, 1, 1);
}

// открытие редактора из попапа здания
export function editBuilding(id) {
  editMenu.style.display = "block";
  editMenu.dataset.buildingId = id;
}

// закрытие редактора
closeEditorBtn.onclick = () => {
  editMenu.style.display = "none";
};

// сохранение спрайта в Storage + запись URL в документ здания
saveSpriteBtn.onclick = async () => {
  const id = editMenu.dataset.buildingId;
  if (!id) return;

  try {
    const dataUrl = canvas.toDataURL("image/png");
    const spriteRef = ref(storage, `sprites/${id}.png`);
    await uploadString(spriteRef, dataUrl, "data_url");
    const url = await getDownloadURL(spriteRef);

    await updateDoc(doc(db, "buildings", id), { spriteUrl: url });

    showToast("Спрайт сохранён ✅", [], 2000);
    editMenu.style.display = "none";
  } catch (err) {
    showToast("Ошибка сохранения: " + (err?.message || err), [], 3000);
  }
};
