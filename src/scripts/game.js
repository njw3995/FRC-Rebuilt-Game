import {
    BALL_R,
    FIELD_H,
    FIELD_W,
    FRAME_RATE,
    HUB_S,
    OUTPOST_FEEDER_MAX_FUEL,
    OUTPOST_FEEDER_REFILL_RATE,
    OUTPOST_HUMAN_MAX_RATE,
    OUTPOST_HUMAN_MIN_RATE,
    OUTPOST_CONTROLLER_TOGGLE_BUTTON,
    OUTPOST_HUMAN_SHOOT_STOP_LEAD_TIME,
    OUTPOST_ROBOT_FEED_RATE,
    WALL_VISUAL
} from './constants.js';
import { ctx } from './dom.js';
import { dom } from './dom.js';
import { state } from './state.js';
import { getInputs, assignGamepads, isControllerButtonPressed } from './input.js';
import { isHubActiveAt, tickMatch, updateHudBar } from './match.js';
import { circleRectCollision, rectRect, resolveBallCollision } from './math.js';
import { toggleHumanPlayerShooting } from './ui.js';
import {
    addFuelToOutpost,
    canAddFuelToOutpost,
    getOutpostTotalFuel,
    getOutpostZone,
    takeFuelFromOutpostForHuman
} from './field.js';

function applyUnstickFreeze(now, playerState, freezeUntil) {
    if (now >= freezeUntil) return playerState;
    return { x: 0, y: 0, rot: 0, act: false, toggleIn: false };
}

function updateControllerOutpostToggles() {
    const p1Pressed = isControllerButtonPressed('p1', OUTPOST_CONTROLLER_TOGGLE_BUTTON);
    if (p1Pressed && !state.outpostControllerTogglePressed.p1) {
        toggleHumanPlayerShooting('red');
    }
    state.outpostControllerTogglePressed.p1 = p1Pressed;

    const p2Pressed = state.p2Enabled && isControllerButtonPressed('p2', OUTPOST_CONTROLLER_TOGGLE_BUTTON);
    if (p2Pressed && !state.outpostControllerTogglePressed.p2) {
        toggleHumanPlayerShooting(state.sameTeamMode ? 'red' : 'blue');
    }
    state.outpostControllerTogglePressed.p2 = p2Pressed;
}

function resolveRobotCollision() {
    const botRed = state.botRed;
    const botBlue = state.botBlue;
    const dx = (botRed.x + botRed.model.w / 2) - (botBlue.x + botBlue.model.w / 2);
    let dy = (botRed.y + botRed.model.h / 2) - (botBlue.y + botBlue.model.h / 2);
    const rad = botRed.model.w / 2 + botBlue.model.w / 2;

    if (dx * dx + dy * dy >= rad * rad) return;

    let dist = Math.sqrt(dx * dx + dy * dy);
    let nx = dx / dist;
    let ny = dy / dist;

    if (dist === 0) {
        nx = 1;
        ny = 0;
        dist = 1;
    }

    const overlap = rad - dist;

    botRed.x += nx * overlap * 0.5;
    botRed.y += ny * overlap * 0.5;
    botBlue.x -= nx * overlap * 0.5;
    botBlue.y -= ny * overlap * 0.5;

    botRed.x = Math.max(0, Math.min(FIELD_W - botRed.model.w, botRed.x));
    botRed.y = Math.max(0, Math.min(FIELD_H - botRed.model.h, botRed.y));
    botBlue.x = Math.max(0, Math.min(FIELD_W - botBlue.model.w, botBlue.x));
    botBlue.y = Math.max(0, Math.min(FIELD_H - botBlue.model.h, botBlue.y));

    state.obstacles.forEach(o => {
        if (o.type === 'trench') return;

        if (rectRect(botRed.x, botRed.y, botRed.model.w, botRed.model.h, o)) {
            botRed.x = nx > 0 ? o.x + o.w : o.x - botRed.model.w;
            botRed.vx = 0;
        }

        if (rectRect(botBlue.x, botBlue.y, botBlue.model.w, botBlue.model.h, o)) {
            botBlue.x = nx > 0 ? o.x - botBlue.model.w : o.x + o.w;
            botBlue.vx = 0;
        }
    });

    botRed.vx += nx * 0.5;
    botRed.vy += ny * 0.5;
    botBlue.vx -= nx * 0.5;
    botBlue.vy -= ny * 0.5;
}

