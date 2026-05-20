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
    OUTPOST_FUEL_COLUMNS,
    OUTPOST_FUEL_ROWS,
    OUTPOST_H,
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
}

function addElement(x, y, w, h, type, side) {
    const el = { x, y, w, h, type, side };

    if (['hub', 'barrier', 'trench', 'towerWall', 'outpost'].includes(type)) {
        state.obstacles.push(el);
    }

    state.zones.push(el);
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
    const width = (columns - 1) * BALL_R * 2;
    const height = (rows - 1) * BALL_R * 2;
    spawnFuelGrid(centerX - width / 2, centerY - height / 2, columns, rows);
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
    addElement(0, getRedOutpostY(), OUTPOST_W, OUTPOST_H, 'outpost', 'red');

    const blueHubX = FIELD_W - 156.61 * S - HUB_S;
    addElement(blueHubX, hubY, HUB_S, HUB_S, 'hub', 'blue');
    buildLane(FIELD_W - 156.61 * S - BUMP_W, hubY, 'blue', true);
    buildLane(FIELD_W - 156.61 * S - BUMP_W, hubY, 'blue', false);
    addElement(FIELD_W - TOWER_DIM, FIELD_H - TOWER_OFFSET - TOWER_DIM, TOWER_DIM, TOWER_DIM, 'tower', 'blue');
    addElement(FIELD_W - TOWER_DIM, FIELD_H - TOWER_OFFSET - TOWER_DIM, TOWER_WALL_DEPTH, TOWER_DIM, 'towerWall', 'blue');
    addElement(FIELD_W - OUTPOST_W, getBlueOutpostY(), OUTPOST_W, OUTPOST_H, 'outpost', 'blue');

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

    const outpostFuelWidth = (OUTPOST_FUEL_COLUMNS - 1) * BALL_R * 2;
    const outpostFuelGap = BALL_R * 2;

    spawnCenteredFuelGrid(
        OUTPOST_W + outpostFuelGap + outpostFuelWidth / 2,
        getRedOutpostY() + OUTPOST_H / 2,
        OUTPOST_FUEL_COLUMNS,
        OUTPOST_FUEL_ROWS
    );

    spawnCenteredFuelGrid(
        FIELD_W - OUTPOST_W - outpostFuelGap - outpostFuelWidth / 2,
        getBlueOutpostY() + OUTPOST_H / 2,
        OUTPOST_FUEL_COLUMNS,
        OUTPOST_FUEL_ROWS
    );
}

export function createRobots() {
    state.botRed = new Robot(80, FIELD_H / 2 - 14, 'turret', 0);
    state.botBlue = new Robot(FIELD_W - 115, FIELD_H / 2 - 14, 'double turret', Math.PI);
}

export function getRedStartPos() {
    let x = 156.61 * S - 45;
    let y = FIELD_H / 2 - 17.5;

    if (state.p1StartIdx === 1) {
        x = 156.61 * S - 20;
        y = getTopTrenchCenterY() - 17.5;
    } else if (state.p1StartIdx === 2) {
        x = 156.61 * S - 20;
        y = getBottomTrenchCenterY() - 17.5;
    }

    return { x, y, a: 0 };
}

export function getBlueStartPos() {
    if (state.sameTeamMode) {
        let x = 156.61 * S - 45;
        let y = FIELD_H / 2 + 20;

        if (state.p2StartIdx === 1) {
            x = 156.61 * S - 20;
            y = getTopTrenchCenterY() + 20;
        }

        if (state.p2StartIdx === 2) {
            x = 156.61 * S - 20;
            y = getBottomTrenchCenterY() + 20;
        }

        return { x, y, a: 0 };
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
