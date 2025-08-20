// ===== Тосты =====
const toasts = document.getElementById('toasts');
export function showToast(html, actions=[] , timeoutMs=0){
  // ... (твоя логика)
}

// ===== Market UI =====
const overlay = document.getElementById('overlay');
const marketMenu = document.getElementById('marketMenu');

export function openMarket() {
  if (overlay) overlay.style.display = 'block';
  if (marketMenu) marketMenu.style.display = 'block';
}

export function closeMarket() {
  if (overlay) overlay.style.display = 'none';
  if (marketMenu) marketMenu.style.display = 'none';
}

// ===== Shop UI =====
const shopPanel = document.getElementById('shopPanel');

export function openShop() {
  if (overlay) overlay.style.display = 'block';
  if (shopPanel) shopPanel.style.display = 'block';
}

export function closeShop() {
  if (overlay) overlay.style.display = 'none';
  if (shopPanel) shopPanel.style.display = 'none';
}

// ===== Editor спрайта =====
const editMenu = document.getElementById('editMenu');
window.editBuilding = function(id){ /* ... */ };
