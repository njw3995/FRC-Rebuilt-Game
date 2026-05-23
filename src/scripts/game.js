import {
    BALL_R,
    FIELD_H,
    FIELD_W,
    FRAME_RATE,
    HUB_S,
    MATCH_PHASES,
    OUTPOST_FEEDER_MAX_FUEL,
    OUTPOST_FEEDER_REFILL_RATE,
    OUTPOST_HUMAN_MAX_RATE,
    OUTPOST_HUMAN_MIN_RATE,
    OUTPOST_HUMAN_SHOOT_STOP_LEAD_TIME,
    OUTPOST_ROBOT_FEED_RATE,
    TRENCH_FUEL_LIMIT,
    WALL_VISUAL
} from './constants.js';
import { ctx } from './dom.js';
import { dom } from './dom.js';
import { state } from './state.js';
import { getInputs, assignGamepads, isControllerControlPressed } from './input.js';
import { isHubActiveAt, isHubScoringAllowedAt, tickMatch, updateHudBar } from './match.js';
import { circleRectCollision, rectRect, resolveBallCollision } from './math.js';
import { toggleHumanPlayerShooting } from './ui.js';
import {
    addFuelToOutpost,
    canAddFuelToOutpost,
    getOutpostTotalFuel,
    getOutpostZone,
    takeFuelFromOutpostForHuman
} from './field.js';
import { consumeMobileOutpostToggleSide } from './mobileControls.js';

function applyUnstickFreeze(now, playerState, freezeUntil) {
    if (now >= freezeUntil) return playerState;
    return { x: 0, y: 0, rot: 0, act: false, toggleIn: false };
}

function updateControllerOutpostToggles() {
    const p1Pressed = isControllerControlPressed('p1', 'outpost');
    if (p1Pressed && !state.outpostControllerTogglePressed.p1) {
        toggleHumanPlayerShooting('red');
    }
    state.outpostControllerTogglePressed.p1 = p1Pressed;

    const p2Pressed = state.p2Enabled && isControllerControlPressed('p2', 'outpost');
    if (p2Pressed && !state.outpostControllerTogglePressed.p2) {
        toggleHumanPlayerShooting(state.sameTeamMode ? 'red' : 'blue');
    }
    state.outpostControllerTogglePressed.p2 = p2Pressed;
    const mobileOutpostSide = consumeMobileOutpostToggleSide();

    if (mobileOutpostSide) {
        toggleHumanPlayerShooting(state.sameTeamMode ? 'red' : mobileOutpostSide);
    }
}

function robotFitsInTrench(bot) {
    return bot.inventory < TRENCH_FUEL_LIMIT;
}

function robotCanOccupy(bot, x, y) {
    if (x < 0 || y < 0 || x + bot.model.w > FIELD_W || y + bot.model.h > FIELD_H) {
        return false;
    }

    return !state.obstacles.some(o => {
        if (o.type === 'trench' && robotFitsInTrench(bot)) return false;
        return rectRect(x, y, bot.model.w, bot.model.h, o);
    });
}

function tryMoveRobotForCollision(bot, dx, dy) {
    const targetX = bot.x + dx;
    const targetY = bot.y + dy;

    if (robotCanOccupy(bot, targetX, targetY)) {
        bot.x = targetX;
        bot.y = targetY;
        return true;
    }

    let moved = false;

    if (dx !== 0 && robotCanOccupy(bot, targetX, bot.y)) {
        bot.x = targetX;
        moved = true;
    } else if (dx !== 0) {
        bot.vx = 0;
    }

    if (dy !== 0 && robotCanOccupy(bot, bot.x, targetY)) {
        bot.y = targetY;
        moved = true;
    } else if (dy !== 0) {
        bot.vy = 0;
    }

    return moved;
}

function resolveRobotCollision() {
    const botRed = state.botRed;
    const botBlue = state.botBlue;

    if (!rectRect(botRed.x, botRed.y, botRed.model.w, botRed.model.h, {
        x: botBlue.x,
        y: botBlue.y,
        w: botBlue.model.w,
        h: botBlue.model.h
    })) {
        return false;
    }

    const redCx = botRed.x + botRed.model.w / 2;
    const redCy = botRed.y + botRed.model.h / 2;
    const blueCx = botBlue.x + botBlue.model.w / 2;
    const blueCy = botBlue.y + botBlue.model.h / 2;
    const dx = redCx - blueCx;
    const dy = redCy - blueCy;
    const overlapX = (botRed.model.w + botBlue.model.w) / 2 - Math.abs(dx);
    const overlapY = (botRed.model.h + botBlue.model.h) / 2 - Math.abs(dy);

    if (overlapX <= 0 || overlapY <= 0) {
        return false;
    }

    const sx = dx >= 0 ? 1 : -1;
    const sy = dy >= 0 ? 1 : -1;
    const primaryAxis = overlapX <= overlapY ? 'x' : 'y';
    const secondaryAxis = primaryAxis === 'x' ? 'y' : 'x';

    function resolveAlongAxis(axis) {
        const amount = (axis === 'x' ? overlapX : overlapY) + 0.35;
        const redDx = axis === 'x' ? sx * amount : 0;
        const redDy = axis === 'y' ? sy * amount : 0;
        const blueDx = -redDx;
        const blueDy = -redDy;
        const redHalfDx = redDx * 0.5;
        const redHalfDy = redDy * 0.5;
        const blueHalfDx = blueDx * 0.5;
        const blueHalfDy = blueDy * 0.5;
        const redCanMoveHalf = robotCanOccupy(botRed, botRed.x + redHalfDx, botRed.y + redHalfDy);
        const blueCanMoveHalf = robotCanOccupy(botBlue, botBlue.x + blueHalfDx, botBlue.y + blueHalfDy);

        let moved = false;

        if (redCanMoveHalf && blueCanMoveHalf) {
            botRed.x += redHalfDx;
            botRed.y += redHalfDy;
            botBlue.x += blueHalfDx;
            botBlue.y += blueHalfDy;
            moved = true;
        } else if (robotCanOccupy(botRed, botRed.x + redDx, botRed.y + redDy)) {
            botRed.x += redDx;
            botRed.y += redDy;
            moved = true;
        } else if (robotCanOccupy(botBlue, botBlue.x + blueDx, botBlue.y + blueDy)) {
            botBlue.x += blueDx;
            botBlue.y += blueDy;
            moved = true;
        }

        if (!moved) return false;

        if (axis === 'x') {
            botRed.vx = Math.max(0, botRed.vx * sx) * sx;
            botBlue.vx = Math.max(0, botBlue.vx * -sx) * -sx;
        } else {
            botRed.vy = Math.max(0, botRed.vy * sy) * sy;
            botBlue.vy = Math.max(0, botBlue.vy * -sy) * -sy;
        }

        botRed.vx *= 0.65;
        botRed.vy *= 0.65;
        botBlue.vx *= 0.65;
        botBlue.vy *= 0.65;
        return true;
    }

    if (resolveAlongAxis(primaryAxis)) return true;
    return resolveAlongAxis(secondaryAxis);
}

function resolveRobotCollisions() {
    for (let i = 0; i < 8; i++) {
        if (!resolveRobotCollision()) break;
    }
}

