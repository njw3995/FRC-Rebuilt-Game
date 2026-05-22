export function rectRect(r1x, r1y, r1w, r1h, r2) {
    return r1x < r2.x + r2.w &&
        r1x + r1w > r2.x &&
        r1y < r2.y + r2.h &&
        r1y + r1h > r2.y;
}

export function circleRectCollision(c, r) {
    const insideX = c.x > r.x && c.x < r.x + r.w;
    const insideY = c.y > r.y && c.y < r.y + r.h;

    if (insideX && insideY) {
        const left = c.x - r.x;
        const right = r.x + r.w - c.x;
        const top = c.y - r.y;
        const bottom = r.y + r.h - c.y;

        const minSide = Math.min(left, right, top, bottom);

        if (minSide === left) {
            return { hit: true, nx: -1, ny: 0, overlap: c.r + left };
        }

        if (minSide === right) {
            return { hit: true, nx: 1, ny: 0, overlap: c.r + right };
        }

        if (minSide === top) {
            return { hit: true, nx: 0, ny: -1, overlap: c.r + top };
        }

        return { hit: true, nx: 0, ny: 1, overlap: c.r + bottom };
    }

    const cx = Math.max(r.x, Math.min(c.x, r.x + r.w));
    const cy = Math.max(r.y, Math.min(c.y, r.y + r.h));
    let dx = c.x - cx;
    let dy = c.y - cy;
    const distSq = dx * dx + dy * dy;

    if (distSq >= c.r * c.r) {
        return { hit: false };
    }

    let dist = Math.sqrt(distSq);

    if (dist === 0) {
        dx = 1;
        dy = 0;
        dist = 1;
    }

    return {
        hit: true,
        nx: dx / dist,
        ny: dy / dist,
        overlap: c.r - dist
    };
}

export function resolveBallCollision(b1, b2) {
    let dx = b2.x - b1.x;
    let dy = b2.y - b1.y;
    const distSq = dx * dx + dy * dy;
    const minDist = b1.r + b2.r;

    if (distSq >= minDist * minDist) {
        return;
    }

    let dist = Math.sqrt(distSq);

    if (dist === 0) {
        dx = 1;
        dy = 0;
        dist = 1;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    // Move overlapped balls apart mostly by position, not by adding velocity.
    // This prevents packed piles from exploding.
    const b1Speed = Math.hypot(b1.vx || 0, b1.vy || 0);
    const b2Speed = Math.hypot(b2.vx || 0, b2.vy || 0);

    const b1MoveWeight = b1.isStatic && b1Speed < 0.03 ? 0.35 : 1.0;
    const b2MoveWeight = b2.isStatic && b2Speed < 0.03 ? 0.35 : 1.0;
    const totalMoveWeight = b1MoveWeight + b2MoveWeight;

    const correction = Math.min(overlap * 0.55, 0.9);

    b1.x -= nx * correction * (b1MoveWeight / totalMoveWeight);
    b1.y -= ny * correction * (b1MoveWeight / totalMoveWeight);
    b2.x += nx * correction * (b2MoveWeight / totalMoveWeight);
    b2.y += ny * correction * (b2MoveWeight / totalMoveWeight);

    // Only apply a small, damped bounce if the balls are actually moving into each other.
    const rvx = (b2.vx || 0) - (b1.vx || 0);
    const rvy = (b2.vy || 0) - (b1.vy || 0);
    const closingSpeed = rvx * nx + rvy * ny;

    if (closingSpeed < 0) {
        const restitution = 0.08;
        const impulse = Math.min(0.28, -closingSpeed * restitution);

        b1.vx -= nx * impulse * (b1MoveWeight / totalMoveWeight);
        b1.vy -= ny * impulse * (b1MoveWeight / totalMoveWeight);
        b2.vx += nx * impulse * (b2MoveWeight / totalMoveWeight);
        b2.vy += ny * impulse * (b2MoveWeight / totalMoveWeight);

        const tangentX = -ny;
        const tangentY = nx;
        const tangentJitter = (Math.random() - 0.5) * Math.min(0.06, -closingSpeed * 0.012);

        b1.vx -= tangentX * tangentJitter;
        b1.vy -= tangentY * tangentJitter;
        b2.vx += tangentX * tangentJitter;
        b2.vy += tangentY * tangentJitter;
    }

    if (overlap > 0.15 || b1Speed > 0.08 || b2Speed > 0.08) {
        b1.isStatic = false;
        b2.isStatic = false;
    }
}
