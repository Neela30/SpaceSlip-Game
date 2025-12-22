import { drawRoundedRect } from './drawing';
import { clamp } from './physics';
import { randRange } from './util';

export const ALIEN_CONFIG = {
  START_SCORE: 20,
  WIDTH: 30,
  HEIGHT: 24,
  WALK_SPEED: 0.22,

  BULLET_SPEED: 4.0,
  BULLET_SPEED_JITTER: 0.9,
  MIN_COOLDOWN: 900,
  MAX_COOLDOWN: 1900,
  BULLET_RADIUS: 3.5,
  COUNT: 2,
  FIRE_DELAY: 3000,
  SAFE_MARGIN: 12,
  SHAPE_LIVES: 2,


  AIM_TIME_MS: 420,
  LEAD_FACTOR: 0.35
};

export const createAlienState = () => ({
  aliensRef: { current: [] },
  bulletsRef: { current: [] },
  activeRef: { current: false },
  totalHitsRef: { current: 0 },
  shapeDamageRef: { current: 0 }
});

export const resetAliensState = (state) => {
  state.aliensRef.current = [];
  state.bulletsRef.current = [];
  state.activeRef.current = false;
  state.totalHitsRef.current = 0;
  state.shapeDamageRef.current = 0;
};

const buildLanes = ({ gapX, gapWidth, gameWidth }) => {
  const gapStart = clamp(gapX, 0, gameWidth - gapWidth);
  const gapEnd = clamp(gapStart + gapWidth, gapStart, gameWidth);
  const margin = ALIEN_CONFIG.SAFE_MARGIN;

  const leftLane = { min: 6, max: Math.max(8, gapStart - margin - ALIEN_CONFIG.WIDTH) };
  const rightLane = {
    min: Math.min(gameWidth - ALIEN_CONFIG.WIDTH - 6, gapEnd + margin),
    max: gameWidth - ALIEN_CONFIG.WIDTH - 6
  };
  return [leftLane, rightLane];
};

export const spawnAlienWave = (state, { wallY, gapX, gapWidth, gameWidth, now = performance.now() }) => {
  const yBase = Math.max(0, wallY - ALIEN_CONFIG.HEIGHT - 4);
  const lanes = buildLanes({ gapX, gapWidth, gameWidth }).slice(0, ALIEN_CONFIG.COUNT);

  state.aliensRef.current = lanes.map((lane, idx) => {
    const usable = Math.max(0, lane.max - lane.min);
    const pos = usable > 2 ? lane.min + Math.random() * usable : lane.min;

    return {
      x: clamp(pos, lane.min, lane.max),
      y: yBase,
      dir: Math.random() > 0.5 ? 1 : -1,
      speed: ALIEN_CONFIG.WALK_SPEED + Math.random() * 0.14,
      cooldown: randRange(ALIEN_CONFIG.MIN_COOLDOWN, ALIEN_CONFIG.MAX_COOLDOWN),
      lastShot: now + ALIEN_CONFIG.FIRE_DELAY + idx * 220,
      laneIndex: idx,


      aiming: false,
      aimUntil: 0,
      aimTarget: { x: 0, y: 0 },
      face: 1
    };
  });

  state.activeRef.current = true;
};

export const maybeActivateAliens = (state, score, spawnFn) => {
  if (!state.activeRef.current && score >= ALIEN_CONFIG.START_SCORE) {
    spawnFn();
    return true;
  }
  return false;
};