function updateScoringBalls(now) {
    const exitPortOffsets = [-0.34, -0.12, 0.12, 0.34];

    state.scoringBalls = state.scoringBalls.filter(sb => {
        if (now < sb.exitTime) return true;

        const dir = sb.side === 'red' ? 1 : -1;
        const portOffset = exitPortOffsets[Math.floor(Math.random() * exitPortOffsets.length)];

        const exitX = sb.side === 'red'
            ? sb.hubX + HUB_S + BALL_R + 2
            : sb.hubX - BALL_R - 2;

        const exitY = sb.hubY + HUB_S / 2 + portOffset * HUB_S + (Math.random() - 0.5) * BALL_R * 0.8;

        const targetX = exitX + (FIELD_W / 2 - exitX) * 0.65;
        const targetY = exitY + (Math.random() - 0.5) * HUB_S * 1.35;

        const baseAngle = Math.atan2(targetY - exitY, targetX - exitX);
        const exitAngle = baseAngle + (Math.random() - 0.5) * 0.26;
        const exitSpeed = 2.75 + Math.random() * 1.35;

        state.balls.push({
            x: exitX,
            y: exitY,
            r: BALL_R,
            vx: Math.cos(exitAngle) * exitSpeed,
            vy: Math.sin(exitAngle) * exitSpeed,
            isStatic: false,
            frictionMod: 0.5,
            randomDrift: 0.018,
            rollTimer: now + 3000,
            wasOnBump: false,
            owner: sb.side
        });

        return false;
    });
}



function isHumanShootingAllowed(side) {
    if (!state.matchRunning || !state.humanShootingEnabled[side]) return false;

    return isHubActiveAt(side, state.matchElapsed) &&
        isHubActiveAt(side, state.matchElapsed + OUTPOST_HUMAN_SHOOT_STOP_LEAD_TIME);
}

function getOutpostDisplayState(side) {
    return state.humanShootingEnabled[side] ? 'SHOOT' : 'FEED';
}

function getRandomHumanThrowInterval() {
    const rate = OUTPOST_HUMAN_MIN_RATE + Math.random() * (OUTPOST_HUMAN_MAX_RATE - OUTPOST_HUMAN_MIN_RATE);
    return 1 / rate;
}

function scheduleNextHumanThrow(outpost, humanIndex) {
    outpost.humanNextThrowTimes[humanIndex] = state.matchElapsed + getRandomHumanThrowInterval();
}

function launchOutpostHumanShot(side, now) {
    const outpostZone = getOutpostZone(side);
    const hub = state.zones.find(z => z.type === 'hub' && z.side === side);

    if (!outpostZone || !hub || !takeFuelFromOutpostForHuman(side)) return;

    const launchX = side === 'red' ? BALL_R + 2 : FIELD_W - BALL_R - 2;
    const launchY = outpostZone.y + outpostZone.h / 2 + (Math.random() - 0.5) * outpostZone.h * 0.55;
    const targetX = hub.x + hub.w / 2;
    const targetY = hub.y + hub.h / 2;
    const launchAngle = Math.atan2(targetY - launchY, targetX - launchX) + (Math.random() - 0.5) * 0.16;
    const speed = 10.5 + Math.random() * 2.5;

    state.projectiles.push({
        x: launchX,
        y: launchY,
        vx: Math.cos(launchAngle) * speed,
        vy: Math.sin(launchAngle) * speed,
        r: 4,
        owner: side,
        isPass: false,
        isHumanShot: true,
        expiresAt: now + 3500
    });
}

function updateOutpostFeeder(outpost) {
    const feederTarget = Math.min(OUTPOST_FEEDER_MAX_FUEL, outpost.feederFuel + outpost.reserveFuel);

    if (outpost.reserveFuel <= 0 || outpost.feederFuel >= feederTarget) {
        outpost.refillAccumulator = 0;
        return;
    }

    outpost.refillAccumulator += OUTPOST_FEEDER_REFILL_RATE / FRAME_RATE;

    while (outpost.refillAccumulator >= 1 && outpost.reserveFuel > 0 && outpost.feederFuel < OUTPOST_FEEDER_MAX_FUEL) {
        outpost.reserveFuel--;
        outpost.feederFuel++;
        outpost.refillAccumulator--;
    }
}

function robotTouchesOutpost(bot, side) {
    const outpostZone = getOutpostZone(side);
    if (!outpostZone) return false;

    const overlapsY = bot.y + bot.model.h > outpostZone.y && bot.y < outpostZone.y + outpostZone.h;
    if (!overlapsY) return false;

    if (side === 'red') {
        return bot.x <= 5;
    }

    return bot.x + bot.model.w >= FIELD_W - 5;
}

function feedRobotFromOutpost(bot, side) {
    const outpost = state.outposts[side];
    if (!outpost || !robotTouchesOutpost(bot, side) || bot.inventory >= bot.model.capacity) {
        if (outpost) outpost.feedAccumulator = 0;
        return;
    }

    outpost.feedAccumulator += OUTPOST_ROBOT_FEED_RATE / FRAME_RATE;

    while (outpost.feedAccumulator >= 1 && outpost.feederFuel > 0 && bot.inventory < bot.model.capacity) {
        outpost.feederFuel--;
        bot.inventory++;
        (side === 'red' ? dom.heldRed : dom.heldBlue).innerText = bot.inventory;
        outpost.feedAccumulator--;
    }
}

function updateOutposts(now) {
    for (const side of ['red', 'blue']) {
        const outpost = state.outposts[side];
        if (!outpost) continue;

        updateOutpostFeeder(outpost);

        if (isHumanShootingAllowed(side)) {
            for (let i = 0; i < outpost.humanNextThrowTimes.length; i++) {
                if (state.matchElapsed < outpost.humanNextThrowTimes[i]) continue;

                launchOutpostHumanShot(side, now);
                scheduleNextHumanThrow(outpost, i);
            }
        }
    }

    feedRobotFromOutpost(state.botRed, 'red');

    if (state.p2Enabled) {
        feedRobotFromOutpost(state.botBlue, state.sameTeamMode ? 'red' : 'blue');
    }
}

function tryStoreBallInOutpost(b) {
    const redOutpost = getOutpostZone('red');
    const blueOutpost = getOutpostZone('blue');

    if (
        redOutpost &&
        b.x <= b.r &&
        b.y >= redOutpost.y &&
        b.y <= redOutpost.y + redOutpost.h &&
        canAddFuelToOutpost('red')
    ) {
        addFuelToOutpost('red');
        return true;
    }

    if (
        blueOutpost &&
        b.x >= FIELD_W - b.r &&
        b.y >= blueOutpost.y &&
        b.y <= blueOutpost.y + blueOutpost.h &&
        canAddFuelToOutpost('blue')
    ) {
        addFuelToOutpost('blue');
        return true;
    }

    return false;
}

function updateBallCollisions() {
    const passes = 3;

    for (let pass = 0; pass < passes; pass++) {
        for (let i = 0; i < state.balls.length; i++) {
            for (let j = i + 1; j < state.balls.length; j++) {
                resolveBallCollision(state.balls[i], state.balls[j]);
            }
        }
    }
}

