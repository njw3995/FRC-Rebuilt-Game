import { BOT_MODELS, OUTPOST_TOGGLE_KEYS, START_LABELS } from './constants.js';
import { dom } from './dom.js';
import { state } from './state.js';
import { getBlueStartPos, getRedStartPos, resetBots, resetOutposts, spawnBalls } from './field.js';
import { refreshInputLabels } from './input.js';
import { playSound } from './audio.js';
import { updateHubUI } from './match.js';

function setScoreDisplays() {
    dom.scoreRedDisplay.innerText = state.scoreRed;
    dom.scoreBlueDisplay.innerText = state.scoreBlue;
}

function setHeldDisplays() {
    dom.heldRed.innerText = state.botRed.inventory;
    dom.heldBlue.innerText = state.botBlue.inventory;
}

function clearCountdownInterval() {
    if (state.countdownInterval) {
        clearInterval(state.countdownInterval);
        state.countdownInterval = null;
    }
}

function resetMatchCoreState() {
    state.matchRunning = false;
    state.startCountdown = 0;
    state.endCooldown = 0;
    state.matchElapsed = 0;
    clearCountdownInterval();
}

function disableUnstickButtons() {
    dom.p1Unstick.classList.add('disabled');
    dom.p2Unstick.classList.add('disabled');
}

function stopMatch() {
    resetMatchCoreState();
    state.p1FreezeUntil = 0;
    state.p2FreezeUntil = 0;

    dom.startButton.innerText = '▶ START MATCH';
    dom.startButton.classList.remove('running');
    dom.matchClock.className = 'stopped';
    dom.matchClock.innerText = '2:20';
    dom.phaseLabel.innerText = 'MATCH STOPPED';
    dom.phaseTimer.innerText = '';

    disableUnstickButtons();
    updateHubUI(false, false);
}

function startMatchCountdown() {
    state.endCooldown = 0;
    state.scoreRed = 0;
    state.scoreBlue = 0;
    setScoreDisplays();


    state.autoScoreRed = 0;
    state.autoScoreBlue = 0;
    state.autoPhaseEnded = false;
    state.currentPhaseIdx = -1;

    spawnBalls();
    resetOutposts();
    resetBots();

    state.startCountdown = 3;
    dom.matchClock.innerText = state.startCountdown;
    dom.matchClock.className = 'stopped';
    dom.phaseLabel.innerText = 'MATCH STARTING...';
    dom.phaseTimer.innerText = '';
    dom.startButton.innerText = '⏹ CANCEL START';
    dom.startButton.classList.add('running');

    state.countdownInterval = setInterval(() => {
        state.startCountdown--;

        if (state.startCountdown > 0) {
            dom.matchClock.innerText = state.startCountdown;
            return;
        }

        clearCountdownInterval();
        state.startCountdown = 0;
        state.matchElapsed = 0;
        state.matchRunning = true;

        playSound('autoStart');
        updateHubUI(true, true);
        dom.startButton.innerText = '⏹ STOP MATCH';

        if (!state.p1UnstickUsed) {
            dom.p1Unstick.classList.remove('disabled');
        }

        if (state.p2Enabled && !state.p2UnstickUsed) {
            dom.p2Unstick.classList.remove('disabled');
        }
    }, 1000);
}

function resetField() {
    resetMatchCoreState();

    state.scoreRed = 0;
    state.scoreBlue = 0;
    setScoreDisplays();


    dom.matchClock.innerText = '2:20';
    dom.matchClock.className = 'stopped';
    dom.phaseLabel.innerText = 'MATCH NOT STARTED';
    dom.phaseTimer.innerText = '';
    dom.startButton.innerText = '▶ START MATCH';
    dom.startButton.classList.remove('running');

    disableUnstickButtons();
    updateHubUI(false, false);
    spawnBalls();
    resetOutposts();
    resetBots();
}


export function refreshHumanPlayerToggleLabels() {
    dom.redHumanToggle.innerText = state.humanShootingEnabled.red
        ? 'RED OUTPOST: SHOOT'
        : 'RED OUTPOST: FEED';

    dom.blueHumanToggle.innerText = state.humanShootingEnabled.blue
        ? 'BLUE OUTPOST: SHOOT'
        : 'BLUE OUTPOST: FEED';

    dom.redHumanToggle.title = 'Q or controller Y toggles red outpost between SHOOT and FEED.';
    dom.blueHumanToggle.title = 'Right Alt toggles blue outpost, or red outpost in co-op mode. Controller Y toggles the controller players alliance outpost.';
}

export function toggleHumanPlayerShooting(side) {
    state.humanShootingEnabled[side] = !state.humanShootingEnabled[side];
    refreshHumanPlayerToggleLabels();
}

function cycleBotModel(bot, button, labelPrefix) {
    const modelKeys = Object.keys(BOT_MODELS);
    const currentIndex = modelKeys.indexOf(bot.name);
    const nextModel = modelKeys[(currentIndex + 1) % modelKeys.length];

    bot.setModel(nextModel);
    button.innerText = `${labelPrefix}: ${bot.name}`;
}

function setP2ColorClass(className) {
    dom.botBlueToggle.className = className;
    dom.p2InputToggle.className = className;
    dom.p2StartToggle.className = className;
    dom.p2Unstick.className = `${className} btn-unstick`;

    if (state.p2UnstickUsed || !state.matchRunning) {
        dom.p2Unstick.classList.add('disabled');
    }
}

