import {
    BLUE_SHOOT_LIMIT,
    BOT_MODELS,
    FIELD_H,
    FIELD_W,
    HUB_S,
    RED_SHOOT_LIMIT,
    TRENCH_FUEL_LIMIT
} from './constants.js';
import { dom } from './dom.js';
import { state } from './state.js';
import { rectRect } from './math.js';

function normalizeAngleDiff(diff) {
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
}

function getHeldElement(alliance) {
    return alliance === 'red' ? dom.heldRed : dom.heldBlue;
}

export class Robot {
    constructor(x, y, modelKey, startingAngle) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = startingAngle;
        this.vAngle = 0;
        this.inventory = 0;
        this.lastShot = 0;
        this.streamCooldowns = [0, 0, 0, 0];
        this.setModel(modelKey);
    }

    setModel(key) {
        this.model = BOT_MODELS[key];
        this.name = key;
        this.intakeSide = 'right';
        this.prevIntakeInput = false;
    }

    update(moveX, moveY, rotInput, rawActInput, rawToggleInput, alliance, obstacles, zones) {
        if (isNaN(this.x) || isNaN(this.y) || isNaN(this.vx) || isNaN(this.vy)) {
            this.x = alliance === 'red' ? 80 : FIELD_W - 115;
            this.y = FIELD_H / 2 - 14;
            this.vx = 0;
            this.vy = 0;
            this.vAngle = 0;
        }

        const isActionActive = rawActInput;

        if (this.name === 'Blitz') {
            if (rawToggleInput && !this.prevIntakeInput) {
                this.intakeSide = this.intakeSide === 'right' ? 'left' : 'right';
            }

            this.prevIntakeInput = rawToggleInput;
        }

        if (state.matchRunning && state.currentPhaseIdx === 1) {
            this.vx *= 0.5;
            this.vy *= 0.5;
            this.vAngle *= 0.5;
            this.x += this.vx;
            this.y += this.vy;
            this.angle += this.vAngle;
            return;
        }

        let onBump = false;
        let inTower = false;
        let inDepot = false;

        zones.forEach(z => {
            if (z.type === 'bump' && rectRect(this.x, this.y, this.model.w, this.model.h, z)) onBump = true;
            if (z.type === 'tower' && rectRect(this.x, this.y, this.model.w, this.model.h, z)) inTower = true;
            if (z.type === 'depot' && rectRect(this.x, this.y, this.model.w, this.model.h, z)) inDepot = true;
        });

        const rcx = this.x + this.model.w / 2;
        const rcy = this.y + this.model.h / 2;
        const isShootingZone = alliance === 'red'
            ? rcx < RED_SHOOT_LIMIT
            : rcx > BLUE_SHOOT_LIMIT;

        const heldElement = getHeldElement(alliance);
        if (this.inventory >= this.model.capacity * 0.75) {
            heldElement.classList.add('warning');
        } else {
            heldElement.classList.remove('warning');
        }

        if (moveX !== 0 || moveY !== 0) {
            const mag = Math.sqrt(moveX * moveX + moveY * moveY);

            if (mag > 0.8) {
                moveX /= mag;
                moveY /= mag;
            }
        }

        const speedMod = inDepot ? 0.65 : 1.0;
        const passSpeedDampen = this.name === 'Blitz'
            ? 0.60
            : this.name === 'dumper'
                ? 0.25
                : 0.50;
        const activeSpeedMod = isActionActive ? passSpeedDampen : 1.0;
        const bumpAccel = 0.15;
        const driveAccel = this.model.accel * speedMod * activeSpeedMod;

        this.vx += moveX * (onBump ? bumpAccel : driveAccel);
        this.vy += moveY * (onBump ? bumpAccel : driveAccel);

        let isLockedOn = true;

        if (this.name === 'dumper' && isActionActive && !inTower) {
            const hub = zones.find(z => z.type === 'hub' && z.side === alliance);
            const tx = isShootingZone ? hub.x + HUB_S / 2 : alliance === 'red' ? 40 : FIELD_W - 40;
            const ty = isShootingZone ? hub.y + HUB_S / 2 : rcy < FIELD_H / 2 ? 40 : FIELD_H - 40;
            const diff = normalizeAngleDiff(Math.atan2(ty - rcy, tx - rcx) + Math.PI - this.angle);
            const autoSpeedCap = 0.20 * speedMod * (isShootingZone ? 0.45 : 0.6);

            this.vAngle = Math.max(-autoSpeedCap, Math.min(autoSpeedCap, diff * 0.45));
            if (Math.abs(diff) > 0.04) isLockedOn = false;
        } else if (this.name === 'Blitz' && isActionActive && !inTower) {
            let diff = 0;

            if (isShootingZone) {
                const hub = zones.find(z => z.type === 'hub' && z.side === alliance);
                const tx = hub.x + HUB_S / 2;
                const ty = hub.y + HUB_S / 2;
                diff = Math.atan2(ty - rcy, tx - rcx) - this.angle;
            } else {
                const targetX = alliance === 'red' ? 0 : FIELD_W;
                let targetY = rcy;
                const hubYCenter = FIELD_H / 2;
                const hubClearance = HUB_S / 2 + 40;

                if (Math.abs(rcy - hubYCenter) < hubClearance) {
                    targetY = rcy < hubYCenter
                        ? hubYCenter - hubClearance
                        : hubYCenter + hubClearance;
                }

                diff = Math.atan2(targetY - rcy, targetX - rcx) - this.angle;
            }

            diff = normalizeAngleDiff(diff);
            const autoSpeedCap = 0.20 * speedMod * (isShootingZone ? 0.45 : 0.6);
            this.vAngle = Math.max(-autoSpeedCap, Math.min(autoSpeedCap, diff * 0.45));

            if (Math.abs(diff) > 0.06) isLockedOn = false;
        } else {
            const rotationMod = isActionActive ? (isShootingZone ? 0.45 : 0.6) : 1.0;
            this.vAngle += rotInput * (this.model.rotSpeed * speedMod * rotationMod);
        }

        this.vx *= 0.91;
        this.vy *= 0.91;
        this.vAngle *= 0.78;

        const nx = this.x + this.vx;
        const ny = this.y + this.vy;
        let blockX = false;
        let blockY = false;

        obstacles.forEach(o => {
            if (o.type === 'trench' && this.inventory < TRENCH_FUEL_LIMIT) return;
            if (rectRect(nx, this.y, this.model.w, this.model.h, o)) blockX = true;
            if (rectRect(this.x, ny, this.model.w, this.model.h, o)) blockY = true;
        });

        if (!blockX && nx > 0 && nx + this.model.w < FIELD_W) this.x = nx;
        if (!blockY && ny > 0 && ny + this.model.h < FIELD_H) this.y = ny;
        this.angle += this.vAngle;

        const now = Date.now();

        if (isActionActive && this.inventory > 0 && !inTower) {
            if (this.name === 'dumper' || this.name === 'Blitz') {
                if (isLockedOn) {
                    if (now - this.lastShot > 500) {
                        for (let i = 0; i < 4; i++) {
                            this.streamCooldowns[i] = now + i * 45;
                        }
                    }

                    for (let i = 0; i < 4; i++) {
                        if (now >= this.streamCooldowns[i] && this.inventory > 0) {
                            this.fireSingleStream(i, 4, 5.5, isShootingZone, alliance, rcx, rcy);
                            this.streamCooldowns[i] = now + 105 + Math.random() * 55;
                            this.lastShot = now;
                        }
                    }
                }
            } else if (this.name === 'double turret') {
                if (now - this.lastShot > 500) {
                    this.streamCooldowns[0] = now;
                    this.streamCooldowns[1] = now + 60;
                }

                for (let i = 0; i < 2; i++) {
                    if (now >= this.streamCooldowns[i] && this.inventory > 0) {
                        this.fireSingleStream(i, 2, 15.0, isShootingZone, alliance, rcx, rcy);
                        this.streamCooldowns[i] = now + 120;
                        this.lastShot = now;
                    }
                }
            } else if (now - this.lastShot > this.model.fireRate) {
                this.fireStandard(isShootingZone, alliance, rcx, rcy, now);
            }
        }
    }

    fireSingleStream(streamIdx, totalStreams, customSpacing, isShooting, alliance, rcx, rcy) {
        let launchAngle = this.angle;
        let speed = 11.5;

        if (isShooting) {
            const hub = state.zones.find(z => z.type === 'hub' && z.side === alliance);
            launchAngle = Math.atan2((hub.y + hub.h / 2) - rcy, (hub.x + hub.w / 2) - rcx);
        } else if (this.name === 'Blitz') {
            launchAngle = this.angle;
            speed = 13 + Math.random() * 2.0;
        } else {
            const tx = alliance === 'red' ? 40 : FIELD_W - 40;
            const ty = rcy < FIELD_H / 2 ? 40 : FIELD_H - 40;
            launchAngle = Math.atan2(ty - rcy, tx - rcx);
            speed = (9.5 + Math.hypot(tx - rcx, ty - rcy) * 0.01) * (0.88 + Math.random() * 0.22);
        }

        const pX = -Math.sin(launchAngle);
        const pY = Math.cos(launchAngle);
        const rAngle = launchAngle + (Math.random() - 0.5) * (isShooting ? 0.01 : 0.08);
        const sSpacing = (streamIdx - (totalStreams - 1) / 2) * customSpacing;

        state.projectiles.push({
            x: rcx + Math.cos(launchAngle) * (this.model.w / 2 + 4) + pX * sSpacing,
            y: rcy + Math.sin(launchAngle) * (this.model.w / 2 + 4) + pY * sSpacing,
            vx: Math.cos(rAngle) * speed,
            vy: Math.sin(rAngle) * speed,
            r: 4,
            owner: alliance,
            isPass: !isShooting
        });

        this.inventory--;
        getHeldElement(alliance).innerText = this.inventory;
    }

    fireStandard(isShooting, alliance, rcx, rcy, now) {
        let launchAngle = this.angle;
        let speed = 16;

        if (isShooting) {
            const hub = state.zones.find(z => z.type === 'hub' && z.side === alliance);
            launchAngle = Math.atan2((hub.y + hub.h / 2) - rcy, (hub.x + hub.w / 2) - rcx);
        } else {
            const tx = alliance === 'red' ? 40 : FIELD_W - 40;
            const ty = rcy < FIELD_H / 2 ? 40 : FIELD_H - 40;
            launchAngle = Math.atan2(ty - rcy, tx - rcx) + (Math.random() - 0.5) * 0.12;
            speed = (13 + Math.hypot(tx - rcx, ty - rcy) * 0.012) * (0.85 + Math.random() * 0.25);
        }

        state.projectiles.push({
            x: rcx + Math.cos(this.angle) * (this.model.w / 2 + 5),
            y: rcy + Math.sin(this.angle) * (this.model.w / 2 + 5),
            vx: Math.cos(launchAngle) * speed,
            vy: Math.sin(launchAngle) * speed,
            r: 4,
            owner: alliance,
            isPass: !isShooting
        });

        this.inventory--;
        this.lastShot = now;
        getHeldElement(alliance).innerText = this.inventory;
    }

    getAimedShotAngle(alliance) {
        const rcx = this.x + this.model.w / 2;
        const rcy = this.y + this.model.h / 2;

        const isShootingZone = alliance === 'red'
            ? rcx < RED_SHOOT_LIMIT
            : rcx > BLUE_SHOOT_LIMIT;

        if (isShootingZone) {
            const hub = state.zones.find(z => z.type === 'hub' && z.side === alliance);

            if (hub) {
                return Math.atan2(
                    (hub.y + hub.h / 2) - rcy,
                    (hub.x + hub.w / 2) - rcx
                );
            }
        }

        const targetX = alliance === 'red' ? 40 : FIELD_W - 40;
        const targetY = rcy < FIELD_H / 2 ? 40 : FIELD_H - 40;

        return Math.atan2(targetY - rcy, targetX - rcx);
    }

    drawAttachedShooterTriangle(ctx, localAngle, offset = 0) {
        const ux = Math.cos(localAngle);
        const uy = Math.sin(localAngle);
        const px = -uy;
        const py = ux;
        const halfW = this.model.w / 2;
        const halfH = this.model.h / 2;
        const safeUx = Math.max(0.001, Math.abs(ux));
        const safeUy = Math.max(0.001, Math.abs(uy));
        const edgeDistance = Math.min(halfW / safeUx, halfH / safeUy);
        const tipDistance = edgeDistance + 6;
        const baseDistance = edgeDistance - 3;
        const halfBase = 4;
        const tipX = ux * tipDistance + px * offset;
        const tipY = uy * tipDistance + py * offset;
        const baseX = ux * baseDistance + px * offset;
        const baseY = uy * baseDistance + py * offset;

        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(baseX + px * halfBase, baseY + py * halfBase);
        ctx.lineTo(baseX - px * halfBase, baseY - py * halfBase);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    drawShooterIndicators(ctx, alliance) {
        if (this.name === 'Blitz') {
            this.drawAttachedShooterTriangle(ctx, 0);
            return;
        }

        if (this.name === 'dumper') {
            this.drawAttachedShooterTriangle(ctx, Math.PI);
            return;
        }

        const aimedLocalAngle = normalizeAngleDiff(
            this.getAimedShotAngle(alliance) - this.angle
        );

        if (this.name === 'double turret') {
            this.drawAttachedShooterTriangle(ctx, aimedLocalAngle, -6);
            this.drawAttachedShooterTriangle(ctx, aimedLocalAngle, 6);
            return;
        }

        this.drawAttachedShooterTriangle(ctx, aimedLocalAngle);
    }

    getInventoryFillRatio() {
        if (!this.model.capacity) return 0;
        return Math.max(0, Math.min(1, this.inventory / this.model.capacity));
    }

    getInventoryTextColor() {
        const ratio = this.getInventoryFillRatio();
        const greenBlue = Math.round(255 - ratio * 64);
        return `rgb(255, ${greenBlue}, ${greenBlue})`;
    }

    drawInventoryNumber(ctx) {
        const ratio = this.getInventoryFillRatio();
        const remaining = this.model.capacity - this.inventory;
        const nearFullRatio = Math.max(0, Math.min(1, (20 - remaining) / 20));
        const isFull = this.inventory >= this.model.capacity;
        const fontSize = isFull ? 23 : 17 + Math.round(nearFullRatio * 4);

        ctx.save();
        ctx.rotate(-this.angle);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 ${fontSize}px Segoe UI`;

        if (nearFullRatio > 0 || isFull) {
            ctx.shadowColor = isFull ? '#f59e0b' : '#fbbf24';
            ctx.shadowBlur = isFull ? 20 : 5 + nearFullRatio * 14;
        }

        if (isFull) {
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 5;
            ctx.strokeText(this.inventory, 0, 1);
        }

        ctx.fillStyle = isFull ? '#f59e0b' : this.getInventoryTextColor();
        ctx.fillText(this.inventory, 0, 1);
        ctx.restore();
    }

    draw(ctx, alliance) {
        ctx.save();
        ctx.translate(this.x + this.model.w / 2, this.y + this.model.h / 2);
        ctx.rotate(this.angle);
        ctx.fillStyle = alliance === 'red' ? '#ef4444' : '#3b82f6';
        ctx.fillRect(-this.model.w / 2, -this.model.h / 2, this.model.w, this.model.h);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.model.w / 2, -this.model.h / 2, this.model.w, this.model.h);

        this.drawShooterIndicators(ctx, alliance);

        ctx.fillStyle = '#fbbf24';

        if (this.name === 'Blitz') {
            if (this.intakeSide === 'right') {
                ctx.fillRect(-this.model.w / 2 + 2, this.model.h / 2 - 6, this.model.w - 4, 12);
            } else {
                ctx.fillRect(-this.model.w / 2 + 2, -this.model.h / 2 - 6, this.model.w - 4, 12);
            }
        } else {
            const bY = this.name === 'dumper' ? -14 : -12.5;
            const bW = this.name === 'dumper' ? 5 : 6;
            const bH = this.name === 'dumper' ? 28 : 25;
            ctx.fillRect(this.model.w / 2 - 2, bY, bW, bH);
        }

        this.drawInventoryNumber(ctx);
        ctx.restore();
    }
}