function capRollingBallSpeed(b) {
    const speed = Math.hypot(b.vx, b.vy);
    const maxSpeed = 8.5;

    if (speed <= maxSpeed) {
        return;
    }

    b.vx = (b.vx / speed) * maxSpeed;
    b.vy = (b.vy / speed) * maxSpeed;
}

function removeBallVelocityIntoNormal(b, nx, ny) {
    const intoSurface = b.vx * nx + b.vy * ny;

    if (intoSurface < 0) {
        b.vx -= nx * intoSurface;
        b.vy -= ny * intoSurface;
    }
}

function removeRobotVelocityIntoBall(bot, nx, ny) {
    const intoBall = bot.vx * nx + bot.vy * ny;

    if (intoBall > 0) {
        bot.vx -= nx * intoBall;
        bot.vy -= ny * intoBall;
    }
}

function ballCanOccupy(b, x, y) {
    if (x < b.r || y < b.r || x > FIELD_W - b.r || y > FIELD_H - b.r) {
        return false;
    }

    return !state.obstacles.some(o => {
        if (o.type === 'trench') return false;

        return circleRectCollision({
            ...b,
            x,
            y
        }, o).hit;
    });
}

function ballBlockedByPushSurfaceAt(b, x, y, nx, ny) {
    const minIntoSurface = 0.35;

    if (x < b.r && nx < -minIntoSurface) {
        return true;
    }

    if (x > FIELD_W - b.r && nx > minIntoSurface) {
        return true;
    }

    if (y < b.r && ny < -minIntoSurface) {
        return true;
    }

    if (y > FIELD_H - b.r && ny > minIntoSurface) {
        return true;
    }

    return state.obstacles.some(o => {
        if (o.type === 'trench') return false;

        const col = circleRectCollision({
            ...b,
            x,
            y
        }, o);

        if (!col.hit) {
            return false;
        }

        return nx * col.nx + ny * col.ny < -minIntoSurface;
    });
}

function getRobotsOverlappingBallAt(b, x, y) {
    const activeBots = state.p2Enabled
        ? [state.botRed, state.botBlue]
        : [state.botRed];

    return activeBots.filter(bot => circleRectCollision({
        ...b,
        x,
        y
    }, {
        x: bot.x,
        y: bot.y,
        w: bot.model.w,
        h: bot.model.h
    }).hit);
}

function getRobotIntakePosition(bot) {
    if (bot.name === 'Blitz') {
        const intakeAngleOffset = bot.intakeSide === 'right'
            ? Math.PI / 2
            : -Math.PI / 2;

        return {
            x: bot.x + bot.model.w / 2 + Math.cos(bot.angle + intakeAngleOffset) * (bot.model.w / 2 + 5),
            y: bot.y + bot.model.h / 2 + Math.sin(bot.angle + intakeAngleOffset) * (bot.model.w / 2 + 5)
        };
    }

    return {
        x: bot.x + bot.model.w / 2 + Math.cos(bot.angle) * (bot.model.w / 2 + 5),
        y: bot.y + bot.model.h / 2 + Math.sin(bot.angle) * (bot.model.w / 2 + 5)
    };
}

function getBallRelativeToIntake(bot, b) {
    const intakePos = getRobotIntakePosition(bot);

    const dx = b.x - intakePos.x;
    const dy = b.y - intakePos.y;

    let intakeAngle;

    if (bot.name === 'Blitz') {
        intakeAngle = bot.angle + (
            bot.intakeSide === 'right'
                ? Math.PI / 2
                : -Math.PI / 2
        );
    } else {
        intakeAngle = bot.angle;
    }

    const forwardX = Math.cos(intakeAngle);
    const forwardY = Math.sin(intakeAngle);
    const lateralX = -forwardY;
    const lateralY = forwardX;

    const approachSpeed = Math.max(0, bot.vx * forwardX + bot.vy * forwardY);

    return {
        forward: dx * forwardX + dy * forwardY,
        lateral: dx * lateralX + dy * lateralY,
        distance: Math.hypot(dx, dy),
        approachSpeed,
        forwardX,
        forwardY,
        lateralX,
        lateralY
    };
}

function getIntakeAssistProfile(bot, b) {
    const rel = getBallRelativeToIntake(bot, b);

    const speedFactor = Math.min(1, rel.approachSpeed / 5.5);

    return {
        rel,
        speedFactor,

        pickupForwardReach: 2,
        pickupRearTolerance: 3,
        pickupLateralReach: 20,

        pullForwardReach: 8 + speedFactor * 20,
        pullRearTolerance: 10,
        pullLateralReach: 20 + speedFactor * 12,
        pullStrength: 0.12 + speedFactor * 0.5,

        plowForwardReach: 5000 + speedFactor * 150,
        plowRearTolerance: 1000,
        plowLateralReach: 5000 + speedFactor * 50
    };
}

function robotCanIntakeBallNow(bot, b) {
    if (bot.inventory >= bot.model.capacity) {
        return false;
    }

    const profile = getIntakeAssistProfile(bot, b);
    const rel = profile.rel;

    return rel.forward > -profile.pickupRearTolerance &&
        rel.forward < profile.pickupForwardReach &&
        Math.abs(rel.lateral) < profile.pickupLateralReach;
}

function robotCanIntakeBallSoon(bot, b) {
    if (bot.inventory >= bot.model.capacity) {
        return false;
    }

    const profile = getIntakeAssistProfile(bot, b);
    const rel = profile.rel;

    return rel.forward > -profile.pullRearTolerance &&
        rel.forward < profile.pullForwardReach &&
        Math.abs(rel.lateral) < profile.pullLateralReach;
}

function robotCanPlowBallForIntake(bot, b) {
    if (bot.inventory >= bot.model.capacity) {
        return false;
    }

    const profile = getIntakeAssistProfile(bot, b);
    const rel = profile.rel;

    return rel.forward > -1 &&
        rel.forward < profile.plowForwardReach &&
        Math.abs(rel.lateral) < profile.plowLateralReach;
}

function isFrontIntakeContact(bot, b, col, wallPinned = false) {
    const profile = getIntakeAssistProfile(bot, b);
    const rel = profile.rel;

    const contactForward = col.nx * rel.forwardX + col.ny * rel.forwardY;

    const minContactForward = wallPinned ? -0.40 : -0.18;
    const rearTolerance = wallPinned ? -4 : -2;
    const forwardReach = wallPinned ? 30 : 16;
    const lateralReach = profile.plowLateralReach + (wallPinned ? 18 : 0);

    return contactForward > minContactForward &&
        rel.forward > rearTolerance &&
        rel.forward < forwardReach &&
        Math.abs(rel.lateral) < lateralReach;
}

function robotCanScoopContactBall(bot, b, col) {
    if (bot.inventory >= bot.model.capacity) {
        return false;
    }

    const profile = getIntakeAssistProfile(bot, b);
    const rel = profile.rel;

    const contactForward = col.nx * rel.forwardX + col.ny * rel.forwardY;

    return rel.approachSpeed > 0.35 &&
        contactForward > -0.25 &&
        rel.forward > -4 &&
        rel.forward < 18 &&
        Math.abs(rel.lateral) < profile.plowLateralReach + 8;
}

