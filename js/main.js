import './firebase.js';
import { updateResourcePanel } from './ui.js';
import { addXP } from './state.js';
import { startPlacement } from './game.js';
import './editor.js';
import './auth.js';

window.startPlacement = startPlacement;
updateResourcePanel();
addXP(0);
