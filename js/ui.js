// ===== Импорты ресурсов =====
import { resources, updateResourcePanel } from './resources.js';

// ===== Тосты =====
const toasts = document.getElementById('toasts');
export function showToast(html, actions=[] , timeoutMs=2000){
  const div = document.createElement('div');
  div.className = 'toast';
  div.innerHTML = html;

  if (actions.length > 0) {
    const bar = document.createElement('div');
    bar.className = 'actions';
    actions.forEach(act => {
      const btn = document.createElement('button');
      btn.textContent = act.label;
      btn.onclick = act.onClick;
      bar.appendChild(btn);
    });
    div.appendChild(bar);
  }

  toasts.appendChild(div);
  if (timeoutMs > 0) setTimeout(() => div.remove(), timeoutMs);
}

// ===== Market UI =====
const overlay = document.getElementById('overlay');
const marketMenu = document.getElementById('marketMenu');
const marketBtn = document.getElementById('marketBtn');
const marketCancel = document.getElementById('m-cancel');

let selectedResource = "wood";
let sellPacks = 0;

// курсы обмена
const marketRates = {
  wood: 50,   // 10 дерева = 50 монет
  stone: 70,  // 10 камня = 70 монет
  corn: 40    // 10 кукурузы = 40 монет
};

export function openMarket(){ 
  overlay.style.display = 'block';
  marketMenu.style.display = 'block';
  updateMarketUI();
}
export function closeMarket(){ 
  overlay.style.display = 'none';
  marketMenu.style.display = 'none';
}

if (marketBtn) marketBtn.addEventListener('click', openMarket);
if (marketCancel) marketCancel.addEventListener('click', closeMarket);
if (overlay) overlay.addEventListener('click', closeMarket);

function updateMarketUI() {
  document.getElementById('m-packs').textContent = sellPacks;
  const have = resources[selectedResource] || 0;
  const rate = marketRates[selectedResource] || 0;
  document.getElementById('m-rate').textContent = `10 ${emoji(selectedResource)} = ${rate} 💰`;
  document.getElementById('m-have').textContent = have;
  document.getElementById('m-get').textContent = sellPacks * rate;
}

function emoji(res) {
  if (res === "wood") return "🪵";
  if (res === "stone") return "🪨";
  if (res === "corn") return "🌽";
  return res;
}

// вкладки ресурсов
document.getElementById('tabWood').onclick = () => { selectedResource = "wood"; sellPacks = 0; updateMarketUI(); };
document.getElementById('tabStone').onclick = () => { selectedResource = "stone"; sellPacks = 0; updateMarketUI(); };
document.getElementById('tabCorn').onclick = () => { selectedResource = "corn"; sellPacks = 0; updateMarketUI(); };

// кнопки изменения количества
document.getElementById('m-dec').onclick = () => { if (sellPacks > 0) sellPacks--; updateMarketUI(); };
document.getElementById('m-inc').onclick = () => { 
  const have = Math.floor((resources[selectedResource] || 0) / 10);
  if (sellPacks < have) sellPacks++;
  updateMarketUI();
};
document.getElementById('m-max').onclick = () => { 
  sellPacks = Math.floor((resources[selectedResource] || 0) / 10);
  updateMarketUI();
};

// кнопки продажи
document.getElementById('m-sell').onclick = () => { 
  if (sellPacks <= 0) return;
  const need = sellPacks * 10;
  if (resources[selectedResource] >= need) {
    resources[selectedResource] -= need;
    resources.money += sellPacks * marketRates[selectedResource];
    showToast(`Продано ${need} ${emoji(selectedResource)} за ${sellPacks * marketRates[selectedResource]} 💰`);
    sellPacks = 0;
    updateResourcePanel();
    updateMarketUI();
  }
};
document.getElementById('m-sell-all').onclick = () => { 
  const have = Math.floor((resources[selectedResource] || 0) / 10);
  if (have > 0) {
    const need = have * 10;
    resources[selectedResource] -= need;
    resources.money += have * marketRates[selectedResource];
    showToast(`Продано ${need} ${emoji(selectedResource)} за ${have * marketRates[selectedResource]} 💰`);
    sellPacks = 0;
    updateResourcePanel();
    updateMarketUI();
  }
};

// ===== Shop UI =====
const shopPanel = document.getElementById('shopPanel');
const shopToggle = document.getElementById('shopToggle');
const shopClose = document.getElementById('shopClose');

export function openShop(){
  shopPanel.style.display = 'block';
}
export function closeShop(){
  shopPanel.style.display = 'none';
}

if (shopToggle) shopToggle.addEventListener('click', openShop);
if (shopClose) shopClose.addEventListener('click', closeShop);

// кнопки "Купить" в магазине
const buyButtons = document.querySelectorAll('.buyBtn');
buyButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    const type = card.dataset.type;
    const cost = parseInt(card.dataset.cost) || 0;

    if (resources.money >= cost) {
      resources.money -= cost;
      updateResourcePanel();
      showToast(`Куплено здание: ${type} за ${cost} 💰`);
      closeShop();
      // тут можно вызвать функцию, которая реально строит здание
    } else {
      showToast(`Недостаточно 💰 для покупки ${type}`);
    }
  });
});

// ===== Editor спрайта =====
const editMenu = document.getElementById('editMenu');
window.editBuilding = function(id){ 
  editMenu.style.display = 'block';
};