function pullBallTowardIntake(bot, b) {
    const intakePos = getRobotIntakePosition(bot);
    const profile = getIntakeAssistProfile(bot, b);
    const rel = profile.rel;

    const sideTarget = Math.max(
        -profile.pickupLateralReach * 0.85,
        Math.min(profile.pickupLateralReach * 0.85, rel.lateral)
    );

    const targetX = intakePos.x + rel.lateralX * sideTarget;
    const targetY = intakePos.y + rel.lateralY * sideTarget;

    const dx = targetX - b.x;
    const dy = targetY - b.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.001) {
        return;
    }

    const ux = dx / dist;
    const uy = dy / dist;

    const lateralRatio = Math.min(1, Math.abs(rel.lateral) / profile.pullLateralReach);
    const sideMouthBoost = 1 + lateralRatio * 0.20;
    const strength = profile.pullStrength * sideMouthBoost;

    b.vx += ux * strength;
    b.vy += uy * strength;
    b.isStatic = false;

    capRollingBallSpeed(b);
}

function separatePlowBallFromRobot(b, col) {
    const pushDistance = Math.min(col.overlap + 0.14, b.r * 0.95);
    const targetX = b.x + col.nx * pushDistance;
    const targetY = b.y + col.ny * pushDistance;

    if (ballCanOccupy(b, targetX, targetY)) {
        b.x = targetX;
        b.y = targetY;
        removeBallVelocityIntoNormal(b, col.nx, col.ny);
        b.isStatic = false;
        return true;
    }

    if (ballCanOccupy(b, targetX, b.y)) {
        b.x = targetX;
        removeBallVelocityIntoNormal(b, col.nx, 0);
        b.isStatic = false;
        return true;
    }

    if (ballCanOccupy(b, b.x, targetY)) {
        b.y = targetY;
        removeBallVelocityIntoNormal(b, 0, col.ny);
        b.isStatic = false;
        return true;
    }

    return false;
}

function getConnectedIntakeClump(bot, contactBall) {
    const clump = [];
    const visited = new Set();
    const queue = [contactBall];
    const contactDistance = BALL_R * 2.45;

    while (queue.length > 0) {
        const ball = queue.shift();

        if (visited.has(ball)) {
            continue;
        }

        visited.add(ball);

        const rel = getBallRelativeToIntake(bot, ball);

        if (
            rel.forward < -BALL_R * 2.0 ||
            rel.forward > BALL_R * 16.0 ||
            Math.abs(rel.lateral) > BALL_R * 13.0
        ) {
            continue;
        }

        clump.push(ball);

        for (const other of state.balls) {
            if (other === ball || visited.has(other)) {
                continue;
            }

            const dx = other.x - ball.x;
            const dy = other.y - ball.y;

            if (dx * dx + dy * dy <= contactDistance * contactDistance) {
                queue.push(other);
            }
        }
    }

    return clump;
}

function isIntakeClumpWallPinned(bot, clump) {
    for (const ball of clump) {
        const rel = getBallRelativeToIntake(bot, ball);
        const probeStep = ball.r * 0.65;
        const probeX = ball.x + rel.forwardX * probeStep;
        const probeY = ball.y + rel.forwardY * probeStep;

        if (
            !ballCanOccupy(ball, probeX, probeY) &&
            ballBlockedByPushSurfaceAt(ball, probeX, probeY, rel.forwardX, rel.forwardY)
        ) {
            return true;
        }
    }

    return false;
}

function isLocalIntakeClumpWallPinned(bot, contactBall) {
    const maxLocalClumpDistance = BALL_R * 7.5;

    for (const ball of state.balls) {
        const dxToContact = ball.x - contactBall.x;
        const dyToContact = ball.y - contactBall.y;

        if (Math.hypot(dxToContact, dyToContact) > maxLocalClumpDistance) {
            continue;
        }

        if (!robotCanPlowBallForIntake(bot, ball)) {
            continue;
        }

        const rel = getBallRelativeToIntake(bot, ball);
        const probeStep = ball.r * 0.65;
        const probeX = ball.x + rel.forwardX * probeStep;
        const probeY = ball.y + rel.forwardY * probeStep;

        if (
            !ballCanOccupy(ball, probeX, probeY) &&
            ballBlockedByPushSurfaceAt(ball, probeX, probeY, rel.forwardX, rel.forwardY)
        ) {
            return true;
        }
    }

    return false;
}
function applyIntakePlowAssist(bot, contactBall) {
    const clump = getConnectedIntakeClump(bot, contactBall);
    const wallPinned = isIntakeClumpWallPinned(bot, clump);

    if (robotCanIntakeBallSoon(bot, contactBall)) {
        pullBallTowardIntake(bot, contactBall);
    }

    let assistedCount = 0;
    const maxAssistedCount = wallPinned ? 24 : 10;

    for (const ball of clump) {
        if (!robotCanPlowBallForIntake(bot, ball)) {
            continue;
        }

        const profile = getIntakeAssistProfile(bot, ball);
        const rel = profile.rel;

        const overlapLoad = Math.min(1.0, getBallOverlapAmountAt(ball, ball.x, ball.y) / ball.r);

        const forwardShove = wallPinned
            ? 0.030 + overlapLoad * 0.025
            : 0.012 + profile.speedFactor * 0.030;

        ball.vx += rel.forwardX * forwardShove;
        ball.vy += rel.forwardY * forwardShove;

        ball.vx *= wallPinned ? 0.997 : 0.992;
        ball.vy *= wallPinned ? 0.997 : 0.992;
        ball.isStatic = false;

        capRollingBallSpeed(ball);

        assistedCount++;

        if (assistedCount >= maxAssistedCount) {
            break;
        }
    }
}

function tryRelaxBallOrYieldRobot(ball, dx, dy) {
    const moveLength = Math.hypot(dx, dy);

    if (moveLength < 0.001) {
        return false;
    }

    const targetX = ball.x + dx;
    const targetY = ball.y + dy;

    if (ballCanRelaxTo(ball, targetX, targetY)) {
        ball.x = targetX;
        ball.y = targetY;
        return true;
    }

    if (ballCanRelaxTo(ball, targetX, ball.y)) {
        ball.x = targetX;
        return true;
    }

    if (ballCanRelaxTo(ball, ball.x, targetY)) {
        ball.y = targetY;
        return true;
    }

    if (!ballCanOccupy(ball, targetX, targetY)) {
        return false;
    }

    const blockingRobots = getRobotsOverlappingBallAt(ball, targetX, targetY);

    if (blockingRobots.length === 0) {
        return false;
    }

    const ux = dx / moveLength;
    const uy = dy / moveLength;
    let movedRobot = false;

    for (const bot of blockingRobots) {
        const robotDx = dx * 0.65;
        const robotDy = dy * 0.65;

        if (tryMoveRobotForCollision(bot, robotDx, robotDy)) {
            movedRobot = true;
        }

        removeRobotVelocityIntoBall(bot, -ux, -uy);
    }

    if (movedRobot && ballCanRelaxTo(ball, targetX, targetY)) {
        ball.x = targetX;
        ball.y = targetY;
        return true;
    }

    return movedRobot;
}

function ballCanRelaxTo(b, x, y) {
    return ballCanOccupy(b, x, y) &&
        getRobotsOverlappingBallAt(b, x, y).length === 0;
}

