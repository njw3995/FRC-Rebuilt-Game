import {
    BLOCKED_KEYS,
    CONTROLLER_LAYOUTS,
    KEYBOARD_LAYOUTS,
    MATCH_CONTROL_KEYS,
    OUTPOST_TOGGLE_KEYS
} from './constants.js';
import { dom } from './dom.js';

const STORAGE_KEY = 'frc-2026-control-bindings-v2';

const DEFAULT_KEYBOARD_LAYOUTS = JSON.parse(JSON.stringify(KEYBOARD_LAYOUTS));
const DEFAULT_OUTPOST_TOGGLE_KEYS = JSON.parse(JSON.stringify(OUTPOST_TOGGLE_KEYS));
const DEFAULT_MATCH_CONTROL_KEYS = JSON.parse(JSON.stringify(MATCH_CONTROL_KEYS));
const DEFAULT_CONTROLLER_LAYOUTS = JSON.parse(JSON.stringify(CONTROLLER_LAYOUTS));

let captureBindingId = null;
let controllerCaptureStart = null;

const GAMEPAD_BUTTON_LABELS = {
    0: 'A / Cross',
    1: 'B / Circle',
    2: 'X / Square',
    3: 'Y / Triangle',
    4: 'Left Bumper',
    5: 'Right Bumper',
    6: 'Left Trigger',
    7: 'Right Trigger',
    8: 'Back / Select',
    9: 'Start / Menu',
    10: 'Left Stick Press',
    11: 'Right Stick Press',
    12: 'D-Pad Up',
    13: 'D-Pad Down',
    14: 'D-Pad Left',
    15: 'D-Pad Right',
    16: 'Home'
};

const GAMEPAD_AXIS_LABELS = {
    0: 'Left Stick X',
    1: 'Left Stick Y',
    2: 'Right Stick X',
    3: 'Right Stick Y'
};

