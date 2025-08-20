import { getResources, getLevel, getXp } from './state.js';

function showToast(html, actions=[], timeoutMs=0){
  const wrap=document.getElementById('toasts');
  const t=document.createElement('div');
  t.className='toast';
  t.innerHTML=html;
  if(actions.length){
    const row=document.createElement('div');
    row.className='actions';
    actions.forEach(a=>{
      const btn=document.createElement('button');
      btn.textContent=a.text;
      btn.onclick=()=>{ try{a.onClick?.();} finally{wrap.removeChild(t);} };
      row.appendChild(btn);
    });
    t.appendChild(row);
  }
  wrap.appendChild(t);
  if(timeoutMs>0) setTimeout(()=>{ if(t.parentNode) wrap.removeChild(t); }, timeoutMs);
}

function refreshResources(){
  const resDiv=document.getElementById('resources');
  resDiv.innerHTML='';
  const res=getResources();
  Object.entries(res).forEach(([k,v])=>{
    const el=document.createElement('div');
    el.className='res';
    el.innerHTML=`<span>${k}</span> <b>${v}</b>`;
    resDiv.appendChild(el);
  });
}

function refreshXp(){
  const lvl=getLevel();
  const xp=getXp();
  const needed=500;
  document.getElementById('xpText').textContent=`Lv ${lvl} • ${xp}/${needed}`;
  const pct=Math.min(100, xp/needed*100);
  document.querySelector('#xpBar .fill').style.width=pct+'%';
}

function initUI(){
  refreshResources();
  refreshXp();
}

export { showToast, refreshResources, refreshXp, initUI };