function ballOverlapsOtherBallAt(ball, x, y, ignoredBall = null, slop = 0.05) {
    for (const other of state.balls) {
        if (other === ball || other === ignoredBall) continue;

        const dx = other.x - x;
        const dy = other.y - y;
        const minDist = ball.r + other.r - slop;

        if (dx * dx + dy * dy < minDist * minDist) {
            return true;
        }
    }

    return false;
}

function getBallOverlapAmountAt(ball, x, y, slop = 0.04) {
    let overlap = 0;

    for (const other of state.balls) {
        if (other === ball) continue;

        const dx = other.x - x;
        const dy = other.y - y;
        const minDist = ball.r + other.r - slop;
        const distSq = dx * dx + dy * dy;

        if (distSq >= minDist * minDist) {
            continue;
        }

        const dist = Math.max(0.001, Math.sqrt(distSq));
        overlap += minDist - dist;
    }

    return overlap;
}

function getBestBallReliefMove(ball, nx, ny, step, minForwardDot = -0.25) {
    const tangentX = -ny;
    const tangentY = nx;
    const currentOverlap = getBallOverlapAmountAt(ball, ball.x, ball.y);

    const directions = [
        { x: nx, y: ny },
        { x: nx * 0.85 + tangentX * 0.55, y: ny * 0.85 + tangentY * 0.55 },
        { x: nx * 0.85 - tangentX * 0.55, y: ny * 0.85 - tangentY * 0.55 },
        { x: nx * 0.35 + tangentX, y: ny * 0.35 + tangentY },
        { x: nx * 0.35 - tangentX, y: ny * 0.35 - tangentY },
        { x: tangentX, y: tangentY },
        { x: -tangentX, y: -tangentY },
        { x: -nx * 0.20 + tangentX, y: -ny * 0.20 + tangentY },
        { x: -nx * 0.20 - tangentX, y: -ny * 0.20 - tangentY }
    ];

    let bestMove = null;
    let bestScore = -Infinity;

    for (const dir of directions) {
        const length = Math.hypot(dir.x, dir.y);

        if (length < 0.001) {
            continue;
        }

        const ux = dir.x / length;
        const uy = dir.y / length;
        const forwardDot = ux * nx + uy * ny;

        if (forwardDot < minForwardDot) {
            continue;
        }

        const targetX = ball.x + ux * step;
        const targetY = ball.y + uy * step;

        if (!ballCanRelaxTo(ball, targetX, targetY)) {
            continue;
        }

        const targetOverlap = getBallOverlapAmountAt(ball, targetX, targetY);
        const overlapImprovement = currentOverlap - targetOverlap;

        if (targetOverlap > currentOverlap + 0.08) {
            continue;
        }

        const score = overlapImprovement * 2.0 + forwardDot * 0.35;

        if (score > bestScore) {
            bestScore = score;
            bestMove = {
                dx: ux * step,
                dy: uy * step,
                score,
                forwardDot
            };
        }
    }

    return bestMove;
}

function tryMovePackTowardOpenRelief(pack, startBall, nx, ny) {
    const step = Math.min(startBall.r * 0.55, 2.8);
    const orderedPack = [...pack].sort((a, b) => {
        const aForward = (a.x - startBall.x) * nx + (a.y - startBall.y) * ny;
        const bForward = (b.x - startBall.x) * nx + (b.y - startBall.y) * ny;

        return bForward - aForward;
    });

    let movedAny = false;
    let movedCount = 0;

    for (const ball of orderedPack) {
        const move = getBestBallReliefMove(ball, nx, ny, step, -0.35);

        if (!move || move.score < -0.02) {
            continue;
        }

        ball.x += move.dx;
        ball.y += move.dy;
        ball.isStatic = false;
        movedAny = true;
        movedCount++;

        if (movedCount >= 5) {
            break;
        }
    }

    return movedAny;
}

function getForwardBallPack(startBall, nx, ny) {
    const pack = [];
    const visited = new Set();
    const queue = [startBall];

    while (queue.length > 0) {
        const ball = queue.shift();

        if (visited.has(ball)) {
            continue;
        }

        visited.add(ball);
        pack.push(ball);

        for (const other of state.balls) {
            if (other === ball || visited.has(other)) {
                continue;
            }

            const dx = other.x - ball.x;
            const dy = other.y - ball.y;

            const forward = dx * nx + dy * ny;
            const lateral = Math.abs(dx * -ny + dy * nx);
            const centerDistSq = dx * dx + dy * dy;
            const contactDist = ball.r + other.r + 1.2;

            if (centerDistSq > contactDist * contactDist) {
                continue;
            }

            if (forward < -ball.r * 0.35 || forward > ball.r * 2.25) {
                continue;
            }

            if (lateral > ball.r * 1.65) {
                continue;
            }

            queue.push(other);
        }
    }

    return pack;
}

function isBallPackConstrainedIntoWall(startBall, nx, ny) {
    const pack = getForwardBallPack(startBall, nx, ny);
    const probeStep = startBall.r * 0.50;

    for (const ball of pack) {
        const probeX = ball.x + nx * probeStep;
        const probeY = ball.y + ny * probeStep;

        if (ballCanOccupy(ball, probeX, probeY)) {
            continue;
        }

        if (!ballBlockedByPushSurfaceAt(ball, probeX, probeY, nx, ny)) {
            continue;
        }

        const forwardishEscape = getBestBallReliefMove(ball, nx, ny, probeStep, 0.10);

        if (forwardishEscape) {
            continue;
        }

        return {
            constrained: true,
            pack
        };
    }

    return {
        constrained: false,
        pack
    };
}

function addPackEntropyVelocity(pack, startBall, nx, ny, strength) {
    const tangentX = -ny;
    const tangentY = nx;

    for (let i = 0; i < pack.length; i++) {
        const ball = pack[i];

        const dx = ball.x - startBall.x;
        const dy = ball.y - startBall.y;
        const forward = dx * nx + dy * ny;
        const lateral = dx * tangentX + dy * tangentY;

        let side = Math.sign(lateral);

        if (side === 0) {
            side = i % 2 === 0 ? 1 : -1;
        }

        const distanceFalloff = Math.max(0.25, 1 - Math.max(0, forward) / (startBall.r * 8));
        const amount = strength * distanceFalloff;

        ball.vx += tangentX * side * amount;
        ball.vy += tangentY * side * amount;

        ball.isStatic = false;
        capRollingBallSpeed(ball);
    }
}

function pushRobotAwayFromBall(bot, nx, ny, amount) {
    const robotPushX = -nx * amount;
    const robotPushY = -ny * amount;

    if (robotCanOccupy(bot, bot.x + robotPushX, bot.y + robotPushY)) {
        bot.x += robotPushX;
        bot.y += robotPushY;
        return;
    }

    if (robotCanOccupy(bot, bot.x + robotPushX, bot.y)) {
        bot.x += robotPushX;
    }

    if (robotCanOccupy(bot, bot.x, bot.y + robotPushY)) {
        bot.y += robotPushY;
    }
}

