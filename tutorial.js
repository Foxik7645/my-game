// tutorial.js — пошаговое обучение с Советником короля

const wait = (ms)=> new Promise(r=>setTimeout(r,ms));
async function waitForAPI(){
  for(let i=0;i<200;i++){
    if(window.__game) return;
    await wait(50);
  }
}

// DOM
const overlay   = document.getElementById('tutorialOverlay');
const msgNode   = document.getElementById('advisorMessage');
const nextBtn   = document.getElementById('tutorialNextBtn');
const skipBtn   = document.getElementById('tutorialSkipBtn');

let stepIndex = 0;
let active = true;

function showOverlay(message){ overlay.style.display='flex'; msgNode.textContent = message; }
function hideOverlay(){ overlay.style.display='none'; }
function say(t){ msgNode.textContent = t; }

function lockShop(allowedTypes){
  const panel = document.getElementById('shopPanel');
  if(!panel) return;
  panel.querySelectorAll('.card').forEach(card=>{
    const type = card.dataset.type;
    const allowed = allowedTypes.includes(type);
    card.style.pointerEvents = allowed ? 'auto' : 'none';
    card.style.opacity = allowed ? '1' : '0.35';
    const btn = card.querySelector('.buyBtn');
    if(btn){ btn.disabled = !allowed; }
    card.classList.toggle('pulse', allowed);
  });
}

function focusShopCard(type){
  window.__game.openShop();
  const card = document.querySelector(`.card[data-type="${type}"]`);
  if(card){
    card.classList.add('highlight-tut','pulse');
    card.scrollIntoView({block:'center', behavior:'smooth'});
    document.querySelectorAll('#shopPanel .card').forEach(c=> c.classList.toggle('active', c===card));
  }
}

const steps = [
  {
    text: 'Великий король, вам дарована пустая земля. Пора основать королевство и привести его к процветанию!',
    onEnter(){ showOverlay(this.text); window.__game.highlight(null,false); }
  },
  {
    text: 'Начнём с главного. Открой Магазин и построй свою первую Базу — сердце королевства.',
    onEnter(){
      showOverlay(this.text);
      window.__game.openShop();
      lockShop(['base']);
      focusShopCard('base');
      window.__game.highlight('#shopToggle', true);
    },
    waitFor: { event: 'mg:building-added', predicate: b => b.type==='base' }
  },
  {
    text: 'Чтобы содержать королевство, построй кухню HouseEat. В ней готовят 🍔 еду для рабочих.',
    onEnter(){ showOverlay(this.text); lockShop(['houseeat']); focusShopCard('houseeat'); },
    waitFor: { event: 'mg:building-added', predicate: b => b.type==='houseeat' }
  },
  {
    text: 'Теперь построй FermerDom. Фермеры будут добывать 🌽 кукурузу. Рабочих нанимают за 🍔 еду.',
    onEnter(){ showOverlay(this.text); lockShop(['fermerdom']); focusShopCard('fermerdom'); },
    waitFor: { event: 'mg:building-added', predicate: b => b.type==='fermerdom' }
  },
  {
    text: 'Отлично! Если нужно золото — торгуй на рынке: 🪵 дерево, 🪨 камень и 🌽 кукуруза → 💰.',
    onEnter(){ showOverlay(this.text); window.__game.highlight('#marketBtn', true); },
    waitFor: { domClick: '#marketBtn' }
  },
  {
    text: 'Ты основал своё королевство! Советник доволен твоими шагами. Прими царскую награду 🎁',
    onEnter(){
      showOverlay(this.text);
      window.__game.addResources({ wood:50, stone:20, corn:10, food:12 });
      window.__game.toast('🎁 Награда: +50 🪵, +20 🪨, +10 🌽, +12 🍔', 2600);
      setTimeout(()=>{ window.__game.highlight(null,false); hideOverlay(); active=false; }, 1500);
    }
  }
];

let pendingUnsub = null;
function gotoStep(i){
  if (typeof pendingUnsub==='function'){ pendingUnsub(); pendingUnsub=null; }
  stepIndex = i;
  const step = steps[stepIndex];
  if(!step) return;
  step.onEnter?.();
  if(step.waitFor?.event){
    const handler = e=>{
      if(!active) return;
      if(step.waitFor.predicate?.(e.detail)){ window.removeEventListener(step.waitFor.event, handler); gotoStep(stepIndex+1); }
    };
    window.addEventListener(step.waitFor.event, handler);
    pendingUnsub = ()=> window.removeEventListener(step.waitFor.event, handler);
  } else if(step.waitFor?.domClick){
    const el=document.querySelector(step.waitFor.domClick);
    if(el){ el.addEventListener('click', ()=>gotoStep(stepIndex+1), { once:true }); }
  }
}

nextBtn.addEventListener('click', ()=>{ const s=steps[stepIndex]; if(s&&!s.waitFor) gotoStep(stepIndex+1); else say(s.text); });
skipBtn.addEventListener('click', ()=>{ active=false; hideOverlay(); window.__game.highlight(null,false); window.__game.toast('Обучение пропущено',1200); });

(async function boot(){ await waitForAPI(); gotoStep(0); })();
