import { WALL_VISUAL } from './constants.js';
import { dom } from './dom.js';
import { state } from './state.js';

const mobileInput = {
    x: 0,
    y: 0,
    rot: 0,
    act: false,
    toggleIn: false
};

let overlay = null;
let moveStick = null;
let moveKnob = null;
let rotStick = null;
let rotKnob = null;
let shootButton = null;
let intakeToggleButton = null;
let pendingOutpostToggleSide = null;
let tapCandidate = null;

const activePointers = {
    move: null,
    rot: null
};

const JOYSTICK_RADIUS = 58;
const TAP_MAX_DISTANCE = 10;
const TAP_MAX_MS = 280;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function resetMobileInput() {
    mobileInput.x = 0;
    mobileInput.y = 0;
    mobileInput.rot = 0;
    mobileInput.act = false;
    mobileInput.toggleIn = false;

    activePointers.move = null;
    activePointers.rot = null;
    tapCandidate = null;

    if (moveStick && moveKnob) {
        moveStick.classList.remove('active');
        moveKnob.style.transform = 'translate(-50%, -50%)';
    }

    if (rotStick && rotKnob) {
        rotStick.classList.remove('active');
        rotKnob.style.transform = 'translate(-50%, -50%)';
    }
}

function setStickPosition(stick, x, y) {
    stick.style.left = `${x}px`;
    stick.style.top = `${y}px`;
    stick.classList.add('active');
}

function updateStickKnob(knob, dx, dy) {
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function updateMoveStick(event) {
    const pointer = activePointers.move;
    if (!pointer) return;

    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    const dist = Math.hypot(dx, dy);
    const scale = dist > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / dist : 1;
    const knobX = dx * scale;
    const knobY = dy * scale;

    mobileInput.x = clamp(knobX / JOYSTICK_RADIUS, -1, 1);
    mobileInput.y = clamp(knobY / JOYSTICK_RADIUS, -1, 1);

    updateStickKnob(moveKnob, knobX, knobY);
}

function updateRotStick(event) {
    const pointer = activePointers.rot;
    if (!pointer) return;

    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    const dist = Math.hypot(dx, dy);
    const scale = dist > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / dist : 1;
    const knobX = dx * scale;
    const knobY = dy * scale;

    mobileInput.rot = clamp(knobX / JOYSTICK_RADIUS, -1, 1);

    updateStickKnob(rotKnob, knobX, knobY);
}

function getFieldPointFromClient(clientX, clientY) {
    const rect = dom.gameViewport.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
        return null;
    }

    const canvasX = (clientX - rect.left) * (dom.canvas.width / rect.width);
    const canvasY = (clientY - rect.top) * (dom.canvas.height / rect.height);

    return {
        x: canvasX - WALL_VISUAL,
        y: canvasY - WALL_VISUAL
    };
}

function getTappedOutpostSide(clientX, clientY) {
    const point = getFieldPointFromClient(clientX, clientY);

    if (!point) {
        return null;
    }

    const outpost = state.zones.find(zone => {
        if (zone.type !== 'outpost') {
            return false;
        }

        return point.x >= zone.x &&
            point.x <= zone.x + zone.w &&
            point.y >= zone.y &&
            point.y <= zone.y + zone.h;
    });

    return outpost?.side || null;
}

function maybeQueueOutpostTap(event) {
    if (!tapCandidate || tapCandidate.id !== event.pointerId) {
        return;
    }

    const moveDistance = Math.hypot(
        event.clientX - tapCandidate.startX,
        event.clientY - tapCandidate.startY
    );

    const elapsed = Date.now() - tapCandidate.startTime;
    const wasTap = moveDistance <= TAP_MAX_DISTANCE && elapsed <= TAP_MAX_MS;

    if (wasTap) {
        pendingOutpostToggleSide = getTappedOutpostSide(event.clientX, event.clientY);
    }

    tapCandidate = null;
}

function handleOverlayPointerDown(event) {
    if (!state.mobileControlsEnabled || event.target.closest('.mobile-action-button')) {
        return;
    }

    event.preventDefault();

    const rect = overlay.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    tapCandidate = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTime: Date.now()
    };

    if (localX < rect.width * 0.5) {
        activePointers.move = {
            id: event.pointerId,
            startX: event.clientX,
            startY: event.clientY
        };

        setStickPosition(moveStick, localX, localY);
        updateMoveStick(event);
        overlay.setPointerCapture(event.pointerId);
        return;
    }

    activePointers.rot = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY
    };

    setStickPosition(rotStick, localX, localY);
    updateRotStick(event);
    overlay.setPointerCapture(event.pointerId);
}

function handleOverlayPointerMove(event) {
    if (activePointers.move?.id === event.pointerId) {
        event.preventDefault();
        updateMoveStick(event);
        return;
    }

    if (activePointers.rot?.id === event.pointerId) {
        event.preventDefault();
        updateRotStick(event);
    }
}

