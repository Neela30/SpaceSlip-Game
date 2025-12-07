import { drawRoundedRect } from './drawing';
import { clamp } from './physics';
import { randRange } from './util';

export const ALIEN_CONFIG = {
  START_SCORE: 20,
  WIDTH: 28,
  HEIGHT: 22,
  WALK_SPEED: 0.2,
  BULLET_SPEED: 3.6,
  MIN_COOLDOWN: 900,
  MAX_COOLDOWN: 1900,
  BULLET_RADIUS: 3.5,
  COUNT: 2,
  FIRE_DELAY: 3000,
  SAFE_MARGIN: 12,
  MAX_NON_LETHAL_HITS: 3
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
      speed: ALIEN_CONFIG.WALK_SPEED + Math.random() * 0.12,
      cooldown: randRange(ALIEN_CONFIG.MIN_COOLDOWN, ALIEN_CONFIG.MAX_COOLDOWN),
      lastShot: now + ALIEN_CONFIG.FIRE_DELAY + idx * 220,
      laneIndex: idx
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

export const updateAliensForFrame = (state, { delta, now, gapX, gapWidth, gameWidth }) => {
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

    const readyToShoot = now - alien.lastShot >= alien.cooldown;
    if (readyToShoot && state.bulletsRef.current.length < 14) {
      state.bulletsRef.current.push({
        x: alien.x + ALIEN_CONFIG.WIDTH / 2,
        y: alien.y - 6,
        vy: -ALIEN_CONFIG.BULLET_SPEED - Math.random() * 1.2
      });
      alien.lastShot = now;
      alien.cooldown = randRange(ALIEN_CONFIG.MIN_COOLDOWN, ALIEN_CONFIG.MAX_COOLDOWN);
    }
  });
};

export const updateAlienBullets = (state, { delta, shapeBounds, gameHeight, onHit }) => {
  if (!state.activeRef.current || state.bulletsRef.current.length === 0) return { hit: false, lethal: false };
  let hit = false;
  const sx = shapeBounds.x - ALIEN_CONFIG.BULLET_RADIUS;
  const sy = shapeBounds.y - ALIEN_CONFIG.BULLET_RADIUS;
  const sw = shapeBounds.width + ALIEN_CONFIG.BULLET_RADIUS * 2;
  const sh = shapeBounds.height + ALIEN_CONFIG.BULLET_RADIUS * 2;

  state.bulletsRef.current = state.bulletsRef.current.filter((b) => {
    b.y += b.vy * delta;
    if (b.y < -20) return false;
    if (b.x >= sx && b.x <= sx + sw && b.y >= sy && b.y <= sy + sh) {
      hit = true;
      return false;
    }
    return b.y <= gameHeight + 30;
  });

  if (hit) {
    state.shapeDamageRef.current += 1;
    state.totalHitsRef.current += 1;
    const lethal = state.totalHitsRef.current > ALIEN_CONFIG.MAX_NON_LETHAL_HITS;
    if (onHit) onHit(lethal, shapeBounds);
    return { hit: true, lethal };
  }
  return { hit: false, lethal: false };
};

export const drawAlien = (ctx, alien, now) => {
  ctx.save();
  ctx.translate(alien.x, alien.y);
  const sway = Math.sin(now / 420 + alien.x * 0.03) * 1.2;
  const stride = Math.sin(now / 260 + alien.x * 0.08) * 2.6;
  ctx.translate(0, sway);

  const facing = alien.dir >= 0 ? 1 : -1;

  ctx.fillStyle = '#2e1b4d';
  ctx.save();
  ctx.translate(ALIEN_CONFIG.WIDTH / 2, ALIEN_CONFIG.HEIGHT - 1.5);
  ctx.rotate((stride * Math.PI) / 360);
  ctx.fillRect(-ALIEN_CONFIG.WIDTH / 2 + 1, -1, 6, 2);
  ctx.rotate((-stride * 2 * Math.PI) / 360);
  ctx.fillRect(ALIEN_CONFIG.WIDTH / 2 - 7, -1, 6, 2);
  ctx.restore();

  const torsoFill = ctx.createLinearGradient(0, 0, 0, ALIEN_CONFIG.HEIGHT);
  torsoFill.addColorStop(0, '#8a5bff');
  torsoFill.addColorStop(1, '#44c0ff');
  drawRoundedRect(ctx, 2, 6, ALIEN_CONFIG.WIDTH - 4, ALIEN_CONFIG.HEIGHT - 6, 7, torsoFill, 'rgba(255,255,255,0.18)');

  ctx.beginPath();
  ctx.arc(ALIEN_CONFIG.WIDTH / 2, 4, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#f5f3ff';
  ctx.fill();
  ctx.fillStyle = '#1b0f32';
  ctx.fillRect(ALIEN_CONFIG.WIDTH / 2 - 5, 2, 4, 3);
  ctx.fillRect(ALIEN_CONFIG.WIDTH / 2 + 1, 2, 4, 3);

  ctx.save();
  ctx.translate(ALIEN_CONFIG.WIDTH / 2, ALIEN_CONFIG.HEIGHT / 2 + 2);
  ctx.scale(facing, 1);
  ctx.fillStyle = '#51ffe6';
  ctx.fillRect(5, -2 + stride * 0.1, 10, 4);
  ctx.fillStyle = '#2ae6be';
  ctx.fillRect(14, -3 + stride * 0.1, 5, 6);
  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(4, ALIEN_CONFIG.HEIGHT - 8, ALIEN_CONFIG.WIDTH - 8, 3);
  ctx.fillStyle = '#ffcf70';
  ctx.fillRect(ALIEN_CONFIG.WIDTH / 2 - 3, ALIEN_CONFIG.HEIGHT - 9, 6, 2);

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