const CONTROL_BINDINGS = [
    {
        id: 'p1.up',
        group: 'Keyboard Player 1',
        label: 'Move Up',
        type: 'keyboard',
        player: 'p1',
        action: 'up',
        description: 'Moves player 1 toward the top of the field.'
    },
    {
        id: 'p1.down',
        group: 'Keyboard Player 1',
        label: 'Move Down',
        type: 'keyboard',
        player: 'p1',
        action: 'down',
        description: 'Moves player 1 toward the bottom of the field.'
    },
    {
        id: 'p1.left',
        group: 'Keyboard Player 1',
        label: 'Move Left',
        type: 'keyboard',
        player: 'p1',
        action: 'left',
        description: 'Moves player 1 left across the field.'
    },
    {
        id: 'p1.right',
        group: 'Keyboard Player 1',
        label: 'Move Right',
        type: 'keyboard',
        player: 'p1',
        action: 'right',
        description: 'Moves player 1 right across the field.'
    },
    {
        id: 'p1.turnLeft',
        group: 'Keyboard Player 1',
        label: 'Turn Left',
        type: 'keyboard',
        player: 'p1',
        action: 'turnLeft',
        description: 'Rotates player 1 counterclockwise.'
    },
    {
        id: 'p1.turnRight',
        group: 'Keyboard Player 1',
        label: 'Turn Right',
        type: 'keyboard',
        player: 'p1',
        action: 'turnRight',
        description: 'Rotates player 1 clockwise.'
    },
    {
        id: 'p1.action',
        group: 'Keyboard Player 1',
        label: 'Shoot / Pass',
        type: 'keyboard',
        player: 'p1',
        action: 'action',
        description: 'Shoots into the hub when allowed, or passes fuel when that robot type supports it.'
    },
    {
        id: 'p1.toggle',
        group: 'Keyboard Player 1',
        label: 'Swap Intake',
        type: 'keyboard',
        player: 'p1',
        action: 'toggle',
        description: 'Swaps the active intake side for the Blitz robot.'
    },
    {
        id: 'p2.up',
        group: 'Keyboard Player 2',
        label: 'Move Up',
        type: 'keyboard',
        player: 'p2',
        action: 'up',
        description: 'Moves player 2 toward the top of the field.'
    },
    {
        id: 'p2.down',
        group: 'Keyboard Player 2',
        label: 'Move Down',
        type: 'keyboard',
        player: 'p2',
        action: 'down',
        description: 'Moves player 2 toward the bottom of the field.'
    },
    {
        id: 'p2.left',
        group: 'Keyboard Player 2',
        label: 'Move Left',
        type: 'keyboard',
        player: 'p2',
        action: 'left',
        description: 'Moves player 2 left across the field.'
    },
    {
        id: 'p2.right',
        group: 'Keyboard Player 2',
        label: 'Move Right',
        type: 'keyboard',
        player: 'p2',
        action: 'right',
        description: 'Moves player 2 right across the field.'
    },
    {
        id: 'p2.turnLeft',
        group: 'Keyboard Player 2',
        label: 'Turn Left',
        type: 'keyboard',
        player: 'p2',
        action: 'turnLeft',
        description: 'Rotates player 2 counterclockwise.'
    },
    {
        id: 'p2.turnRight',
        group: 'Keyboard Player 2',
        label: 'Turn Right',
        type: 'keyboard',
        player: 'p2',
        action: 'turnRight',
        description: 'Rotates player 2 clockwise.'
    },
    {
        id: 'p2.action',
        group: 'Keyboard Player 2',
        label: 'Shoot / Pass',
        type: 'keyboard',
        player: 'p2',
        action: 'action',
        description: 'Shoots into the hub when allowed, or passes fuel when that robot type supports it.'
    },
    {
        id: 'p2.toggle',
        group: 'Keyboard Player 2',
        label: 'Swap Intake',
        type: 'keyboard',
        player: 'p2',
        action: 'toggle',
        description: 'Swaps the active intake side for the Blitz robot.'
    },
    {
        id: 'outpost.red',
        group: 'Human Players Keyboard',
        label: 'Red Human Player Swap',
        type: 'outpost',
        side: 'red',
        description: 'Toggles the red outpost between SHOOT and FEED.'
    },
    {
        id: 'outpost.blue',
        group: 'Human Players Keyboard',
        label: 'Blue Human Player Swap',
        type: 'outpost',
        side: 'blue',
        description: 'Toggles the blue outpost between SHOOT and FEED. In co-op mode this toggles the red outpost.'
    },
    {
        id: 'match.startRestartCombo.0',
        group: 'Match Keyboard',
        label: 'Start / Restart Combo Key 1',
        type: 'match',
        action: 'startRestartCombo',
        slot: 0,
        description: 'One of the three keys that must be held with the other combo keys to start or restart the match.'
    },
    {
        id: 'match.startRestartCombo.1',
        group: 'Match Keyboard',
        label: 'Start / Restart Combo Key 2',
        type: 'match',
        action: 'startRestartCombo',
        slot: 1,
        description: 'One of the three keys that must be held with the other combo keys to start or restart the match.'
    },
    {
        id: 'match.startRestartCombo.2',
        group: 'Match Keyboard',
        label: 'Start / Restart Combo Key 3',
        type: 'match',
        action: 'startRestartCombo',
        slot: 2,
        description: 'One of the three keys that must be held with the other combo keys to start or restart the match.'
    },
    {
        id: 'match.stop',
        group: 'Match Keyboard',
        label: 'Stop Match',
        type: 'match',
        action: 'stop',
        description: 'Stops the current match or cancels the start countdown.'
    },
    ...createControllerBindings('p1', 'Controller Player 1'),
    ...createControllerBindings('p2', 'Controller Player 2')
];