function handleOverlayPointerEnd(event) {
    maybeQueueOutpostTap(event);

    if (activePointers.move?.id === event.pointerId) {
        activePointers.move = null;
        mobileInput.x = 0;
        mobileInput.y = 0;
        moveStick.classList.remove('active');
        moveKnob.style.transform = 'translate(-50%, -50%)';
    }

    if (activePointers.rot?.id === event.pointerId) {
        activePointers.rot = null;
        mobileInput.rot = 0;
        rotStick.classList.remove('active');
        rotKnob.style.transform = 'translate(-50%, -50%)';
    }
}

function makeJoystick(className) {
    const stick = document.createElement('div');
    stick.className = `mobile-joystick ${className}`;

    const knob = document.createElement('div');
    knob.className = 'mobile-joystick-knob';

    stick.appendChild(knob);

    return { stick, knob };
}

function updateMobileRobotButtons() {
    if (!intakeToggleButton) return;

    const showIntakeToggle = state.botRed?.name === 'Blitz';
    intakeToggleButton.classList.toggle('mobile-hidden', !showIntakeToggle);
}

export function consumeMobileOutpostToggleSide() {
    const side = pendingOutpostToggleSide;
    pendingOutpostToggleSide = null;
    return side;
}

export function setMobileControlsEnabled(enabled) {
    state.mobileControlsEnabled = Boolean(enabled);

    document.body.classList.toggle('mobile-controls-enabled', state.mobileControlsEnabled);

    if (dom.mobileControlsToggle) {
        dom.mobileControlsToggle.innerText = state.mobileControlsEnabled
            ? '📱 MOBILE CONTROLS: ON'
            : '📱 MOBILE CONTROLS: OFF';

        dom.mobileControlsToggle.classList.toggle('mobile-enabled', state.mobileControlsEnabled);
        dom.mobileControlsToggle.classList.toggle('mobile-controls-off', !state.mobileControlsEnabled);
    }

    if (overlay) {
        overlay.classList.toggle('hidden', !state.mobileControlsEnabled);
    }

    if (!state.mobileControlsEnabled) {
        resetMobileInput();
    }

    updateMobileRobotButtons();
}

export function getMobileInputs() {
    updateMobileRobotButtons();

    if (!state.mobileControlsEnabled) {
        return { x: 0, y: 0, rot: 0, act: false, toggleIn: false };
    }

    return {
        x: mobileInput.x,
        y: mobileInput.y,
        rot: mobileInput.rot,
        act: mobileInput.act,
        toggleIn: mobileInput.toggleIn
    };
}

export function initMobileControls() {
    overlay = document.createElement('div');
    overlay.id = 'mobile-controls-overlay';
    overlay.className = 'mobile-controls-overlay hidden';

    const move = makeJoystick('mobile-move-stick');
    moveStick = move.stick;
    moveKnob = move.knob;

    const rot = makeJoystick('mobile-rot-stick');
    rotStick = rot.stick;
    rotKnob = rot.knob;

    shootButton = document.createElement('button');
    shootButton.id = 'mobile-shoot-button';
    shootButton.className = 'mobile-action-button';
    shootButton.type = 'button';
    shootButton.innerText = 'SHOOT';

    intakeToggleButton = document.createElement('button');
    intakeToggleButton.id = 'mobile-intake-toggle-button';
    intakeToggleButton.className = 'mobile-action-button mobile-hidden';
    intakeToggleButton.type = 'button';
    intakeToggleButton.innerText = 'SWAP INTAKE';

    overlay.appendChild(moveStick);
    overlay.appendChild(rotStick);
    overlay.appendChild(shootButton);
    overlay.appendChild(intakeToggleButton);
    dom.gameViewport.appendChild(overlay);

    overlay.addEventListener('pointerdown', handleOverlayPointerDown, { passive: false });
    overlay.addEventListener('pointermove', handleOverlayPointerMove, { passive: false });
    overlay.addEventListener('pointerup', handleOverlayPointerEnd, { passive: false });
    overlay.addEventListener('pointercancel', handleOverlayPointerEnd, { passive: false });

    shootButton.addEventListener('pointerdown', event => {
        event.preventDefault();
        mobileInput.act = true;
    }, { passive: false });

    shootButton.addEventListener('pointerup', () => {
        mobileInput.act = false;
    });

    shootButton.addEventListener('pointercancel', () => {
        mobileInput.act = false;
    });

    shootButton.addEventListener('pointerleave', () => {
        mobileInput.act = false;
    });

    intakeToggleButton.addEventListener('pointerdown', event => {
        event.preventDefault();
        mobileInput.toggleIn = true;
    }, { passive: false });

    intakeToggleButton.addEventListener('pointerup', () => {
        mobileInput.toggleIn = false;
    });

    intakeToggleButton.addEventListener('pointercancel', () => {
        mobileInput.toggleIn = false;
    });

    intakeToggleButton.addEventListener('pointerleave', () => {
        mobileInput.toggleIn = false;
    });

    setMobileControlsEnabled(state.mobileControlsEnabled);
}