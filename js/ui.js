diff --git a//dev/null b/js/ui.js
index 0000000000000000000000000000000000000000..66fa6078543fe060a1702c2737a2e4a25ffad3c1 100644
--- a//dev/null
+++ b/js/ui.js
@@ -0,0 +1,103 @@
+import { resources, schedulePlayerSave } from './state.js';
+
+export function updateResourcePanel(){
+  document.getElementById('resources').innerHTML = `
+    <div class="res">💰 <b id="r-money">${resources.money}</b></div>
+    <div class="res">🪵 <b id="r-wood">${resources.wood}</b></div>
+    <div class="res">🪨 <b id="r-stone">${resources.stone}</b></div>
+    <div class="res">🌽 <b id="r-corn">${resources.corn}</b></div>
+    <div class="res">🍔 <b id="r-food">${resources.food}</b></div>`;
+}
+
+export function updateXPUI(level, xp, required){
+  document.querySelector('#xpText').textContent = `Lv ${level} • ${xp}/${required}`;
+  const p = Math.max(0, Math.min(1, xp / required)) * 100;
+  document.querySelector('#xpBar .fill').style.width = p + '%';
+}
+
+export function showToast(html, actions=[] , timeoutMs=0){
+  const toasts=document.getElementById('toasts');
+  const t=document.createElement('div'); t.className='toast'; t.innerHTML=html;
+  if(actions.length){ const row=document.createElement('div'); row.className='actions';
+    actions.forEach(a=>{ const btn=document.createElement('button'); btn.textContent=a.text; btn.onclick=()=>{ try{a.onClick?.();} finally{toasts.removeChild(t);} }; row.appendChild(btn); });
+    t.appendChild(row);
+  }
+  toasts.appendChild(t); if(timeoutMs>0){ setTimeout(()=>{ if(t.parentNode) toasts.removeChild(t); }, timeoutMs); }
+}
+
+/* ---------- Market ---------- */
+const overlay = document.getElementById('overlay');
+const marketMenu = document.getElementById('marketMenu');
+const marketBtn = document.getElementById('marketBtn');
+const tabWood = document.getElementById('tabWood');
+const tabStone = document.getElementById('tabStone');
+const tabCorn = document.getElementById('tabCorn');
+const mRate = document.getElementById('m-rate');
+const mHave = document.getElementById('m-have');
+const mPacks= document.getElementById('m-packs');
+const mGet = document.getElementById('m-get');
+const mDec = document.getElementById('m-dec');
+const mInc = document.getElementById('m-inc');
+const mMax = document.getElementById('m-max');
+const mSell = document.getElementById('m-sell');
+const mCancel=document.getElementById('m-cancel');
+const mSellAll = document.getElementById('m-sell-all');
+const WOOD_PER_PACK = 10, WOOD_PRICE = 50;
+const STONE_PER_PACK = 10, STONE_PRICE = 150;
+const CORN_PER_PACK = 10, CORN_PRICE = 150;
+let marketResource = 'wood';
+function openMarket(){ overlay.style.display='block'; marketMenu.style.display='block'; setMarketResource(marketResource); updateMarketUI(0,true); }
+function closeMarket(){ overlay.style.display='none'; marketMenu.style.display='none'; }
+marketBtn.onclick = openMarket;
+overlay.onclick = closeMarket; mCancel.onclick = closeMarket;
+function setMarketResource(res){
+  marketResource = res;
+  tabWood.classList.toggle('active', res==='wood');
+  tabStone.classList.toggle('active', res==='stone');
+  tabCorn.classList.toggle('active', res==='corn');
+  if(res==='wood'){ mRate.textContent = '10 🪵 = 50 💰'; mHave.textContent = resources.wood; }
+  else if(res==='stone'){ mRate.textContent = '10 🪨 = 150 💰'; mHave.textContent = resources.stone; }
+  else { mRate.textContent = '10 🌽 = 150 💰'; mHave.textContent = resources.corn; }
+  updateMarketUI(0,true);
+}
+tabWood.onclick = ()=>setMarketResource('wood');
+tabStone.onclick= ()=>setMarketResource('stone');
+tabCorn.onclick = ()=>setMarketResource('corn');
+function maxPacks(){ return marketResource==='wood'?Math.floor(resources.wood/WOOD_PER_PACK):marketResource==='stone'?Math.floor(resources.stone/STONE_PER_PACK):Math.floor(resources.corn/CORN_PER_PACK); }
+function priceFor(packs){ return marketResource==='wood'?packs*WOOD_PRICE:marketResource==='stone'?packs*STONE_PRICE:packs*CORN_PRICE; }
+function updateMarketUI(packs, clamp=false){ const mx=maxPacks(); if(clamp) packs=Math.max(0, Math.min(mx, packs)); mHave.textContent = marketResource==='wood'?resources.wood:marketResource==='stone'?resources.stone:resources.corn; mPacks.textContent=packs; mPacks.dataset.value=packs; mGet.textContent=priceFor(packs); }
+function getPacks(){ return parseInt(mPacks.dataset.value||'0',10); }
+mDec.onclick = ()=>updateMarketUI(getPacks()-1,true);
+mInc.onclick = ()=>updateMarketUI(getPacks()+1,true);
+mMax.onclick = ()=>updateMarketUI(9999,true);
+mSell.onclick = async ()=>{
+  const packs = getPacks(); if(packs<=0) return;
+  if(marketResource==='wood'){ const need=packs*WOOD_PER_PACK; if(resources.wood<need) return showToast('Недостаточно дерева',[],1500); resources.wood-=need; resources.money+=packs*WOOD_PRICE; }
+  else if(marketResource==='stone'){ const need=packs*STONE_PER_PACK; if(resources.stone<need) return showToast('Недостаточно камня',[],1500); resources.stone-=need; resources.money+=packs*STONE_PRICE; }
+  else { const need=packs*CORN_PER_PACK; if(resources.corn<need) return showToast('Недостаточно кукурузы',[],1500); resources.corn-=need; resources.money+=packs*CORN_PRICE; }
+  updateResourcePanel(); schedulePlayerSave(); closeMarket();
+  showToast('Сделка совершена!',[],1200);
+};
+mSellAll.onclick = () => { updateMarketUI(maxPacks(), true); mSell.click(); };
+
+/* ---------- Shop UI ---------- */
+const shopPanel = document.getElementById('shopPanel');
+const shopToggle = document.getElementById('shopToggle');
+const shopClose = document.getElementById('shopClose');
+shopToggle.onclick = ()=> shopPanel.style.display = (shopPanel.style.display==='block'?'none':'block');
+shopClose.onclick = ()=> shopPanel.style.display = 'none';
+shopPanel.querySelectorAll('.card').forEach(card=>{
+  card.addEventListener('click', (e)=>{
+    shopPanel.querySelectorAll('.card').forEach(c=>{ if(c!==card) c.classList.remove('active'); });
+    card.classList.toggle('active'); e.stopPropagation();
+  });
+});
+shopPanel.querySelectorAll('.buyBtn').forEach(btn=>{
+  btn.addEventListener('click', (e)=>{
+    e.stopPropagation();
+    const card = btn.closest('.card');
+    const bp = { type: card.dataset.type, cost: parseInt(card.dataset.cost,10)||0, iconUrl: card.dataset.icon, name: card.dataset.name };
+    window.startPlacement(bp);
+    shopPanel.style.display='none';
+  });
+});
