import { FRAME_RATE } from './constants.js';
import { configureCanvas, createRobots, initField, spawnBalls } from './field.js';
import { initInputListeners, refreshInputLabels } from './input.js';
import { update, draw } from './game.js';
import { updateHubUI } from './match.js';
import { initUiListeners } from './ui.js';

configureCanvas();
createRobots();
initField();
spawnBalls();
updateHubUI(false, false);
refreshInputLabels();
initInputListeners();
initUiListeners();

setInterval(update, 1000 / FRAME_RATE);
draw();