export const updateAliensForFrame = (
  state,
  { delta, now, gapX, gapWidth, gameWidth, targetX, targetY, targetVX = 0, targetVY = 0 }
) => {
  if (!state.activeRef.current) return;

  const lanes = buildLanes({ gapX, gapWidth, gameWidth });
  const leftBounds = lanes[0];
  const rightBounds = lanes[1];

  state.aliensRef.current.forEach((alien) => {

    alien.x += alien.dir * alien.speed * delta;

    const lane = alien.laneIndex === 1 ? rightBounds : leftBounds;
    const min = lane.min;
    const max = Math.max(min, lane.max);

    if (alien.x <= min) {
      alien.x = min;
      alien.dir = 1;
    } else if (alien.x >= max) {
      alien.x = max;
      alien.dir = -1;
    }


    if (Number.isFinite(targetX)) {
      alien.face = targetX >= alien.x ? 1 : -1;
    } else {
      alien.face = alien.dir >= 0 ? 1 : -1;
    }


    const readyToShoot = now - alien.lastShot >= alien.cooldown;
    const bulletCapOk = state.bulletsRef.current.length < 16;

    if (!readyToShoot || !bulletCapOk || !Number.isFinite(targetX) || !Number.isFinite(targetY)) {
      alien.aiming = false;
      return;
    }


    if (!alien.aiming) {
      alien.aiming = true;
      alien.aimUntil = now + ALIEN_CONFIG.AIM_TIME_MS;
      alien.aimTarget = {
        x: targetX + targetVX * ALIEN_CONFIG.LEAD_FACTOR * 12,
        y: targetY + targetVY * ALIEN_CONFIG.LEAD_FACTOR * 12
      };
      return;
    }


    if (now < alien.aimUntil) return;


    alien.aiming = false;

    const muzzleX = alien.x + ALIEN_CONFIG.WIDTH / 2;
    const muzzleY = alien.y - 6;

    const tx = alien.aimTarget.x;
    const ty = alien.aimTarget.y;

    const dx = tx - muzzleX;
    const dy = ty - muzzleY;


    const safeDy = dy < -8 ? dy : -80;
    const len = Math.max(1, Math.hypot(dx, safeDy));
    const nx = dx / len;
    const ny = safeDy / len;

    const speed = ALIEN_CONFIG.BULLET_SPEED + Math.random() * ALIEN_CONFIG.BULLET_SPEED_JITTER;

    state.bulletsRef.current.push({
      x: muzzleX,
      y: muzzleY,
      vx: nx * speed,
      vy: ny * speed
    });

    alien.lastShot = now;
    alien.cooldown = randRange(ALIEN_CONFIG.MIN_COOLDOWN, ALIEN_CONFIG.MAX_COOLDOWN);
  });
};

export const updateAlienBullets = (state, { delta, shapeBounds, gameHeight, onHit }) => {
  if (!state.activeRef.current || state.bulletsRef.current.length === 0) return { hit: false, lethal: false };

  let hit = false;
  let hits = 0;

  const sx = shapeBounds.x - ALIEN_CONFIG.BULLET_RADIUS;
  const sy = shapeBounds.y - ALIEN_CONFIG.BULLET_RADIUS;
  const sw = shapeBounds.width + ALIEN_CONFIG.BULLET_RADIUS * 2;
  const sh = shapeBounds.height + ALIEN_CONFIG.BULLET_RADIUS * 2;

  state.bulletsRef.current = state.bulletsRef.current.filter((b) => {
    b.x += (b.vx ?? 0) * delta;
    b.y += (b.vy ?? 0) * delta;

    if (b.y < -40) return false;

    if (b.x >= sx && b.x <= sx + sw && b.y >= sy && b.y <= sy + sh) {
      hit = true;
      hits += 1;
      return false;
    }

    return b.y <= gameHeight + 40;
  });

  if (hit) {
    state.shapeDamageRef.current += hits;
    state.totalHitsRef.current += hits;
    const lethal = state.shapeDamageRef.current >= ALIEN_CONFIG.SHAPE_LIVES;
    if (onHit) onHit(lethal, shapeBounds);
    return { hit: true, lethal };
  }

  return { hit: false, lethal: false };
};


