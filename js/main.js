import './firebase.js';
import { initAuthUI } from './auth.js';
import { initUI } from './ui.js';
import { initMarket } from './market.js';
import { initShop } from './shop.js';
import { initEditor } from './editor.js';
import { initWorkers, hireWoodcutter, hireMiner, hireFermer } from './workers.js';
import { initBuildings, renderBuilding, upgradeBuilding } from './buildings/buildings.js';
import { map, metersToLat, metersToLng } from './map.js';

initAuthUI();
initUI();
initMarket();
initShop();
initEditor();
initWorkers();
initBuildings();

export {
  map,
  metersToLat,
  metersToLng,
  renderBuilding,
  upgradeBuilding,
  hireWoodcutter,
  hireMiner,
  hireFermer
};
