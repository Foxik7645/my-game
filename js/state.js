const resources = { wood:0, stone:0, food:0, gold:0 };
let level = 1;
let xp = 0;
let saveTimer = null;

function getResources(){ return { ...resources }; }
function setResource(name, value){ resources[name] = value; scheduleSave(); }
function addResource(name, delta){ resources[name] = (resources[name]||0) + delta; scheduleSave(); }

function getLevel(){ return level; }
function setLevel(val){ level = val; scheduleSave(); }

function getXp(){ return xp; }
function addXp(val){ xp += val; scheduleSave(); }

function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{ saveTimer=null; }, 1000);
}

export { getResources, setResource, addResource, getLevel, setLevel, getXp, addXp };
