export function rectRect(r1x, r1y, r1w, r1h, r2) {
    return r1x < r2.x + r2.w &&
        r1x + r1w > r2.x &&
        r1y < r2.y + r2.h &&
        r1y + r1h > r2.y;
}

export function circleRectCollision(c, r) {
    const cx = Math.max(r.x, Math.min(c.x, r.x + r.w));
    const cy = Math.max(r.y, Math.min(c.y, r.y + r.h));
    let dx = c.x - cx;
    let dy = c.y - cy;
    const distSq = dx * dx + dy * dy;

    if (distSq < c.r * c.r) {
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

    return { hit: false };
}

export function resolveBallCollision(b1, b2) {
    let dx = b2.x - b1.x;
    let dy = b2.y - b1.y;
    const distSq = dx * dx + dy * dy;
    const minDist = b1.r + b2.r;

    if (distSq < minDist * minDist) {
        let dist = Math.sqrt(distSq);

        if (dist === 0) {
            dx = 1;
            dy = 0;
            dist = 1;
        }

        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        const force = overlap * 0.45;

        b1.vx -= nx * force;
        b1.vy -= ny * force;
        b2.vx += nx * force;
        b2.vy += ny * force;

        if (overlap > 0.1) {
            b1.isStatic = false;
            b2.isStatic = false;
        }

        b1.x -= nx * overlap * 0.05;
        b1.y -= ny * overlap * 0.05;
        b2.x += nx * overlap * 0.05;
        b2.y += ny * overlap * 0.05;
    }
}
