import {
    BALL_R,
    BAR_L,
    BUMP_L,
    BUMP_W,
    DEPOT_H,
    DEPOT_W,
    FIELD_H,
    FIELD_W,
    HUB_S,
    S,
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

    if (['hub', 'barrier', 'trench', 'towerWall'].includes(type)) {
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

export function initField() {
    state.obstacles = [];
    state.zones = [];

    addElement(156.61 * S, FIELD_H / 2 - HUB_S / 2, HUB_S, HUB_S, 'hub', 'red');
    buildLane(156.61 * S, FIELD_H / 2 - HUB_S / 2, 'red', true);
    buildLane(156.61 * S, FIELD_H / 2 - HUB_S / 2, 'red', false);
    addElement(0, TOWER_OFFSET, TOWER_DIM, TOWER_DIM, 'tower', 'red');
    addElement(TOWER_DIM - TOWER_WALL_DEPTH, TOWER_OFFSET, TOWER_WALL_DEPTH, TOWER_DIM, 'towerWall', 'red');

    addElement(FIELD_W - 156.61 * S - HUB_S, FIELD_H / 2 - HUB_S / 2, HUB_S, HUB_S, 'hub', 'blue');
    buildLane(FIELD_W - 156.61 * S - BUMP_W, FIELD_H / 2 - HUB_S / 2, 'blue', true);
    buildLane(FIELD_W - 156.61 * S - BUMP_W, FIELD_H / 2 - HUB_S / 2, 'blue', false);
    addElement(FIELD_W - TOWER_DIM, FIELD_H - TOWER_OFFSET - TOWER_DIM, TOWER_DIM, TOWER_DIM, 'tower', 'blue');
    addElement(FIELD_W - TOWER_DIM, FIELD_H - TOWER_OFFSET - TOWER_DIM, TOWER_WALL_DEPTH, TOWER_DIM, 'towerWall', 'blue');

    const redDepotY = 82.32 * S - DEPOT_H / 2;
    const blueDepotY = FIELD_H - 82.32 * S - DEPOT_H / 2;
    addElement(0, redDepotY, DEPOT_W, DEPOT_H, 'depot', 'red');
    addElement(FIELD_W - DEPOT_W, blueDepotY, DEPOT_W, DEPOT_H, 'depot', 'blue');
}

export function spawnBalls() {
    state.balls = [];

    const sx = FIELD_W / 2 - (12 * BALL_R * 2) / 2 + BALL_R;
    const sy = FIELD_H / 2 - (30 * BALL_R * 2) / 2 + BALL_R;

    for (let r = 0; r < 30; r++) {
        if (r >= 14 && r <= 15) continue;

        for (let c = 0; c < 12; c++) {
            state.balls.push({
                x: sx + c * BALL_R * 2,
                y: sy + r * BALL_R * 2,
                r: BALL_R,
                vx: 0,
                vy: 0,
                isStatic: true,
                frictionMod: 1.0,
                wasOnBump: false,
                owner: null
            });
        }
    }

    const redDepotY = 82.32 * S - DEPOT_H / 2;
    const blueDepotY = FIELD_H - 82.32 * S - DEPOT_H / 2;
    const blueDepotX = FIELD_W - DEPOT_W;
    const xStep = DEPOT_W / 4;
    const yStep = DEPOT_H / 6;

    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 4; c++) {
            state.balls.push({
                x: c * xStep + xStep / 2,
                y: redDepotY + r * yStep + yStep / 2,
                r: BALL_R,
                vx: 0,
                vy: 0,
                isStatic: true,
                frictionMod: 1.0,
                wasOnBump: false,
                owner: null
            });

            state.balls.push({
                x: blueDepotX + c * xStep + xStep / 2,
                y: blueDepotY + r * yStep + yStep / 2,
                r: BALL_R,
                vx: 0,
                vy: 0,
                isStatic: true,
                frictionMod: 1.0,
                wasOnBump: false,
                owner: null
            });
        }
    }
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
        y = FIELD_H / 2 - HUB_S / 2 - BUMP_L - BAR_L - TRENCH_L / 2 - 17.5;
    } else if (state.p1StartIdx === 2) {
        x = 156.61 * S - 20;
        y = FIELD_H / 2 + HUB_S / 2 + BUMP_L + BAR_L + TRENCH_L / 2 - 17.5;
    }

    return { x, y, a: 0 };
}

export function getBlueStartPos() {
    if (state.sameTeamMode) {
        let x = 156.61 * S - 45;
        let y = FIELD_H / 2 + 20;

        if (state.p2StartIdx === 1) {
            x = 156.61 * S - 20;
            y = FIELD_H / 2 - HUB_S / 2 - BUMP_L - BAR_L - TRENCH_L / 2 + 20;
        }

        if (state.p2StartIdx === 2) {
            x = 156.61 * S - 20;
            y = FIELD_H / 2 + HUB_S / 2 + BUMP_L + BAR_L + TRENCH_L / 2 + 20;
        }

        return { x, y, a: 0 };
    }

    let x = FIELD_W - 156.61 * S + 10;
    let y = FIELD_H / 2 - 17.5;

    if (state.p2StartIdx === 1) {
        x = FIELD_W - 156.61 * S - 15;
        y = FIELD_H / 2 - HUB_S / 2 - BUMP_L - BAR_L - TRENCH_L / 2 - 17.5;
    } else if (state.p2StartIdx === 2) {
        x = FIELD_W - 156.61 * S - 15;
        y = FIELD_H / 2 + HUB_S / 2 + BUMP_L + BAR_L + TRENCH_L / 2 - 17.5;
    }

    return { x, y, a: Math.PI };
}

export function resetBots() {
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
