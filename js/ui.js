// ===== Тосты =====
const toasts = document.getElementById('toasts');
export function showToast(html, actions=[] , timeoutMs=2000){
  const div = document.createElement('div');
  div.className = 'toast';
  div.innerHTML = html;

  // кнопки-действия
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
  let rate = 50; // пример: каждые 10 ресурсов = 50 монет
  document.getElementById('m-get').textContent = sellPacks * rate;
  document.getElementById('m-have').textContent = 999; // пока фиктивное значение
}

// вкладки ресурсов
document.getElementById('tabWood').onclick = () => { selectedResource = "wood"; updateMarketUI(); };
document.getElementById('tabStone').onclick = () => { selectedResource = "stone"; updateMarketUI(); };
document.getElementById('tabCorn').onclick = () => { selectedResource = "corn"; updateMarketUI(); };

// кнопки изменения количества
document.getElementById('m-dec').onclick = () => { if (sellPacks > 0) sellPacks--; updateMarketUI(); };
document.getElementById('m-inc').onclick = () => { sellPacks++; updateMarketUI(); };
document.getElementById('m-max').onclick = () => { sellPacks = 99; updateMarketUI(); };

// кнопки продажи
document.getElementById('m-sell').onclick = () => { 
  showToast(`Продано ${sellPacks*10} ${selectedResource}`); 
  sellPacks = 0; updateMarketUI(); 
};
document.getElementById('m-sell-all').onclick = () => { 
  showToast(`Проданы все ${selectedResource}`); 
  sellPacks = 0; updateMarketUI(); 
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
    const cost = card.dataset.cost;
    showToast(`Построено здание: ${type} за ${cost} 💰`);
    closeShop();
  });
});

// ===== Editor спрайта =====
const editMenu = document.getElementById('editMenu');
window.editBuilding = function(id){ 
  editMenu.style.display = 'block';
};