function createControllerBindings(player, group) {
    const playerLabel = player === 'p1' ? 'player 1' : 'player 2';

    return [
        {
            id: `controller.${player}.moveX`,
            group,
            label: 'Drive X',
            type: 'controller',
            player,
            action: 'moveX',
            allowedKinds: ['axis'],
            captureText: 'MOVE ANY STICK LEFT OR RIGHT',
            description: `Maps left/right drive for ${playerLabel} to any joystick axis. Moving the stick in the opposite direction while binding will invert that axis.`
        },
        {
            id: `controller.${player}.moveY`,
            group,
            label: 'Drive Y',
            type: 'controller',
            player,
            action: 'moveY',
            allowedKinds: ['axis'],
            captureText: 'MOVE ANY STICK UP OR DOWN',
            description: `Maps forward/back drive for ${playerLabel} to any joystick axis. Moving the stick in the opposite direction while binding will invert that axis.`
        },
        {
            id: `controller.${player}.turnAxis`,
            group,
            label: 'Turn Axis',
            type: 'controller',
            player,
            action: 'turnAxis',
            allowedKinds: ['axis'],
            captureText: 'MOVE A TURN STICK AXIS',
            description: `Maps analog turning for ${playerLabel} to any joystick axis, usually right stick X.`
        },
        {
            id: `controller.${player}.turnLeft`,
            group,
            label: 'Turn Left Button / Trigger',
            type: 'controller',
            player,
            action: 'turnLeft',
            allowedKinds: ['button', 'axis'],
            clearable: true,
            captureText: 'PRESS A BUTTON/TRIGGER OR MOVE AN AXIS',
            description: `Optional left turn input for ${playerLabel}. This can be a bumper, trigger, button, stick press, or one direction of a joystick axis.`
        },
        {
            id: `controller.${player}.turnRight`,
            group,
            label: 'Turn Right Button / Trigger',
            type: 'controller',
            player,
            action: 'turnRight',
            allowedKinds: ['button', 'axis'],
            clearable: true,
            captureText: 'PRESS A BUTTON/TRIGGER OR MOVE AN AXIS',
            description: `Optional right turn input for ${playerLabel}. This can be a bumper, trigger, button, stick press, or one direction of a joystick axis.`
        },
        {
            id: `controller.${player}.action.0`,
            group,
            label: 'Shoot / Pass Primary',
            type: 'controller',
            player,
            action: 'action',
            slot: 0,
            allowedKinds: ['button'],
            captureText: 'PRESS A BUTTON OR TRIGGER',
            description: `Primary shoot/pass input for ${playerLabel}. Triggers, bumpers, face buttons, and stick presses all work.`
        },
        {
            id: `controller.${player}.action.1`,
            group,
            label: 'Shoot / Pass Alternate 1',
            type: 'controller',
            player,
            action: 'action',
            slot: 1,
            allowedKinds: ['button'],
            clearable: true,
            captureText: 'PRESS A BUTTON OR TRIGGER',
            description: `Optional alternate shoot/pass input for ${playerLabel}.`
        },
        {
            id: `controller.${player}.action.2`,
            group,
            label: 'Shoot / Pass Alternate 2',
            type: 'controller',
            player,
            action: 'action',
            slot: 2,
            allowedKinds: ['button'],
            clearable: true,
            captureText: 'PRESS A BUTTON OR TRIGGER',
            description: `Optional second alternate shoot/pass input for ${playerLabel}.`
        },
        {
            id: `controller.${player}.toggle.0`,
            group,
            label: 'Swap Intake',
            type: 'controller',
            player,
            action: 'toggle',
            slot: 0,
            allowedKinds: ['button'],
            captureText: 'PRESS A BUTTON OR TRIGGER',
            description: `Swaps the active intake side for ${playerLabel} when using the Blitz robot.`
        },
        {
            id: `controller.${player}.outpost.0`,
            group,
            label: 'Human Player Swap',
            type: 'controller',
            player,
            action: 'outpost',
            slot: 0,
            allowedKinds: ['button'],
            captureText: 'PRESS A BUTTON',
            description: `Toggles ${playerLabel}'s alliance outpost between SHOOT and FEED. In co-op mode player 2 also toggles red.`
        }
    ];
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function cloneKeyboardLayouts(source) {
    for (const playerId of Object.keys(source)) {
        if (!KEYBOARD_LAYOUTS[playerId]) continue;

        for (const action of Object.keys(source[playerId])) {
            if (!Array.isArray(source[playerId][action])) continue;
            KEYBOARD_LAYOUTS[playerId][action] = [...source[playerId][action]];
        }
    }
}

function cloneOutpostKeys(source) {
    if (source.red) OUTPOST_TOGGLE_KEYS.red = source.red;
    if (source.blue) OUTPOST_TOGGLE_KEYS.blue = source.blue;
}

function cloneMatchControlKeys(source) {
    if (Array.isArray(source.startRestartCombo)) {
        MATCH_CONTROL_KEYS.startRestartCombo = [...source.startRestartCombo];
    }

    if (source.stop) {
        MATCH_CONTROL_KEYS.stop = source.stop;
    }
}

function cloneControllerLayouts(source) {
    for (const playerId of Object.keys(CONTROLLER_LAYOUTS)) {
        if (!source[playerId]) continue;

        for (const action of Object.keys(CONTROLLER_LAYOUTS[playerId])) {
            if (!(action in source[playerId])) continue;
            CONTROLLER_LAYOUTS[playerId][action] = deepClone(source[playerId][action]);
        }
    }
}

function getBindingById(id) {
    return CONTROL_BINDINGS.find(binding => binding.id === id);
}

function getControllerBindingSource(binding) {
    const value = CONTROLLER_LAYOUTS[binding.player][binding.action];

    if (binding.slot === undefined) {
        return value;
    }

    if (!Array.isArray(value)) {
        return null;
    }

    return value[binding.slot] || null;
}

function setControllerBindingSource(binding, source) {
    if (binding.slot === undefined) {
        CONTROLLER_LAYOUTS[binding.player][binding.action] = source;
    } else {
        if (!Array.isArray(CONTROLLER_LAYOUTS[binding.player][binding.action])) {
            CONTROLLER_LAYOUTS[binding.player][binding.action] = [];
        }

        CONTROLLER_LAYOUTS[binding.player][binding.action][binding.slot] = source;
    }
}

function getBindingCode(binding) {
    if (binding.type === 'keyboard') {
        return KEYBOARD_LAYOUTS[binding.player][binding.action][0];
    }

    if (binding.type === 'outpost') {
        return OUTPOST_TOGGLE_KEYS[binding.side];
    }

    if (binding.type === 'match') {
        if (binding.action === 'startRestartCombo') {
            return MATCH_CONTROL_KEYS.startRestartCombo[binding.slot];
        }

        if (binding.action === 'stop') {
            return MATCH_CONTROL_KEYS.stop;
        }
    }

    return null;
}

function setBindingCode(binding, code) {
    if (binding.type === 'keyboard') {
        KEYBOARD_LAYOUTS[binding.player][binding.action] = [code];
    } else if (binding.type === 'outpost') {
        OUTPOST_TOGGLE_KEYS[binding.side] = code;
    } else if (binding.type === 'match') {
        if (binding.action === 'startRestartCombo') {
            MATCH_CONTROL_KEYS.startRestartCombo[binding.slot] = code;
        } else if (binding.action === 'stop') {
            MATCH_CONTROL_KEYS.stop = code;
        }
    }

    saveControlBindings();
    refreshBlockedKeys();
    renderControlsConfig();
}

function getSavedControlBindings() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
        return null;
    }
}