export const drawAlien = (ctx, alien, now) => {
  const W = ALIEN_CONFIG.WIDTH;
  const H = ALIEN_CONFIG.HEIGHT;

  ctx.save();
  ctx.translate(alien.x, alien.y);


  const t = now / 1000;
  const stride = Math.sin(t * 9 + alien.x * 0.06) * 1.8;
  const bob = Math.sin(t * 6 + alien.x * 0.03) * 0.7;
  const aimPulse = alien.aiming ? (0.6 + Math.sin(now / 80) * 0.4) : 0;

  const facing = alien.face ?? (alien.dir >= 0 ? 1 : -1);
  ctx.translate(0, bob);


  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  drawRoundedRect(ctx, 3, H - 4, W - 6, 4, 2, 'rgba(0,0,0,0.25)');
  ctx.restore();


  ctx.save();
  ctx.translate(W / 2, 12);
  ctx.scale(facing, 1);
  drawRoundedRect(ctx, -W * 0.46, 2, 8, 14, 4, 'rgba(30,18,60,0.9)', 'rgba(255,255,255,0.10)');
  ctx.restore();


  ctx.save();
  ctx.translate(W / 2, H - 2);
  ctx.scale(facing, 1);
  ctx.fillStyle = '#2a1648';

  ctx.save();
  ctx.rotate((stride * Math.PI) / 180);
  drawRoundedRect(ctx, -W * 0.22, -2, 6, 8, 3, '#2a1648');
  ctx.restore();

  ctx.save();
  ctx.rotate((-stride * Math.PI) / 180);
  drawRoundedRect(ctx, W * 0.16, -2, 6, 8, 3, '#2a1648');
  ctx.restore();
  ctx.restore();


  const torsoGrad = ctx.createLinearGradient(0, 6, 0, H);
  torsoGrad.addColorStop(0, '#7e4dff');
  torsoGrad.addColorStop(1, '#35ccff');
  drawRoundedRect(ctx, 4, 10, W - 8, H - 10, 9, torsoGrad, 'rgba(255,255,255,0.16)');


  ctx.save();
  ctx.translate(W / 2, 8);
  ctx.scale(facing, 1);

  const headGlow = ctx.createRadialGradient(0, -2, 2, 0, 2, 14);
  headGlow.addColorStop(0, 'rgba(180,255,245,0.95)');
  headGlow.addColorStop(1, 'rgba(130,190,255,0.20)');
  ctx.fillStyle = headGlow;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 9, 0, 0, Math.PI * 2);
  ctx.stroke();


  ctx.fillStyle = '#140b2c';
  ctx.beginPath();
  ctx.ellipse(-4, 1, 3.2, 4.2, -0.15, 0, Math.PI * 2);
  ctx.ellipse(4, 1, 3.2, 4.2, 0.15, 0, Math.PI * 2);
  ctx.fill();


  ctx.fillStyle = 'rgba(120,255,240,0.95)';
  ctx.fillRect(-5.2, -1, 1.2, 1.2);
  ctx.fillRect(2.8, -1, 1.2, 1.2);


  ctx.strokeStyle = 'rgba(120,255,240,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.quadraticCurveTo(3 * facing, -12, 6 * facing, -13);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 200, 120, 0.95)';
  ctx.beginPath();
  ctx.arc(6 * facing, -13, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();


  ctx.save();
  ctx.translate(W / 2, 16);
  ctx.scale(facing, 1);

  const armY = 2 + stride * 0.2 + aimPulse * 0.6;
  drawRoundedRect(ctx, 2, armY, 10, 5, 3, '#57f6cd', 'rgba(0,0,0,0.18)');


  drawRoundedRect(ctx, 10, armY - 1, 10, 7, 3, '#2ae6be', 'rgba(255,255,255,0.12)');
  drawRoundedRect(ctx, 18, armY + 1, 6, 3, 2, '#ffcf70');


  if (alien.aiming) {
    ctx.globalAlpha = 0.35 + 0.25 * aimPulse;
    ctx.fillStyle = 'rgba(255, 237, 150, 0.9)';
    ctx.beginPath();
    ctx.arc(24, armY + 2, 2.2 + aimPulse, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  ctx.restore();
};

export const drawAlienShots = (ctx, state) => {
  if (!state.activeRef.current) return;
  state.bulletsRef.current.forEach((bullet) => drawAlienBullet(ctx, bullet));
};

export const drawAliens = (ctx, state, now) => {
  if (!state.activeRef.current) return;
  state.aliensRef.current.forEach((alien) => drawAlien(ctx, alien, now));
};

export const drawAlienBullet = (ctx, bullet) => {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);

  const glow = ctx.createRadialGradient(0, 0, 0.5, 0, 0, ALIEN_CONFIG.BULLET_RADIUS * 2.2);
  glow.addColorStop(0, 'rgba(255, 237, 150, 0.95)');
  glow.addColorStop(1, 'rgba(255, 140, 64, 0.15)');

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, ALIEN_CONFIG.BULLET_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};
