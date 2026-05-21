import { FRAME_RATE } from './constants.js';
import {
    configureCanvas,
    createRobots,
    initField,
    resetBots,
    resetOutposts,
    scheduleGameResize,
    spawnBalls
} from './field.js';
import { initControlsConfig } from './controlsConfig.js';
import { initInputListeners, refreshInputLabels } from './input.js';
import { update, draw } from './game.js';
import { updateHubUI } from './match.js';
import { initUiListeners } from './ui.js';

configureCanvas();
createRobots();
initField();
spawnBalls();
resetOutposts();
resetBots();
updateHubUI(false, false);
initControlsConfig();
refreshInputLabels();
initInputListeners();
initUiListeners();

window.addEventListener('resize', scheduleGameResize);
window.addEventListener('orientationchange', scheduleGameResize);

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleGameResize);
}

scheduleGameResize();

setInterval(update, 1000 / FRAME_RATE);
draw();
