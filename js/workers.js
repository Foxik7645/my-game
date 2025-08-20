const workers = [];

function hireWorkerGeneric(homeId, type){
  const worker = { homeId, type };
  workers.push(worker);
  return worker;
}

function hireWoodcutter(homeId){ return hireWorkerGeneric(homeId, 'wood'); }
function hireMiner(homeId){ return hireWorkerGeneric(homeId, 'miner'); }
function hireFermer(homeId){ return hireWorkerGeneric(homeId, 'farmer'); }

function moveWorkers(){
  requestAnimationFrame(moveWorkers);
}

function initWorkers(){
  moveWorkers();
}

export { initWorkers, hireWoodcutter, hireMiner, hireFermer };
