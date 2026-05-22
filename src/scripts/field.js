import {
    BALL_R,
    BAR_L,
    BUMP_L,
    BUMP_W,
    DEPOT_FUEL_COLUMNS,
    DEPOT_FUEL_ROWS,
    DEPOT_H,
    DEPOT_W,
    FIELD_H,
    FIELD_W,
    HUB_S,
    NEUTRAL_FUEL_COLUMNS,
    NEUTRAL_FUEL_ROWS,
    OUTPOST_FEEDER_MAX_FUEL,
    OUTPOST_H,
    OUTPOST_HUMAN_PLAYERS,
    OUTPOST_MAX_FUEL,
    OUTPOST_STARTING_FUEL,
    OUTPOST_W,
    S,
    STARTING_FUEL,
    TOWER_DIM,
    TOWER_OFFSET,
    TOWER_WALL_DEPTH,
    TRENCH_L,
    WALL_VISUAL
} from './constants.js';
import { dom } from './dom.js';
import { state } from './state.js';
import { Robot } from './robot.js';

export function configureCanvas() {
    dom.canvas.width = FIELD_W + WALL_VISUAL * 2;
    dom.canvas.height = FIELD_H + WALL_VISUAL * 2;

    dom.gameShell.style.width = `${dom.canvas.width}px`;
    dom.gameShell.style.height = `${dom.canvas.height}px`;

    resizeGameDisplay();
}

export function resizeGameDisplay() {
    if (!dom.canvas || !dom.gameViewport || !dom.gameShell) {
        return;
    }

    const naturalWidth = dom.canvas.width;
    const naturalHeight = dom.canvas.height;

    if (naturalWidth <= 0 || naturalHeight <= 0) {
        return;
    }

    const controlsCollapsed =
        dom.controlPanel &&
        dom.controlPanel.classList.contains('collapsed');

    const controlsRect = dom.controlsWrapper
        ? dom.controlsWrapper.getBoundingClientRect()
        : { width: 0, height: 0 };

    const horizontalPadding = window.innerWidth < 700 ? 8 : 32;
    const verticalPadding = window.innerHeight < 700 ? 8 : 32;
    const layoutGap = 16;

    const reservedWidth = controlsCollapsed
        ? 0
        : Math.ceil(controlsRect.width + layoutGap);

    const reservedHeight = controlsCollapsed
        ? Math.ceil(controlsRect.height + layoutGap)
        : 0;

    const availableWidth = Math.max(
        1,
        window.innerWidth - reservedWidth - horizontalPadding
    );

    const availableHeight = Math.max(
        1,
        window.innerHeight - reservedHeight - verticalPadding
    );

    const rawScale = Math.min(
        availableWidth / naturalWidth,
        availableHeight / naturalHeight
    );

    const scale = Math.max(0.01, Math.round(rawScale * 1000) / 1000);

    const displayWidth = Math.round(naturalWidth * scale);
    const displayHeight = Math.round(naturalHeight * scale);

    dom.gameViewport.style.width = `${displayWidth}px`;
    dom.gameViewport.style.height = `${displayHeight}px`;
    dom.gameViewport.style.marginRight = '0';

    dom.gameShell.style.transform = `scale(${scale})`;
}

export function scheduleGameResize() {
    resizeGameDisplay();

    requestAnimationFrame(() => {
        resizeGameDisplay();
    });

    setTimeout(() => {
        resizeGameDisplay();
    }, 80);

    setTimeout(() => {
        resizeGameDisplay();
    }, 250);
}

function addElement(x, y, w, h, type, side) {
    const el = { x, y, w, h, type, side };

    if (['hub', 'barrier', 'trench', 'towerWall'].includes(type)) {
        state.obstacles.push(el);
    }

    state.zones.push(el);
    return el;
}

function buildLane(x, hubY, side, isTop) {
    const bumpY = isTop ? hubY - BUMP_L : hubY + HUB_S;
    addElement(x, bumpY, BUMP_W, BUMP_L, 'bump', side);

    const barY = isTop ? bumpY - BAR_L : bumpY + BUMP_L;
    addElement(x, barY, BUMP_W, BAR_L, 'barrier', side);

    addElement(
        x + BUMP_W / 2 - 15 * S,
        isTop ? barY - TRENCH_L : barY + BAR_L,
        30 * S,
        TRENCH_L,
        'trench',
        side
    );
}

function getTopTrenchCenterY() {
    return FIELD_H / 2 - HUB_S / 2 - BUMP_L - BAR_L - TRENCH_L / 2;
}

function getBottomTrenchCenterY() {
    return FIELD_H / 2 + HUB_S / 2 + BUMP_L + BAR_L + TRENCH_L / 2;
}