function resolveBallWorldConstraints(b) {
    if (b.x < b.r) {
        b.x = b.r;
        removeBallVelocityIntoNormal(b, 1, 0);
    }

    if (b.x > FIELD_W - b.r) {
        b.x = FIELD_W - b.r;
        removeBallVelocityIntoNormal(b, -1, 0);
    }

    if (b.y < b.r) {
        b.y = b.r;
        removeBallVelocityIntoNormal(b, 0, 1);
    }

    if (b.y > FIELD_H - b.r) {
        b.y = FIELD_H - b.r;
        removeBallVelocityIntoNormal(b, 0, -1);
    }

    for (let pass = 0; pass < 2; pass++) {
        state.obstacles.forEach(o => {
            if (o.type === 'trench') return;

            const col = circleRectCollision(b, o);
            if (!col.hit) return;

            b.x += col.nx * (col.overlap + 0.05);
            b.y += col.ny * (col.overlap + 0.05);
            removeBallVelocityIntoNormal(b, col.nx, col.ny);
        });
    }

    capRollingBallSpeed(b);
}

function separateBallFromRobot(b, bot) {
    const robotRect = {
        x: bot.x,
        y: bot.y,
        w: bot.model.w,
        h: bot.model.h
    };

    const col = circleRectCollision(b, robotRect);

    if (!col.hit) {
        return false;
    }

    const wallPinned = isLocalIntakeClumpWallPinned(bot, b);
    const frontIntakeContact = isFrontIntakeContact(bot, b, col, wallPinned);

    if (robotCanIntakeBallSoon(bot, b)) {
        if (separatePlowBallFromRobot(b, col)) {
            applyIntakePlowAssist(bot, b);
            return true;
        }
    }

    if (frontIntakeContact && robotCanPlowBallForIntake(bot, b)) {
        if (separatePlowBallFromRobot(b, col)) {
            applyIntakePlowAssist(bot, b);
            return true;
        }
    }

    const pushDistance = col.overlap + 0.15;
    const ballTargetX = b.x + col.nx * pushDistance;
    const ballTargetY = b.y + col.ny * pushDistance;
    const targetOverlapsBall = ballOverlapsOtherBallAt(b, ballTargetX, ballTargetY);

    if (targetOverlapsBall) {
        const packState = isBallPackConstrainedIntoWall(b, col.nx, col.ny);

        if (packState.constrained) {
            const movedRelief = tryMovePackTowardOpenRelief(packState.pack, b, col.nx, col.ny);

            addPackEntropyVelocity(
                packState.pack,
                b,
                col.nx,
                col.ny,
                movedRelief ? 0.28 : 0.40
            );

            const smallNudge = Math.min(pushDistance * 0.08, 0.24);
            const nudgeX = col.nx * smallNudge;
            const nudgeY = col.ny * smallNudge;

            if (
                movedRelief &&
                ballCanRelaxTo(b, b.x + nudgeX, b.y + nudgeY) &&
                getBallOverlapAmountAt(b, b.x + nudgeX, b.y + nudgeY) <= getBallOverlapAmountAt(b, b.x, b.y) + 0.03
            ) {
                b.x += nudgeX;
                b.y += nudgeY;
            }

            const robotCorrection = movedRelief
                ? Math.min(0.03 + pushDistance * 0.06, 0.22)
                : Math.min(0.12 + pushDistance * 0.12, 0.45);

            pushRobotAwayFromBall(bot, col.nx, col.ny, robotCorrection);
            removeRobotVelocityIntoBall(bot, col.nx, col.ny);

            b.vx *= movedRelief ? 0.92 : 0.78;
            b.vy *= movedRelief ? 0.92 : 0.78;
            b.isStatic = false;
            capRollingBallSpeed(b);

            return true;
        }

        addPackEntropyVelocity(packState.pack, b, col.nx, col.ny, 0.13);
    }

    if (ballCanOccupy(b, ballTargetX, ballTargetY)) {
        const botSpeed = Math.hypot(bot.vx, bot.vy);
        const pushSpeed = Math.max(0, bot.vx * col.nx + bot.vy * col.ny);
        const carrySpeed = Math.min(0.75, pushSpeed * 0.10 + botSpeed * 0.025 + 0.08);

        b.x = ballTargetX;
        b.y = ballTargetY;

        removeBallVelocityIntoNormal(b, col.nx, col.ny);

        b.vx += col.nx * carrySpeed;
        b.vy += col.ny * carrySpeed;

        resolveBallWorldConstraints(b);
        capRollingBallSpeed(b);

        b.isStatic = false;
        return true;
    }

    const robotCorrection = Math.min(pushDistance * 0.45, 1.2);

    pushRobotAwayFromBall(bot, col.nx, col.ny, robotCorrection);
    removeRobotVelocityIntoBall(bot, col.nx, col.ny);

    b.vx *= 0.15;
    b.vy *= 0.15;
    resolveBallWorldConstraints(b);

    return true;
}

function resolveRobotBallPinning() {
    const activeBots = state.p2Enabled
        ? [state.botRed, state.botBlue]
        : [state.botRed];

    for (let pass = 0; pass < 2; pass++) {
        for (const bot of activeBots) {
            for (const b of state.balls) {
                separateBallFromRobot(b, bot);
            }
        }
    }
}

function relaxBallPackPositionOnly(passes = 6) {
    const contactSlop = 0.04;
    const correctionPercent = 0.55;
    const maxPairCorrection = 0.95;
    const maxBallMovePerPass = 1.10;

    for (let pass = 0; pass < passes; pass++) {
        const corrections = new Map();

        function addCorrection(ball, dx, dy) {
            const existing = corrections.get(ball) || { dx: 0, dy: 0 };

            existing.dx += dx;
            existing.dy += dy;

            corrections.set(ball, existing);
        }

        for (let i = 0; i < state.balls.length; i++) {
            for (let j = i + 1; j < state.balls.length; j++) {
                const b1 = state.balls[i];
                const b2 = state.balls[j];

                let dx = b2.x - b1.x;
                let dy = b2.y - b1.y;

                const minDist = b1.r + b2.r;
                const distSq = dx * dx + dy * dy;

                if (distSq >= minDist * minDist) {
                    continue;
                }

                let dist = Math.sqrt(distSq);

                if (dist < 0.001) {
                    dx = 1;
                    dy = 0;
                    dist = 1;
                }

                const overlap = minDist - dist - contactSlop;

                if (overlap <= 0) {
                    continue;
                }

                const nx = dx / dist;
                const ny = dy / dist;
                const correction = Math.min(overlap * correctionPercent, maxPairCorrection);
                const halfCorrection = correction * 0.5;

                addCorrection(b1, -nx * halfCorrection, -ny * halfCorrection);
                addCorrection(b2, nx * halfCorrection, ny * halfCorrection);
            }
        }

        if (corrections.size === 0) {
            break;
        }

        let movedAny = false;

        corrections.forEach((correction, ball) => {
            const moveLength = Math.hypot(correction.dx, correction.dy);

            if (moveLength < 0.001) {
                return;
            }

            const scale = Math.min(1, maxBallMovePerPass / moveLength);
            const dx = correction.dx * scale;
            const dy = correction.dy * scale;

            if (ballCanRelaxTo(ball, ball.x + dx, ball.y + dy)) {
                ball.x += dx;
                ball.y += dy;
                movedAny = true;
                return;
            }

            if (ballCanRelaxTo(ball, ball.x + dx, ball.y)) {
                ball.x += dx;
                movedAny = true;
            }

            if (ballCanRelaxTo(ball, ball.x, ball.y + dy)) {
                ball.y += dy;
                movedAny = true;
            }
        });

        if (!movedAny) {
            break;
        }
    }
}