function saveControlBindings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        keyboardLayouts: KEYBOARD_LAYOUTS,
        outpostToggleKeys: OUTPOST_TOGGLE_KEYS,
        matchControlKeys: MATCH_CONTROL_KEYS,
        controllerLayouts: CONTROLLER_LAYOUTS
    }));
}

function applySavedControlBindings() {
    const saved = getSavedControlBindings();
    if (!saved) return;

    if (saved.keyboardLayouts) {
        cloneKeyboardLayouts(saved.keyboardLayouts);
    }

    if (saved.outpostToggleKeys) {
        cloneOutpostKeys(saved.outpostToggleKeys);
    }

    if (saved.matchControlKeys) {
        cloneMatchControlKeys(saved.matchControlKeys);
    }

    if (saved.controllerLayouts) {
        cloneControllerLayouts(saved.controllerLayouts);
    }
}

function resetControlBindings() {
    localStorage.removeItem(STORAGE_KEY);
    cloneKeyboardLayouts(DEFAULT_KEYBOARD_LAYOUTS);
    cloneOutpostKeys(DEFAULT_OUTPOST_TOGGLE_KEYS);
    cloneMatchControlKeys(DEFAULT_MATCH_CONTROL_KEYS);
    cloneControllerLayouts(DEFAULT_CONTROLLER_LAYOUTS);
    refreshBlockedKeys();
    renderControlsConfig();
}

function refreshBlockedKeys() {
    const blocked = new Set();

    for (const playerId of Object.keys(KEYBOARD_LAYOUTS)) {
        for (const codes of Object.values(KEYBOARD_LAYOUTS[playerId])) {
            codes.forEach(code => blocked.add(code));
        }
    }

    blocked.add(OUTPOST_TOGGLE_KEYS.red);
    blocked.add(OUTPOST_TOGGLE_KEYS.blue);
    MATCH_CONTROL_KEYS.startRestartCombo.forEach(code => blocked.add(code));
    blocked.add(MATCH_CONTROL_KEYS.stop);

    BLOCKED_KEYS.length = 0;
    blocked.forEach(code => BLOCKED_KEYS.push(code));
}