function getRedDepotY() {
    return 82.32 * S - DEPOT_H / 2;
}

function getBlueDepotY() {
    return FIELD_H - 82.32 * S - DEPOT_H / 2;
}

export function getOutpostZone(side) {
    return state.zones.find(z => z.type === 'outpost' && z.side === side) || null;
}

function getRedOutpostY() {
    return getBottomTrenchCenterY() - OUTPOST_H / 2;
}

function getBlueOutpostY() {
    return getTopTrenchCenterY() - OUTPOST_H / 2;
}

function createFuelBall(x, y) {
    return {
        x,
        y,
        r: BALL_R,
        vx: 0,
        vy: 0,
        isStatic: true,
        frictionMod: 1.0,
        wasOnBump: false,
        owner: null
    };
}

function spawnFuelGrid(x, y, columns, rows) {
    const spacing = BALL_R * 2;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
            state.balls.push(createFuelBall(x + col * spacing, y + row * spacing));
        }
    }
}

function spawnCenteredFuelGrid(centerX, centerY, columns, rows) {
    const spacing = BALL_R * 2;
    const topRows = Math.floor(rows / 2);
    const bottomRows = rows - topRows;

    const width = (columns - 1) * spacing;
    const startX = centerX - width / 2;

    const topStartY = centerY - spacing * topRows;
    const bottomStartY = centerY + spacing;

    spawnFuelGrid(startX, topStartY, columns, topRows);
    spawnFuelGrid(startX, bottomStartY, columns, bottomRows);
}

function createOutpostState(side) {
    return {
        side,
        reserveFuel: 0,
        feederFuel: OUTPOST_STARTING_FUEL,
        feedAccumulator: 0,
        refillAccumulator: 0,
        humanNextThrowTimes: Array.from({ length: OUTPOST_HUMAN_PLAYERS }, () => 0.1 + Math.random() * 0.4)
    };
}

export function resetOutposts() {
    state.outposts.red = createOutpostState('red');
    state.outposts.blue = createOutpostState('blue');
}

export function getOutpostTotalFuel(side) {
    const outpost = state.outposts[side];
    if (!outpost) return 0;
    return outpost.reserveFuel + outpost.feederFuel;
}

export function canAddFuelToOutpost(side) {
    return getOutpostTotalFuel(side) < OUTPOST_MAX_FUEL;
}

export function addFuelToOutpost(side, amount = 1) {
    const outpost = state.outposts[side];
    if (!outpost) return 0;

    let added = 0;

    while (added < amount && getOutpostTotalFuel(side) < OUTPOST_MAX_FUEL) {
        outpost.reserveFuel++;
        added++;
    }

    return added;
}

export function takeFuelFromOutpostForHuman(side) {
    const outpost = state.outposts[side];
    if (!outpost) return false;

    if (outpost.reserveFuel > 0) {
        outpost.reserveFuel--;
        return true;
    }

    if (outpost.feederFuel > 0) {
        outpost.feederFuel--;
        return true;
    }

    return false;
}

export function initField() {
    state.obstacles = [];
    state.zones = [];

    const redHubX = 156.61 * S;
    const hubY = FIELD_H / 2 - HUB_S / 2;

    addElement(redHubX, hubY, HUB_S, HUB_S, 'hub', 'red');
    buildLane(redHubX, hubY, 'red', true);
    buildLane(redHubX, hubY, 'red', false);
    addElement(0, TOWER_OFFSET, TOWER_DIM, TOWER_DIM, 'tower', 'red');
    addElement(TOWER_DIM - TOWER_WALL_DEPTH, TOWER_OFFSET, TOWER_WALL_DEPTH, TOWER_DIM, 'towerWall', 'red');
    addElement(-OUTPOST_W, getRedOutpostY(), OUTPOST_W, OUTPOST_H, 'outpost', 'red');

    const blueHubX = FIELD_W - 156.61 * S - HUB_S;
    addElement(blueHubX, hubY, HUB_S, HUB_S, 'hub', 'blue');
    buildLane(FIELD_W - 156.61 * S - BUMP_W, hubY, 'blue', true);
    buildLane(FIELD_W - 156.61 * S - BUMP_W, hubY, 'blue', false);
    addElement(FIELD_W - TOWER_DIM, FIELD_H - TOWER_OFFSET - TOWER_DIM, TOWER_DIM, TOWER_DIM, 'tower', 'blue');
    addElement(FIELD_W - TOWER_DIM, FIELD_H - TOWER_OFFSET - TOWER_DIM, TOWER_WALL_DEPTH, TOWER_DIM, 'towerWall', 'blue');
    addElement(FIELD_W, getBlueOutpostY(), OUTPOST_W, OUTPOST_H, 'outpost', 'blue');

    addElement(0, getRedDepotY(), DEPOT_W, DEPOT_H, 'depot', 'red');
    addElement(FIELD_W - DEPOT_W, getBlueDepotY(), DEPOT_W, DEPOT_H, 'depot', 'blue');
}