function updateScoringBalls(now) {
    state.scoringBalls = state.scoringBalls.filter(sb => {
        if (now < sb.exitTime) return true;

        const dir = sb.side === 'red' ? 1 : -1;
        const exitSpeed = 3.0 + Math.random() * 1.0;
        const exitAngle = (Math.random() - 0.5) * 0.8;

        state.balls.push({
            x: sb.side === 'red' ? sb.hubX + HUB_S + BALL_R + 2 : sb.hubX - BALL_R - 2,
            y: sb.hubY + HUB_S / 2,
            r: BALL_R,
            vx: Math.cos(exitAngle) * (dir * exitSpeed),
            vy: Math.sin(exitAngle) * exitSpeed,
            isStatic: false,
            frictionMod: 0.985,
            rollTimer: now + 1500,
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
    const activeHumanOutpostSides = state.sameTeamMode || !state.p2Enabled ? ['red'] : ['red', 'blue'];

    for (const side of activeHumanOutpostSides) {
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
    for (let i = 0; i < state.balls.length; i++) {
        for (let j = i + 1; j < state.balls.length; j++) {
            resolveBallCollision(state.balls[i], state.balls[j]);
        }
    }
}

function getBotAlliance(bot) {
    if (bot === state.botRed) return 'red';
    return state.sameTeamMode ? 'red' : 'blue';
}

function getBotIntakePosition(bot) {
    if (bot.name === 'Blitz') {
        const intakeAngleOffset = bot.intakeSide === 'right' ? Math.PI / 2 : -Math.PI / 2;

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
            b.vx *= 0.15;
            b.vy *= 0.15;
        }

        b.wasOnBump = onBump;

        if (!b.isStatic) {
            b.x += b.vx;
            b.y += b.vy;

            const friction = b.rollTimer && now < b.rollTimer
                ? b.frictionMod
                : onBump
                    ? 0.96
                    : 0.91;

            b.vx *= friction;
            b.vy *= friction;

            if (Math.hypot(b.vx, b.vy) < 0.15) {
                b.vx = 0;
                b.vy = 0;
                b.isStatic = true;
            }
        }

        if (tryStoreBallInOutpost(b)) {
            return false;
        }

        if (b.x < b.r) {
            b.x = b.r;
            b.vx *= -0.2;
            b.isStatic = false;
        }

        if (b.x > FIELD_W - b.r) {
            b.x = FIELD_W - b.r;
            b.vx *= -0.2;
            b.isStatic = false;
        }

        if (b.y < b.r) {
            b.y = b.r;
            b.vy *= -0.2;
            b.isStatic = false;
        }

        if (b.y > FIELD_H - b.r) {
            b.y = FIELD_H - b.r;
            b.vy *= -0.2;
            b.isStatic = false;
        }

        state.obstacles.forEach(o => {
            if (o.type === 'trench') return;

            const col = circleRectCollision(b, o);
            if (!col.hit) return;

            b.isStatic = false;
            b.vx *= 0.8;
            b.vy *= 0.8;
            b.x += col.nx * col.overlap;
            b.y += col.ny * col.overlap;
        });

        const activeBots = state.p2Enabled ? [state.botRed, state.botBlue] : [state.botRed];

        for (const bot of activeBots) {
            const alliance = getBotAlliance(bot);
            const intakePos = getBotIntakePosition(bot);

            if (Math.hypot(b.x - intakePos.x, b.y - intakePos.y) < 9 && bot.inventory < bot.model.capacity) {
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
                b.isStatic = false;
                b.owner = alliance;
                b.x += rCol.nx * rCol.overlap;
                b.y += rCol.ny * rCol.overlap;
                b.vx += rCol.nx * (Math.abs(bot.vx) * 0.5 + 1.0);
                b.vy += rCol.ny * (Math.abs(bot.vy) * 0.5 + 1.0);
            }
        }

        const speed = Math.hypot(b.vx, b.vy);
        if (speed > 25) {
            b.vx = (b.vx / speed) * 25;
            b.vy = (b.vy / speed) * 25;
        }

        return true;
    });
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

                const isHubActive = p.owner === 'red'
                    ? state.hubRedActive
                    : state.hubBlueActive;

                if (state.matchRunning && isHubActive) {
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

        resolveRobotCollision();
    }

    updateOutposts(now);
    updateScoringBalls(now);
    updateBallCollisions();
    updateBalls(now);
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

            if (state.matchRunning && !active) {
                ctx.fillStyle = `rgba(${c}, 0.7)`;
                ctx.font = 'bold 12px Segoe UI';
                ctx.textAlign = 'center';
                ctx.fillText('INACTIVE', z.x + z.w / 2, z.y + z.h / 2 + 5);
            }

            ctx.globalAlpha = 1.0;
        } else if (z.type === 'barrier' || z.type === 'towerWall') {
            ctx.fillStyle = `rgb(${c})`;
            ctx.fillRect(z.x, z.y, z.w, z.h);
        } else if (z.type === 'trench') {
            ctx.fillStyle = `rgba(${c}, 0.2)`;
            ctx.fillRect(z.x, z.y, z.w, z.h);
            ctx.strokeStyle = `rgba(${c}, 0.5)`;
            ctx.lineWidth = 2;
            ctx.strokeRect(z.x, z.y, z.w, z.h);
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