function formatKeyCode(code) {
    const labels = {
        Space: 'Space',
        ControlLeft: 'Left Ctrl',
        ControlRight: 'Right Ctrl',
        ShiftLeft: 'Left Shift',
        ShiftRight: 'Right Shift',
        AltLeft: 'Left Alt',
        AltRight: 'Right Alt',
        ArrowUp: 'Arrow Up',
        ArrowDown: 'Arrow Down',
        ArrowLeft: 'Arrow Left',
        ArrowRight: 'Arrow Right',
        Period: '.',
        Slash: '/',
        Comma: ',',
        Semicolon: ';',
        Quote: "'",
        BracketLeft: '[',
        BracketRight: ']',
        Backslash: '\\',
        Enter: 'Enter',
        Minus: '-',
        Equal: '=',
        Backquote: '`'
    };

    if (labels[code]) return labels[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return `Numpad ${code.slice(6)}`;

    return code;
}

function formatControllerSource(source, binding) {
    if (!source) return 'Unassigned';

    if (source.kind === 'button') {
        return GAMEPAD_BUTTON_LABELS[source.index] || `Button ${source.index}`;
    }

    if (source.kind === 'axis') {
        const axisLabel = GAMEPAD_AXIS_LABELS[source.index] || `Axis ${source.index}`;

        if (binding.action === 'moveX' || binding.action === 'moveY' || binding.action === 'turnAxis') {
            return axisLabel;
        }

        return `${axisLabel} ${source.direction === -1 ? '-' : '+'}`;
    }

    return 'Unknown';
}

function getConflictingBindingIds(code, currentId) {
    return CONTROL_BINDINGS
        .filter(binding => {
            if (binding.id === currentId) return false;
            return ['keyboard', 'outpost', 'match'].includes(binding.type) &&
                getBindingCode(binding) === code;
        })
        .map(binding => binding.id);
}

function createBindingRow(binding) {
    const row = document.createElement('div');
    row.className = 'control-config-row';
    row.title = binding.description;

    const meta = document.createElement('div');
    meta.className = 'control-config-meta';

    const title = document.createElement('div');
    title.className = 'control-config-label';
    title.innerText = binding.label;

    const description = document.createElement('div');
    description.className = 'control-config-description';
    description.innerText = binding.description;

    meta.appendChild(title);
    meta.appendChild(description);

    const actions = document.createElement('div');
    actions.className = 'control-bind-actions';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'control-bind-button';
    button.dataset.bindingId = binding.id;

    if (captureBindingId === binding.id) {
        button.innerText = binding.type === 'controller' ? binding.captureText : 'PRESS KEY...';
        button.classList.add('capturing');
    } else if (binding.type === 'controller') {
        button.innerText = formatControllerSource(getControllerBindingSource(binding), binding);
    } else {
        button.innerText = formatKeyCode(getBindingCode(binding));
    }

    if (binding.type !== 'controller') {
        const conflicts = getConflictingBindingIds(getBindingCode(binding), binding.id);
        if (conflicts.length > 0) {
            button.classList.add('conflict');
            button.title = 'This key is used by another control.';
        } else {
            button.title = 'Click to change this key.';
        }
    } else {
        button.title = 'Click to change this controller input.';
    }

    button.addEventListener('click', () => {
        captureBindingId = binding.id;
        controllerCaptureStart = binding.type === 'controller' ? getControllerSnapshot() : null;
        renderControlsConfig();
    });

    actions.appendChild(button);

    if (binding.type === 'controller' && binding.clearable) {
        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'control-clear-button';
        clearButton.innerText = 'CLEAR';
        clearButton.title = 'Remove this optional controller binding.';
        clearButton.addEventListener('click', () => {
            captureBindingId = null;
            controllerCaptureStart = null;
            setControllerBindingSource(binding, null);
            saveControlBindings();
            renderControlsConfig();
        });
        actions.appendChild(clearButton);
    }

    row.appendChild(meta);
    row.appendChild(actions);

    return row;
}

export function renderControlsConfig() {
    if (!dom.controlsConfigContent) return;

    dom.controlsConfigContent.innerHTML = '';

    const groups = new Map();
    for (const binding of CONTROL_BINDINGS) {
        if (!groups.has(binding.group)) {
            groups.set(binding.group, []);
        }
        groups.get(binding.group).push(binding);
    }

    for (const [groupName, bindings] of groups.entries()) {
        const section = document.createElement('div');
        section.className = 'control-config-section';

        const heading = document.createElement('h3');
        heading.innerText = groupName;
        section.appendChild(heading);

        for (const binding of bindings) {
            section.appendChild(createBindingRow(binding));
        }

        dom.controlsConfigContent.appendChild(section);
    }
}

export function openControlsConfig() {
    captureBindingId = null;
    controllerCaptureStart = null;
    renderControlsConfig();
    dom.controlsModal.classList.remove('hidden');
}

export function closeControlsConfig() {
    captureBindingId = null;
    controllerCaptureStart = null;
    dom.controlsModal.classList.add('hidden');
    renderControlsConfig();
}

function getControllerSnapshot() {
    if (!navigator.getGamepads) return [];

    return Array.from(navigator.getGamepads()).map(gp => {
        if (!gp || !gp.connected) return null;

        return {
            axes: Array.from(gp.axes || []),
            buttons: Array.from(gp.buttons || []).map(button => button ? button.value : 0)
        };
    });
}

function getPreviousAxisValue(padIndex, axisIndex) {
    const previousPad = controllerCaptureStart && controllerCaptureStart[padIndex];
    if (!previousPad || previousPad.axes[axisIndex] === undefined) return 0;
    return previousPad.axes[axisIndex];
}

function getPreviousButtonValue(padIndex, buttonIndex) {
    const previousPad = controllerCaptureStart && controllerCaptureStart[padIndex];
    if (!previousPad || previousPad.buttons[buttonIndex] === undefined) return 0;
    return previousPad.buttons[buttonIndex];
}

function findControllerCaptureCandidate(binding) {
    if (!navigator.getGamepads) return null;

    const pads = navigator.getGamepads();
    const allowAxes = binding.allowedKinds.includes('axis');
    const allowButtons = binding.allowedKinds.includes('button');

    for (let padIndex = 0; padIndex < pads.length; padIndex++) {
        const gp = pads[padIndex];
        if (!gp || !gp.connected) continue;

        if (allowButtons) {
            for (let buttonIndex = 0; buttonIndex < gp.buttons.length; buttonIndex++) {
                const value = gp.buttons[buttonIndex] ? gp.buttons[buttonIndex].value : 0;
                const previous = getPreviousButtonValue(padIndex, buttonIndex);

                if (value > 0.55 && previous < 0.25) {
                    return { kind: 'button', index: buttonIndex };
                }
            }
        }

        if (allowAxes) {
            for (let axisIndex = 0; axisIndex < gp.axes.length; axisIndex++) {
                const value = gp.axes[axisIndex] || 0;
                const previous = getPreviousAxisValue(padIndex, axisIndex);

                if (Math.abs(value) > 0.55 && Math.abs(previous) < 0.25) {
                    const fullAxisControl =
                        binding.action === 'moveX' ||
                        binding.action === 'moveY' ||
                        binding.action === 'turnAxis';

                    return {
                        kind: 'axis',
                        index: axisIndex,
                        direction: fullAxisControl ? 1 : (value < 0 ? -1 : 1)
                    };
                }
            }
        }
    }

    return null;
}

function pollControllerCapture() {
    if (captureBindingId) {
        const binding = getBindingById(captureBindingId);

        if (binding && binding.type === 'controller') {
            const source = findControllerCaptureCandidate(binding);

            if (source) {
                captureBindingId = null;
                controllerCaptureStart = null;
                setControllerBindingSource(binding, source);
                saveControlBindings();
                renderControlsConfig();
            }
        }
    }

    requestAnimationFrame(pollControllerCapture);
}

export function initControlsConfig() {
    applySavedControlBindings();
    refreshBlockedKeys();
    renderControlsConfig();
    requestAnimationFrame(pollControllerCapture);

    if (dom.resetControlsButton) {
        dom.resetControlsButton.addEventListener('click', resetControlBindings);
    }

    window.addEventListener('keydown', event => {
        if (!captureBindingId) return;

        const binding = getBindingById(captureBindingId);
        if (!binding || binding.type === 'controller') return;

        event.preventDefault();
        event.stopPropagation();

        if (event.code === 'Escape') {
            captureBindingId = null;
            renderControlsConfig();
            return;
        }

        captureBindingId = null;
        setBindingCode(binding, event.code);
    }, { capture: true });
}