function updateBalls(now) {
    state.balls = state.balls.filter(b => {
        let onBump = false;

        state.zones.forEach(z => {
            if (z.type === 'bump' && b.x > z.x && b.x < z.x + z.w && b.y > z.y && b.y < z.y + z.h) {
                onBump = true;
                b.isStatic = false;
                b.vx += b.x < z.x + z.w / 2 ? -0.12 : 0.12;
            }
        });

        if (!onBump && b.wasOnBump) {
            b.vx *= 0.25;
            b.vy *= 0.25;
        }

        b.wasOnBump = onBump;

        if (!b.isStatic) {
            b.x += b.vx;
            b.y += b.vy;

            const speed = Math.hypot(b.vx, b.vy);

            if (speed > 0) {
                const frictionMod = b.frictionMod ?? 1.0;
                const randomDrift = b.randomDrift ?? 0.0;

                if (randomDrift > 0 && speed > 0.35) {
                    const tangentX = -b.vy / speed;
                    const tangentY = b.vx / speed;
                    const drift = (Math.random() - 0.5) * randomDrift;

                    b.vx += tangentX * drift;
                    b.vy += tangentY * drift;
                }

                const baseDecel = b.rollTimer && now < b.rollTimer
                    ? 0.035
                    : onBump
                        ? 0.045
                        : 0.065;

                const decel = baseDecel * frictionMod;
                const nextSpeed = Math.max(0, speed - decel);

                if (nextSpeed <= 0.001) {
                    b.vx = 0;
                    b.vy = 0;
                    b.isStatic = true;
                } else {
                    const scale = nextSpeed / speed;
                    b.vx *= scale;
                    b.vy *= scale;
                }
            }
        }

        if (tryStoreBallInOutpost(b)) {
            return false;
        }

        resolveBallWorldConstraints(b);

        const activeBots = state.p2Enabled ? [state.botRed, state.botBlue] : [state.botRed];

        for (const bot of activeBots) {
            const alliance = bot === state.botRed
                ? 'red'
                : state.sameTeamMode
                    ? 'red'
                    : 'blue';

            let intakePos;

            if (bot.name === 'Blitz') {
                const intakeAngleOffset = bot.intakeSide === 'right'
                    ? Math.PI / 2
                    : -Math.PI / 2;

                intakePos = {
                    x: bot.x + bot.model.w / 2 + Math.cos(bot.angle + intakeAngleOffset) * (bot.model.w / 2 + 5),
                    y: bot.y + bot.model.h / 2 + Math.sin(bot.angle + intakeAngleOffset) * (bot.model.w / 2 + 5)
                };
            } else {
                intakePos = {
                    x: bot.x + bot.model.w / 2 + Math.cos(bot.angle) * (bot.model.w / 2 + 5),
                    y: bot.y + bot.model.h / 2 + Math.sin(bot.angle) * (bot.model.w / 2 + 5)
                };
            }

            if (robotCanIntakeBallNow(bot, b)) {
                bot.inventory++;
                const heldElement = alliance === 'red' ? dom.heldRed : dom.heldBlue;
                heldElement.innerText = bot.inventory;
                return false;
            }

            const rCol = circleRectCollision(b, {
                x: bot.x,
                y: bot.y,
                w: bot.model.w,
                h: bot.model.h
            });

            if (rCol.hit) {
                if (robotCanScoopContactBall(bot, b, rCol)) {
                    bot.inventory++;
                    const heldElement = alliance === 'red' ? dom.heldRed : dom.heldBlue;
                    heldElement.innerText = bot.inventory;
                    return false;
                }

                b.owner = alliance;
                b.isStatic = false;

                separateBallFromRobot(b, bot);
                capRollingBallSpeed(b);
            }
        }

        resolveBallWorldConstraints(b);
        capRollingBallSpeed(b);

        return true;
    });
}


function getCurrentPhaseTimeLeft() {
    const phase = MATCH_PHASES[state.currentPhaseIdx];
    if (!phase || !state.matchRunning) return Infinity;
    return Math.max(0, phase.end - state.matchElapsed);
}

function drawHubActiveText(z, color, active) {
    if (!state.matchRunning) return;

    const centerX = z.x + z.w / 2;
    const centerY = z.y + z.h / 2;
    const blink = active && getCurrentPhaseTimeLeft() <= 3;

    if (active && blink && Math.floor(Date.now() / 220) % 2 === 0) {
        return;
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = active ? '900 13px Segoe UI' : '900 11px Segoe UI';
    ctx.fillStyle = active ? `rgb(${color})` : `rgba(${color}, 0.7)`;
    ctx.shadowColor = active ? `rgba(${color}, 0.9)` : 'transparent';
    ctx.shadowBlur = active ? 10 : 0;
    ctx.fillText(active ? 'ACTIVE' : 'INACTIVE', centerX, centerY + 4);
    ctx.restore();
}

function updateProjectiles(now) {
    state.projectiles = state.projectiles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.isPass) {
            p.vx *= 0.975;
            p.vy *= 0.975;
        }

        if (p.x < p.r || p.x > FIELD_W - p.r) p.vx *= -0.4;
        if (p.y < p.r || p.y > FIELD_H - p.r) p.vy *= -0.4;

        state.obstacles.forEach(o => {
            if (o.type === 'hub' && !p.isPass && o.side !== p.owner) {
                const col = circleRectCollision(p, o);

                if (col.hit) {
                    p.vx *= -0.2;
                    p.vy *= -0.2;
                }
            }
        });

        if (p.isHumanShot && now >= p.expiresAt) {
            state.balls.push({
                x: Math.max(BALL_R, Math.min(FIELD_W - BALL_R, p.x)),
                y: Math.max(BALL_R, Math.min(FIELD_H - BALL_R, p.y)),
                r: BALL_R,
                vx: p.vx * 0.2,
                vy: p.vy * 0.2,
                isStatic: false,
                frictionMod: 0.96,
                rollTimer: now + 800,
                wasOnBump: false,
                owner: p.owner
            });

            return false;
        }

        let scored = false;

        state.zones.forEach(z => {
            if (
                z.type === 'hub' &&
                z.side === p.owner &&
                !p.isPass &&
                Math.hypot(p.x - (z.x + z.w / 2), p.y - (z.y + z.h / 2)) < HUB_S / 2
            ) {
                state.scoringBalls.push({
                    exitTime: now + 300,
                    hubX: z.x,
                    hubY: z.y,
                    side: z.side
                });

                scored = true;

                const scoringAllowed = isHubScoringAllowedAt(p.owner, state.matchElapsed);

                if (state.matchRunning && scoringAllowed) {
                    if (p.owner === 'red') {
                        state.scoreRed++;
                        dom.scoreRedDisplay.innerText = state.scoreRed;
                        if (!state.autoPhaseEnded) state.autoScoreRed++;
                    } else {
                        state.scoreBlue++;
                        dom.scoreBlueDisplay.innerText = state.scoreBlue;
                        if (!state.autoPhaseEnded) state.autoScoreBlue++;
                    }
                }
            }
        });

        if (p.isPass && Math.hypot(p.vx, p.vy) < 0.95) {
            state.balls.push({
                x: p.x,
                y: p.y,
                r: BALL_R,
                vx: p.vx * 0.35,
                vy: p.vy * 0.35,
                isStatic: false,
                wasOnBump: false,
                owner: p.owner
            });

            return false;
        }

        return !scored;
    });
}

