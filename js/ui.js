// ===== Импорты =====
import { db } from './main.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { resources, updateResourcePanel } from './resources.js';
import { map } from './map.js';

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

const marketRates = { wood: 50, stone: 70, corn: 40 };

export function openMarket(){ overlay.style.display = 'block'; marketMenu.style.display = 'block'; updateMarketUI(); }
export function closeMarket(){ overlay.style.display = 'none'; marketMenu.style.display = 'none'; }

if (marketBtn) marketBtn.addEventListener('click', openMarket);
if (marketCancel) marketCancel.addEventListener('click', closeMarket);
if (overlay) overlay.addEventListener('click', closeMarket);

function emoji(res){ if(res==="wood") return "🪵"; if(res==="stone") return "🪨"; if(res==="corn") return "🌽"; return res; }

function updateMarketUI(){
  const have = resources[selectedResource] || 0;
  const rate = marketRates[selectedResource] || 0;
  document.getElementById('m-packs').textContent = `${sellPacks} (${sellPacks*10} ${emoji(selectedResource)})`;
  document.getElementById('m-rate').textContent = `10 ${emoji(selectedResource)} = ${rate} 💰`;
  document.getElementById('m-have').textContent = have;
  document.getElementById('m-get').textContent = sellPacks * rate;
}

document.getElementById('tabWood').onclick = () => { selectedResource="wood"; sellPacks=0; updateMarketUI(); };
document.getElementById('tabStone').onclick = () => { selectedResource="stone"; sellPacks=0; updateMarketUI(); };
document.getElementById('tabCorn').onclick = () => { selectedResource="corn"; sellPacks=0; updateMarketUI(); };

document.getElementById('m-dec').onclick = () => { if(sellPacks>0) sellPacks--; updateMarketUI(); };
document.getElementById('m-inc').onclick = () => { const max=Math.floor((resources[selectedResource]||0)/10); if(sellPacks<max) sellPacks++; updateMarketUI(); };
document.getElementById('m-max').onclick = () => { sellPacks=Math.floor((resources[selectedResource]||0)/10); updateMarketUI(); };

document.getElementById('m-sell').onclick = () => {
  if(sellPacks<=0) return;
  const need=sellPacks*10;
  if(resources[selectedResource]>=need){
    resources[selectedResource]-=need;
    resources.money+=sellPacks*marketRates[selectedResource];
    showToast(`Продано ${need} ${emoji(selectedResource)} за ${sellPacks*marketRates[selectedResource]} 💰`);
    sellPacks=0; updateResourcePanel(); updateMarketUI();
  }
};
document.getElementById('m-sell-all').onclick = () => {
  const max=Math.floor((resources[selectedResource]||0)/10);
  if(max>0){
    const need=max*10;
    resources[selectedResource]-=need;
    resources.money+=max*marketRates[selectedResource];
    showToast(`Продано ${need} ${emoji(selectedResource)} за ${max*marketRates[selectedResource]} 💰`);
    sellPacks=0; updateResourcePanel(); updateMarketUI();
  }
};

// ===== Shop UI =====
const shopPanel=document.getElementById('shopPanel');
const shopToggle=document.getElementById('shopToggle');
const shopClose=document.getElementById('shopClose');

export function openShop(){ shopPanel.style.display='block'; shopPanel.style.zIndex=1000; }
export function closeShop(){ shopPanel.style.display='none'; }

if(shopToggle) shopToggle.addEventListener('click',openShop);
if(shopClose) shopClose.addEventListener('click',closeShop);

// ===== Placement =====
let placementMode=null;
let ghostMarker=null;

function startPlacement(type,cost,name,iconUrl){
  if(resources.money<cost){ showToast("Недостаточно 💰"); return; }
  closeShop();
  placementMode={type,cost,name,iconUrl};
  const icon=L.icon({iconUrl,iconSize:[32,32]});
  ghostMarker=L.marker(map.getCenter(),{icon,opacity:0.6}).addTo(map);
  map.on('mousemove',moveGhost); map.on('click',placeBuilding);
}

function moveGhost(e){ if(ghostMarker) ghostMarker.setLatLng(e.latlng); }

async function placeBuilding(e){
  if(!placementMode) return;
  const {type,cost,name,iconUrl}=placementMode;
  resources.money-=cost; updateResourcePanel();
  await addDoc(collection(db,"buildings"),{
    type,name,iconUrl,lat:e.latlng.lat,lng:e.latlng.lng,createdAt:serverTimestamp()
  });
  showToast(`Поставлено здание: ${name}`);
  map.off('mousemove',moveGhost); map.off('click',placeBuilding);
  if(ghostMarker) map.removeLayer(ghostMarker);
  placementMode=null; ghostMarker=null;
}

// ===== Делегирование на кнопки "Купить" =====
document.addEventListener('click',(e)=>{
  if(e.target.classList.contains('buyBtn')){
    const card=e.target.closest('.card');
    const type=card.dataset.type;
    const cost=parseInt(card.dataset.cost)||0;
    const name=card.dataset.name;
    const iconUrl=card.dataset.icon;
    startPlacement(type,cost,name,iconUrl);
  }
});

// ===== Editor =====
const editMenu=document.getElementById('editMenu');
window.editBuilding=function(id){ editMenu.style.display='block'; };