export function spawnBalls() {
    state.balls = [];

    spawnCenteredFuelGrid(
        FIELD_W / 2,
        FIELD_H / 2,
        NEUTRAL_FUEL_COLUMNS,
        NEUTRAL_FUEL_ROWS
    );

    const redDepotXStep = DEPOT_W / DEPOT_FUEL_COLUMNS;
    const redDepotYStep = DEPOT_H / DEPOT_FUEL_ROWS;
    const blueDepotX = FIELD_W - DEPOT_W;
    const redDepotY = getRedDepotY();
    const blueDepotY = getBlueDepotY();

    for (let row = 0; row < DEPOT_FUEL_ROWS; row++) {
        for (let col = 0; col < DEPOT_FUEL_COLUMNS; col++) {
            state.balls.push(createFuelBall(
                col * redDepotXStep + redDepotXStep / 2,
                redDepotY + row * redDepotYStep + redDepotYStep / 2
            ));

            state.balls.push(createFuelBall(
                blueDepotX + col * redDepotXStep + redDepotXStep / 2,
                blueDepotY + row * redDepotYStep + redDepotYStep / 2
            ));
        }
    }
}

export function createRobots() {
    state.botRed = new Robot(80, FIELD_H / 2 - 14, 'turret', 0);
    state.botBlue = new Robot(FIELD_W - 115, FIELD_H / 2 - 14, 'double turret', Math.PI);
}

function getRedSideStartPosForIndex(startIdx) {
    let x = 156.61 * S - 45;
    let y = FIELD_H / 2 - 17.5;

    if (startIdx === 1) {
        x = 156.61 * S - 20;
        y = getTopTrenchCenterY() - 17.5;
    } else if (startIdx === 2) {
        x = 156.61 * S - 20;
        y = getBottomTrenchCenterY() - 17.5;
    }

    return { x, y, a: 0 };
}

export function getRedStartPos() {
    return getRedSideStartPosForIndex(state.p1StartIdx);
}

export function getBlueStartPos() {
    if (state.sameTeamMode) {
        if (state.p1StartIdx === state.p2StartIdx) {
            const p1Start = getRedStartPos();

            return {
                x: Math.max(0, p1Start.x - 45),
                y: p1Start.y,
                a: p1Start.a
            };
        }

        return getRedSideStartPosForIndex(state.p2StartIdx);
    }

    let x = FIELD_W - 156.61 * S + 10;
    let y = FIELD_H / 2 - 17.5;

    if (state.p2StartIdx === 1) {
        x = FIELD_W - 156.61 * S - 15;
        y = getTopTrenchCenterY() - 17.5;
    } else if (state.p2StartIdx === 2) {
        x = FIELD_W - 156.61 * S - 15;
        y = getBottomTrenchCenterY() - 17.5;
    }

    return { x, y, a: Math.PI };
}

export function resetBots() {
    state.botRed.inventory = STARTING_FUEL;
    state.botBlue.inventory = STARTING_FUEL;
    dom.heldRed.innerText = state.botRed.inventory;
    dom.heldBlue.innerText = state.botBlue.inventory;
    dom.heldRed.classList.remove('warning');
    dom.heldBlue.classList.remove('warning');

    const rPos = getRedStartPos();
    state.botRed.x = rPos.x;
    state.botRed.y = rPos.y;
    state.botRed.vx = 0;
    state.botRed.vy = 0;
    state.botRed.vAngle = 0;
    state.botRed.angle = rPos.a;
    state.botRed.prevIntakeInput = false;
    state.botRed.intakeSide = 'right';

    if (state.p2Enabled) {
        const bPos = getBlueStartPos();
        state.botBlue.x = bPos.x;
        state.botBlue.y = bPos.y;
        state.botBlue.angle = bPos.a;
        state.botBlue.vx = 0;
        state.botBlue.vy = 0;
        state.botBlue.vAngle = 0;
        state.botBlue.prevIntakeInput = false;
        state.botBlue.intakeSide = 'right';
    }

    state.p1UnstickUsed = false;
    state.p2UnstickUsed = false;
    state.p1FreezeUntil = 0;
    state.p2FreezeUntil = 0;

    dom.p1Unstick.classList.add('disabled');
    dom.p2Unstick.classList.add('disabled');

    if (state.matchRunning && !state.p1UnstickUsed) {
        dom.p1Unstick.classList.remove('disabled');
    }

    if (state.matchRunning && state.p2Enabled && !state.p2UnstickUsed) {
        dom.p2Unstick.classList.remove('disabled');
    }
}