export function initUiListeners() {
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', function blurButton() {
            this.blur();
        });
    });

    dom.toggleControlsButton.onclick = function toggleControls() {
        dom.controlPanel.classList.toggle('collapsed');
        this.innerText = dom.controlPanel.classList.contains('collapsed')
            ? '☰ SHOW CONTROLS'
            : '☰ HIDE CONTROLS';
    };

    dom.showControlsButton.onclick = () => {
        dom.controlsModal.classList.remove('hidden');
    };

    dom.closeControlsButton.onclick = () => {
        dom.controlsModal.classList.add('hidden');
    };

    dom.p1Unstick.onclick = function unstickP1() {
        if (!state.matchRunning || state.p1UnstickUsed) return;

        state.p1UnstickUsed = true;
        this.classList.add('disabled');

        const rPos = getRedStartPos();
        state.botRed.x = rPos.x;
        state.botRed.y = rPos.y;
        state.botRed.vx = 0;
        state.botRed.vy = 0;
        state.botRed.vAngle = 0;
        state.botRed.angle = rPos.a;
        state.p1FreezeUntil = Date.now() + 3000;
    };

    dom.p2Unstick.onclick = function unstickP2() {
        if (!state.matchRunning || state.p2UnstickUsed || !state.p2Enabled) return;

        state.p2UnstickUsed = true;
        this.classList.add('disabled');

        const bPos = getBlueStartPos();
        state.botBlue.x = bPos.x;
        state.botBlue.y = bPos.y;
        state.botBlue.vx = 0;
        state.botBlue.vy = 0;
        state.botBlue.vAngle = 0;
        state.botBlue.angle = bPos.a;
        state.p2FreezeUntil = Date.now() + 3000;
    };

    dom.p1StartToggle.onclick = function toggleP1Start() {
        if (state.matchRunning || state.startCountdown > 0) return;

        state.p1StartIdx = (state.p1StartIdx + 1) % 3;
        this.innerText = `P1 START: ${START_LABELS[state.p1StartIdx]}`;
        resetBots();
    };

    dom.p2StartToggle.onclick = function toggleP2Start() {
        if (state.matchRunning || state.startCountdown > 0) return;

        state.p2StartIdx = (state.p2StartIdx + 1) % 3;
        this.innerText = `P2 START: ${START_LABELS[state.p2StartIdx]}`;
        resetBots();
    };

    dom.redHumanToggle.onclick = () => toggleHumanPlayerShooting('red');

    dom.blueHumanToggle.onclick = () => toggleHumanPlayerShooting('blue');

    window.addEventListener('keydown', event => {
        if (event.repeat) return;

        if (event.code === OUTPOST_TOGGLE_KEYS.red) {
            event.preventDefault();
            toggleHumanPlayerShooting('red');
        }

        if (event.code === OUTPOST_TOGGLE_KEYS.blue) {
            event.preventDefault();
            toggleHumanPlayerShooting(state.sameTeamMode ? 'red' : 'blue');
        }
    }, { passive: false });

    refreshHumanPlayerToggleLabels();

    dom.teamModeToggle.onclick = function toggleTeamMode() {
        if (state.matchRunning || state.startCountdown > 0) return;

        state.sameTeamMode = !state.sameTeamMode;
        this.innerText = `TEAM: ${state.sameTeamMode ? 'CO-OP (RED)' : 'SEPARATE'}`;
        setP2ColorClass(state.sameTeamMode ? 'red-team' : 'blue-team');
        resetField();
    };

    dom.p1InputToggle.onclick = function toggleP1Input() {
        if (state.matchRunning || state.startCountdown > 0) return;

        state.p1Input = state.p1Input === 'keyboard' ? 'controller' : 'keyboard';
        refreshInputLabels();
    };

    dom.p2InputToggle.onclick = function toggleP2Input() {
        if (state.matchRunning || state.startCountdown > 0) return;

        state.p2Input = state.p2Input === 'keyboard' ? 'controller' : 'keyboard';
        refreshInputLabels();
    };

    dom.p2Toggle.onclick = () => {
        if (state.matchRunning || state.startCountdown > 0) return;

        state.p2Enabled = !state.p2Enabled;

        if (state.p2Enabled) {
            dom.p2Toggle.innerText = 'PLAYER 2: ON';
            dom.p2Toggle.classList.remove('disabled');
            resetBots();
        } else {
            dom.p2Toggle.innerText = 'PLAYER 2: OFF';
            dom.p2Toggle.classList.add('disabled');
            state.botBlue.x = -1000;
            state.botBlue.y = -1000;
            state.gamepadAssignments.p2 = null;
            dom.p2Unstick.classList.add('disabled');
        }

        refreshInputLabels();
    };

    dom.startButton.onclick = () => {
        if (state.matchRunning || state.startCountdown > 0) {
            stopMatch();
            return;
        }

        startMatchCountdown();
    };

    dom.botRedToggle.onclick = () => {
        if (state.matchRunning || state.startCountdown > 0) return;
        cycleBotModel(state.botRed, dom.botRedToggle, 'PLAYER 1');
    };

    dom.botBlueToggle.onclick = () => {
        if (state.matchRunning || state.startCountdown > 0) return;
        cycleBotModel(state.botBlue, dom.botBlueToggle, 'PLAYER 2');
    };

    dom.resetButton.onclick = resetField;
}