export function update() {
    assignGamepads();
    updateControllerOutpostToggles();
    tickMatch();
    updateHudBar();

    const now = Date.now();
    let p1State = getInputs('p1');
    let p2State = getInputs('p2');

    p1State = applyUnstickFreeze(now, p1State, state.p1FreezeUntil);
    p2State = applyUnstickFreeze(now, p2State, state.p2FreezeUntil);

    state.botRed.update(
        p1State.x,
        p1State.y,
        p1State.rot,
        p1State.act,
        p1State.toggleIn,
        'red',
        state.obstacles,
        state.zones
    );

    if (state.p2Enabled) {
        state.botBlue.update(
            p2State.x,
            p2State.y,
            p2State.rot,
            p2State.act,
            p2State.toggleIn,
            state.sameTeamMode ? 'red' : 'blue',
            state.obstacles,
            state.zones
        );

        resolveRobotCollisions();
    }

    updateOutposts(now);
    updateScoringBalls(now);
    updateBallCollisions();
    updateBalls(now);
    resolveRobotBallPinning();
    relaxBallPackPositionOnly(6);
    updateProjectiles(now);
}

export function draw() {
    ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, dom.canvas.width, dom.canvas.height);

    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, dom.canvas.width, WALL_VISUAL);
    ctx.fillRect(0, dom.canvas.height - WALL_VISUAL, dom.canvas.width, WALL_VISUAL);
    ctx.fillRect(0, 0, WALL_VISUAL, dom.canvas.height);
    ctx.fillRect(dom.canvas.width - WALL_VISUAL, 0, WALL_VISUAL, dom.canvas.height);

    ctx.save();
    ctx.translate(WALL_VISUAL, WALL_VISUAL);

    state.zones.forEach(z => {
        const c = z.side === 'red' ? '239, 68, 68' : '59, 130, 246';

        if (z.type === 'hub') {
            const active = state.matchRunning
                ? z.side === 'red'
                    ? state.hubRedActive
                    : state.hubBlueActive
                : true;

            ctx.globalAlpha = active ? 1.0 : 0.3;
            ctx.strokeStyle = `rgb(${c})`;
            ctx.lineWidth = 4;
            ctx.strokeRect(z.x, z.y, z.w, z.h);

            ctx.beginPath();
            ctx.fillStyle = 'white';

            for (let i = 0; i < 6; i++) {
                const a = Math.PI / 3 * i;
                const px = z.x + z.w / 2 + z.w / 2 * Math.cos(a);
                const py = z.y + z.h / 2 + z.w / 2 * Math.sin(a);

                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }

            ctx.fill();

            ctx.globalAlpha = 1.0;
            drawHubActiveText(z, c, active);
        } else if (z.type === 'barrier' || z.type === 'towerWall') {
            ctx.fillStyle = `rgb(${c})`;
            ctx.fillRect(z.x, z.y, z.w, z.h);
        } else if (z.type === 'trench') {
            ctx.fillStyle = `rgba(${c}, 0.2)`;
            ctx.fillRect(z.x, z.y, z.w, z.h);
            ctx.strokeStyle = `rgba(${c}, 0.5)`;
            ctx.lineWidth = 2;
            ctx.strokeRect(z.x, z.y, z.w, z.h);

            ctx.save();
            ctx.globalAlpha = 0.38;
            ctx.fillStyle = '#fff';
            ctx.font = '900 18px Segoe UI';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`<${TRENCH_FUEL_LIMIT}`, z.x + z.w / 2, z.y + z.h / 2);
            ctx.restore();
        } else if (z.type === 'tower') {
            ctx.fillStyle = '#222';
            ctx.fillRect(z.x, z.y, z.w, z.h);
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 2;
            ctx.strokeRect(z.x, z.y, z.w, z.h);
        } else if (z.type === 'outpost') {
            const outpost = state.outposts[z.side];
            const totalFuel = getOutpostTotalFuel(z.side);
            const displayState = getOutpostDisplayState(z.side);
            const innerPad = 7;

            ctx.fillStyle = '#1f2937';
            ctx.fillRect(z.x, z.y, z.w, z.h);
            ctx.strokeStyle = `rgba(${c}, 0.95)`;
            ctx.lineWidth = 4;
            ctx.strokeRect(z.x, z.y, z.w, z.h);
            ctx.fillStyle = `rgba(${c}, 0.22)`;
            ctx.fillRect(z.x + innerPad, z.y + innerPad, z.w - innerPad * 2, z.h - innerPad * 2);

            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.font = 'bold 19px Segoe UI';
            ctx.fillText(displayState, z.x + z.w / 2, z.y + 26);

            ctx.font = 'bold 14px Segoe UI';
            ctx.fillText(`FUEL ${totalFuel}/48`, z.x + z.w / 2, z.y + z.h - 34);

            ctx.font = 'bold 12px Segoe UI';
            ctx.fillText(`LOAD ${outpost ? outpost.feederFuel : 0}/24`, z.x + z.w / 2, z.y + z.h - 17);

            const dotColumns = 8;
            const dotRows = 6;
            const dotRadius = 2.4;
            const dotStartX = z.x + 14;
            const dotStartY = z.y + 51;
            const dotAreaW = z.w - 28;
            const dotAreaH = Math.max(8, z.h - 91);
            const dotXSpacing = dotColumns > 1 ? dotAreaW / (dotColumns - 1) : 0;
            const dotYSpacing = dotRows > 1 ? dotAreaH / (dotRows - 1) : 0;

            ctx.fillStyle = '#fbbf24';
            for (let i = 0; i < Math.min(totalFuel, dotColumns * dotRows); i++) {
                const col = i % dotColumns;
                const row = Math.floor(i / dotColumns);

                ctx.beginPath();
                ctx.arc(dotStartX + col * dotXSpacing, dotStartY + row * dotYSpacing, dotRadius, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.textBaseline = 'alphabetic';
        } else if (z.type === 'depot') {
            ctx.fillStyle = `rgba(${c}, 0.15)`;
            ctx.fillRect(z.x, z.y, z.w, z.h);
            ctx.strokeStyle = `rgba(${c}, 0.8)`;
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.strokeRect(z.x, z.y, z.w, z.h);
            ctx.setLineDash([]);
        } else {
            ctx.fillStyle = `rgba(${c}, 0.2)`;
            ctx.fillRect(z.x, z.y, z.w, z.h);
        }
    });

    if (Date.now() < state.p1FreezeUntil && state.matchRunning) {
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
    }

    state.botRed.draw(ctx, 'red');
    ctx.globalAlpha = 1.0;

    if (state.p2Enabled) {
        if (Date.now() < state.p2FreezeUntil && state.matchRunning) {
            ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
        }

        state.botBlue.draw(ctx, state.sameTeamMode ? 'red' : 'blue');
        ctx.globalAlpha = 1.0;
    }

    ctx.fillStyle = '#fbbf24';

    state.balls.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
    });

    state.projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.restore();
    requestAnimationFrame(draw);
}
