import { BLOCKED_KEYS, KEYBOARD_LAYOUTS } from './constants.js';
import { dom } from './dom.js';
import { state } from './state.js';

function keyPressed(codes) {
    return codes.some(code => state.keys[code]);
}

function getAvailableGamepadIndices() {
    if (!navigator.getGamepads) return [];

    const pads = navigator.getGamepads();
    const indices = [];

    for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) {
            indices.push(i);
        }
    }

    return indices;
}

function playerNeedsController(playerId) {
    if (playerId === 'p1') {
        return state.p1Input === 'controller';
    }

    return state.p2Enabled && state.p2Input === 'controller';
}

export function assignGamepads() {
    state.gamepadAssignments.p1 = null;
    state.gamepadAssignments.p2 = null;

    const available = getAvailableGamepadIndices();
    let nextIndex = 0;

    if (playerNeedsController('p1') && available[nextIndex] !== undefined) {
        state.gamepadAssignments.p1 = available[nextIndex];
        nextIndex++;
    }

    if (playerNeedsController('p2') && available[nextIndex] !== undefined) {
        state.gamepadAssignments.p2 = available[nextIndex];
    }
}

function getPlayerGamepad(playerId) {
    assignGamepads();

    const index = state.gamepadAssignments[playerId];
    if (index === null || index === undefined || !navigator.getGamepads) {
        return null;
    }

    return navigator.getGamepads()[index] || null;
}

function getInputLabel(playerId) {
    const inputType = playerId === 'p1' ? state.p1Input : state.p2Input;

    if (inputType === 'keyboard') {
        return 'KEYBOARD';
    }

    const index = state.gamepadAssignments[playerId];

    if (index === null || index === undefined) {
        return 'CONTROLLER: NONE';
    }

    return `CONTROLLER ${index + 1}`;
}

export function refreshInputLabels() {
    assignGamepads();
    dom.p1InputToggle.innerText = `P1: ${getInputLabel('p1')}`;
    dom.p2InputToggle.innerText = `P2: ${getInputLabel('p2')}`;
}

export function isControllerButtonPressed(playerId, buttonIndex) {
    const gp = getPlayerGamepad(playerId);
    if (!gp || !gp.buttons[buttonIndex]) return false;

    return gp.buttons[buttonIndex].pressed;
}

export function getInputs(playerId) {
    let x = 0;
    let y = 0;
    let rot = 0;
    let act = false;
    let toggleIn = false;

    if (state.startCountdown > 0 || state.endCooldown > 0) {
        return { x, y, rot, act, toggleIn };
    }

    const type = playerId === 'p1' ? state.p1Input : state.p2Input;

    if (type === 'keyboard') {
        const layout = KEYBOARD_LAYOUTS[playerId];

        if (keyPressed(layout.up)) y -= 1;
        if (keyPressed(layout.down)) y += 1;
        if (keyPressed(layout.left)) x -= 1;
        if (keyPressed(layout.right)) x += 1;
        if (keyPressed(layout.turnLeft)) rot -= 1;
        if (keyPressed(layout.turnRight)) rot += 1;
        if (keyPressed(layout.action)) act = true;
        if (keyPressed(layout.toggle)) toggleIn = true;
    } else if (type === 'controller') {
        const gp = getPlayerGamepad(playerId);

        if (gp) {
            if (gp.axes.length > 0 && Math.abs(gp.axes[0]) > 0.15) x = gp.axes[0];
            if (gp.axes.length > 1 && Math.abs(gp.axes[1]) > 0.15) y = gp.axes[1];

            const rotAxis = Math.abs(gp.axes[2] || 0) > 0.15
                ? gp.axes[2]
                : (gp.axes[3] || 0);

            if (Math.abs(rotAxis) > 0.15) rot = rotAxis;

            const b = gp.buttons;
            const aButton = b[0] && b[0].pressed;
            const rightBumper = b[5] && b[5].pressed;
            const rightTrigger = b[7] && (b[7].pressed || b[7].value > 0.2);
            const leftTrigger = b[6] && (b[6].pressed || b[6].value > 0.2);

            if (aButton || rightBumper || rightTrigger) act = true;
            if (leftTrigger) toggleIn = true;
        }
    }

    return { x, y, rot, act, toggleIn };
}

export function initInputListeners() {
    window.addEventListener('keydown', e => {
        state.keys[e.code] = true;

        if (BLOCKED_KEYS.includes(e.code)) {
            e.preventDefault();
        }
    }, { passive: false });

    window.addEventListener('keyup', e => {
        state.keys[e.code] = false;

        if (BLOCKED_KEYS.includes(e.code)) {
            e.preventDefault();
        }
    }, { passive: false });

    window.addEventListener('gamepadconnected', refreshInputLabels);
    window.addEventListener('gamepaddisconnected', refreshInputLabels);

    window.addEventListener('blur', () => {
        for (const key in state.keys) {
            state.keys[key] = false;
        }
    });
}
