import {
    BLOCKED_KEYS,
    CONTROLLER_DEADZONE,
    CONTROLLER_LAYOUTS,
    KEYBOARD_LAYOUTS
} from './constants.js';
import { dom } from './dom.js';
import { state } from './state.js';

function keyPressed(codes) {
    return codes.some(code => state.keys[code]);
}

function controlsModalOpen() {
    return dom.controlsModal && !dom.controlsModal.classList.contains('hidden');
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

function applyDeadzone(value) {
    return Math.abs(value) > CONTROLLER_DEADZONE ? value : 0;
}

function getButtonValue(gp, index) {
    const button = gp && gp.buttons[index];
    if (!button) return 0;

    if (typeof button.value === 'number') {
        return button.value;
    }

    return button.pressed ? 1 : 0;
}

function getControllerSourceValue(gp, source) {
    if (!gp || !source) return 0;

    if (source.kind === 'axis') {
        const raw = gp.axes[source.index] || 0;
        const value = applyDeadzone(raw) * (source.direction || 1);
        return value;
    }

    if (source.kind === 'button') {
        return getButtonValue(gp, source.index);
    }

    return 0;
}

function getControllerActionValue(gp, sources) {
    if (!Array.isArray(sources)) {
        return Math.max(0, getControllerSourceValue(gp, sources));
    }

    let value = 0;

    for (const source of sources) {
        value = Math.max(value, getControllerActionValue(gp, source));
    }

    return value;
}

export function isControllerControlPressed(playerId, actionName) {
    const gp = getPlayerGamepad(playerId);
    const layout = CONTROLLER_LAYOUTS[playerId];
    if (!gp || !layout || !layout[actionName]) return false;

    return getControllerActionValue(gp, layout[actionName]) > 0.2;
}

export function isControllerButtonPressed(playerId, buttonIndex) {
    const gp = getPlayerGamepad(playerId);
    if (!gp || !gp.buttons[buttonIndex]) return false;

    return gp.buttons[buttonIndex].pressed;
}

function getControllerInputs(playerId) {
    const gp = getPlayerGamepad(playerId);
    const layout = CONTROLLER_LAYOUTS[playerId];

    let x = 0;
    let y = 0;
    let rot = 0;
    let act = false;
    let toggleIn = false;

    if (!gp || !layout) {
        return { x, y, rot, act, toggleIn };
    }

    x = getControllerSourceValue(gp, layout.moveX);
    y = getControllerSourceValue(gp, layout.moveY);

    rot = getControllerSourceValue(gp, layout.turnAxis);

    const turnLeft = getControllerActionValue(gp, layout.turnLeft);
    const turnRight = getControllerActionValue(gp, layout.turnRight);

    if (turnLeft > 0.05 || turnRight > 0.05) {
        rot += turnRight - turnLeft;
    }

    rot = Math.max(-1, Math.min(1, rot));

    act = getControllerActionValue(gp, layout.action) > 0.2;
    toggleIn = getControllerActionValue(gp, layout.toggle) > 0.2;

    return { x, y, rot, act, toggleIn };
}

export function getInputs(playerId) {
    let x = 0;
    let y = 0;
    let rot = 0;
    let act = false;
    let toggleIn = false;

    if (state.startCountdown > 0 || state.endCooldown > 0 || controlsModalOpen()) {
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
        ({ x, y, rot, act, toggleIn } = getControllerInputs(playerId));
    }

    return { x, y, rot, act, toggleIn };
}

export function initInputListeners() {
    window.addEventListener('keydown', e => {
        if (!controlsModalOpen()) {
            state.keys[e.code] = true;
        }

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
