// ===== Тосты =====
const toasts = document.getElementById('toasts');
export function showToast(html, actions=[] , timeoutMs=0){
  // простая версия для отладки
  const div = document.createElement('div');
  div.className = 'toast';
  div.innerHTML = html;
  toasts.appendChild(div);
  if (timeoutMs > 0) setTimeout(() => div.remove(), timeoutMs);
}

// ===== Market UI =====
const overlay = document.getElementById('overlay');
const marketMenu = document.getElementById('marketMenu');
const marketBtn = document.getElementById('marketBtn');
const marketCancel = document.getElementById('m-cancel');

export function openMarket(){ 
  overlay.style.display = 'block';
  marketMenu.style.display = 'block';
}
export function closeMarket(){ 
  overlay.style.display = 'none';
  marketMenu.style.display = 'none';
}

if (marketBtn) marketBtn.addEventListener('click', openMarket);
if (marketCancel) marketCancel.addEventListener('click', closeMarket);
if (overlay) overlay.addEventListener('click', closeMarket);

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

// ===== Editor спрайта =====
const editMenu = document.getElementById('editMenu');
window.editBuilding = function(id){ 
  editMenu.style.display = 'block';
};
