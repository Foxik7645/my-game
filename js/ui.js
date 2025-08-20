// ===== Тосты =====
const toasts = document.getElementById('toasts');
export function showToast(html, actions=[] , timeoutMs=0){
  // ... (логика из оригинала)
}

// ===== Market UI =====
const overlay = document.getElementById('overlay');
const marketMenu = document.getElementById('marketMenu');
// ... (все элементы tabWood, mRate и т.д.)
export function openMarket(){ /* ... */ }
export function closeMarket(){ /* ... */ }
// ... (setMarketResource, updateMarketUI, mSell.onclick и т.д.)

// ===== Shop и placement =====
// ... (shopPanel, buyBtn listeners, placementMode, ghostMarker)

// ===== Editor спрайта =====
const editMenu = document.getElementById('editMenu');
// ... (canvas, palette, drawPixel, saveSprite.onclick)
window.editBuilding = function(id){ /* ... */ };
