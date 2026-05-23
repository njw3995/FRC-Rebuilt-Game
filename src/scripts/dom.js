export const dom = {
    gameViewport: document.getElementById('game-viewport'),
    gameShell: document.getElementById('game-shell'),
    canvas: document.getElementById('field'),
    mainHud: document.getElementById('main-hud'),
    shiftFlash: document.getElementById('shift-flash'),
    controlsModal: document.getElementById('controls-modal'),
    controlsConfigContent: document.getElementById('controls-config-content'),
    controlsWrapper: document.querySelector('.controls-wrapper'),
    controlPanel: document.getElementById('control-panel'),

    scoreRedDisplay: document.getElementById('scoreRedDisplay'),
    scoreBlueDisplay: document.getElementById('scoreBlueDisplay'),
    heldRed: document.getElementById('heldRed'),
    heldBlue: document.getElementById('heldBlue'),

    matchClock: document.getElementById('match-clock'),
    phaseLabel: document.getElementById('phase-label'),
    phaseTimer: document.getElementById('phase-timer'),
    autoWinner: document.getElementById('auto-winner'),

    hubRed: document.getElementById('hub-red'),
    hubBlue: document.getElementById('hub-blue'),
    hubRedText: document.getElementById('hub-red-txt'),
    hubBlueText: document.getElementById('hub-blue-txt'),

    toggleControlsButton: document.getElementById('toggle-controls-btn'),
    showControlsButton: document.getElementById('show-controls-btn'),
    mobileControlsToggle: document.getElementById('mobile-controls-toggle'),
    closeControlsButton: document.getElementById('close-controls-btn'),
    resetControlsButton: document.getElementById('reset-controls-btn'),


    startButton: document.getElementById('start-btn'),
    resetButton: document.getElementById('reset-btn'),
    teamModeToggle: document.getElementById('team-mode-toggle'),
    redHumanToggle: document.getElementById('red-human-toggle'),
    blueHumanToggle: document.getElementById('blue-human-toggle'),

    botRedToggle: document.getElementById('bot-red-toggle'),
    botBlueToggle: document.getElementById('bot-blue-toggle'),

    p1InputToggle: document.getElementById('p1-input-toggle'),
    p2InputToggle: document.getElementById('p2-input-toggle'),
    p1StartToggle: document.getElementById('p1-start-toggle'),
    p2StartToggle: document.getElementById('p2-start-toggle'),
    p1Unstick: document.getElementById('p1-unstick'),
    p2Unstick: document.getElementById('p2-unstick'),
    p2Toggle: document.getElementById('p2-toggle')
};

export const ctx = dom.canvas.getContext('2d');
