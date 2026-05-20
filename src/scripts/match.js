import { MATCH_PHASES, SHIFT_STATES } from './constants.js';
import { dom } from './dom.js';
import { playSound } from './audio.js';
import { state } from './state.js';

function formatTime(s) {
    s = Math.max(0, Math.ceil(s));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

function getDisplayTime(elapsed) {
    if (elapsed <= 20) return formatTime(20 - elapsed);
    if (elapsed <= 23) return formatTime(23 - elapsed);
    if (elapsed <= 163) return formatTime(163 - elapsed);
    return '0:00';
}


export function isHubActiveAt(side, elapsed) {
    if (elapsed < 0 || elapsed >= 163) return false;

    const phaseIdx = MATCH_PHASES.findIndex(
        p => elapsed >= p.start && elapsed < p.end
    );

    if (phaseIdx === -1) return false;

    const phase = MATCH_PHASES[phaseIdx];
    let redActive = phase.redActive;
    let blueActive = phase.blueActive;

    if (redActive === null) {
        redActive = SHIFT_STATES[state.autoWinner][phaseIdx - 3].redActive;
        blueActive = SHIFT_STATES[state.autoWinner][phaseIdx - 3].blueActive;
    }

    return side === 'red' ? redActive : blueActive;
}

function triggerShiftFlash() {
    dom.shiftFlash.classList.add('flash');
    setTimeout(() => dom.shiftFlash.classList.remove('flash'), 200);
}

function getPulseColor(r, g, b) {
    const p = (Math.sin(Date.now() / 250) + 1) / 2;
    return `rgb(${Math.round(r + (255 - r) * p)}, ${Math.round(g + (255 - g) * p)}, ${Math.round(b + (255 - b) * p)})`;
}

export function updateHubUI(redActive, blueActive) {
    dom.hubRed.className = `hub-indicator ${redActive ? 'hub-active-red' : 'hub-inactive'}`;
    dom.hubBlue.className = `hub-indicator ${blueActive ? 'hub-active-blue' : 'hub-inactive'}`;
    dom.hubRedText.innerText = redActive ? 'ACTIVE' : 'INACTIVE';
    dom.hubBlueText.innerText = blueActive ? 'ACTIVE' : 'INACTIVE';
    state.hubRedActive = redActive;
    state.hubBlueActive = blueActive;
}

export function updateHudBar() {
    if (!state.matchRunning) {
        dom.mainHud.style.borderBottomColor = '#fbbf24';
        return;
    }

    const currentPhase = MATCH_PHASES[state.currentPhaseIdx];
    if (!currentPhase) return;

    const timeLeft = currentPhase.end - state.matchElapsed;

    if (state.hubRedActive && state.hubBlueActive) {
        dom.mainHud.style.borderBottomColor = 'rgb(255, 255, 255)';
    } else if (state.hubRedActive) {
        dom.mainHud.style.borderBottomColor = timeLeft <= 10
            ? getPulseColor(239, 68, 68)
            : 'rgb(239, 68, 68)';
    } else if (state.hubBlueActive) {
        dom.mainHud.style.borderBottomColor = timeLeft <= 10
            ? getPulseColor(59, 130, 246)
            : 'rgb(59, 130, 246)';
    } else {
        dom.mainHud.style.borderBottomColor = 'rgb(85, 85, 85)';
    }
}

function endMatch() {
    state.matchRunning = false;
    state.endCooldown = 10;
    playSound('end');

    const endInterval = setInterval(() => {
        state.endCooldown = Math.max(0, state.endCooldown - 1);
        if (state.endCooldown === 0) clearInterval(endInterval);
    }, 1000);

    dom.matchClock.innerText = '0:00';
    dom.phaseLabel.innerText = 'MATCH OVER';
    dom.phaseTimer.innerText = '';
    dom.startButton.innerText = '▶ START MATCH';
    dom.startButton.classList.remove('running');
    dom.p1Unstick.classList.add('disabled');
    dom.p2Unstick.classList.add('disabled');
    updateHubUI(false, false);
}

export function tickMatch() {
    if (!state.matchRunning) return;

    state.matchElapsed += 1 / 60;

    if (state.matchElapsed >= 163) {
        endMatch();
        return;
    }

    let phaseIdx = MATCH_PHASES.findIndex(
        p => state.matchElapsed >= p.start && state.matchElapsed < p.end
    );

    if (phaseIdx === -1) phaseIdx = 7;

    const phase = MATCH_PHASES[phaseIdx];
    dom.matchClock.innerText = getDisplayTime(state.matchElapsed);
    dom.phaseLabel.innerText = phase.name;

    dom.matchClock.className = phaseIdx === 0
        ? 'auto-phase'
        : phaseIdx === 1
            ? 'delay-phase'
            : phaseIdx === 7
                ? 'endgame-phase'
                : '';

    const phaseTimeLeft = Math.max(0, Math.ceil(phase.end - state.matchElapsed));
    dom.phaseTimer.innerText = `${phaseTimeLeft}s`;

    if (state.hubRedActive && state.hubBlueActive) {
        dom.phaseTimer.style.color = '#fff';
        dom.phaseTimer.style.textShadow = '0 0 10px rgba(255, 255, 255, 0.5)';
    } else if (state.hubRedActive) {
        dom.phaseTimer.style.color = '#ef4444';
        dom.phaseTimer.style.textShadow = '0 0 10px rgba(239, 68, 68, 0.6)';
    } else if (state.hubBlueActive) {
        dom.phaseTimer.style.color = '#3b82f6';
        dom.phaseTimer.style.textShadow = '0 0 10px rgba(59, 130, 246, 0.6)';
    } else {
        dom.phaseTimer.style.color = '#888';
        dom.phaseTimer.style.textShadow = 'none';
    }

    if (!state.autoPhaseEnded && state.matchElapsed >= 20) {
        state.autoPhaseEnded = true;
        playSound('end');
        state.autoWinner = state.autoScoreBlue > state.autoScoreRed ? 'blue' : 'red';
        dom.autoWinner.innerText = `AUTO WON BY ${state.autoWinner.toUpperCase()}`;
        dom.autoWinner.classList.add('visible');
        setTimeout(() => dom.autoWinner.classList.remove('visible'), 3000);
    }

    if (phaseIdx !== state.currentPhaseIdx) {
        state.currentPhaseIdx = phaseIdx;

        let redActive = phase.redActive;
        let blueActive = phase.blueActive;

        if (redActive === null) {
            redActive = SHIFT_STATES[state.autoWinner][phaseIdx - 3].redActive;
            blueActive = SHIFT_STATES[state.autoWinner][phaseIdx - 3].blueActive;
        }

        updateHubUI(redActive, blueActive);

        if (phaseIdx === 2) playSound('teleopStart');
        if (phaseIdx === 7) playSound('endgameStart');

        if (phaseIdx >= 3 && phaseIdx <= 6) {
            triggerShiftFlash();
            playSound('shiftChange');
        }
    }
}
