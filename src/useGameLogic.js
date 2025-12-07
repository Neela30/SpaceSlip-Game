import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAlienState,
  drawAlienShots,
  drawAliens,
  maybeActivateAliens,
  resetAliensState,
  spawnAlienWave,
  updateAlienBullets,
  updateAliensForFrame
} from './game/aliens';

const GAME_WIDTH = 360;
const GAME_HEIGHT = 640;
const LONG_SIDE = 138;
const SHORT_SIDE = 46;
const WALL_HEIGHT = 18;
const INITIAL_GAP = 210;
const MIN_GAP = 74;
const INITIAL_SPEED = 1.1;
const SPEED_STEP = 0.2;
const GAP_SHRINK = 6.4;
const INITIAL_DRIFT = 8;
const DRIFT_STEP = 0.9;
const MAX_DRIFT = 40;
const MAX_SPEED = 11;
const PERFECT_TOLERANCE = 12;
const FALL_MULTIPLIER = 1.7;
const ROTATION_STEP = 90;
const TRAIL_LENGTH = 8;
const MAX_PARTICLES = 140;
const STAR_COUNT = 42;
const HITBOX_INSET = 8;
const VISUAL_SCALE = 1.12;
const REWARD_FIRST_SCORE = 10;
const REWARD_INTERVAL = 4;
const REWARD_SIZE = 28;
const REWARD_GAP_BONUS = 28;
const REWARD_SPEED_SCALE = 0.72;
const SAT_BODY = { w: 36, h: 36 };
const SAT_PANEL = { w: 52, h: 22 };
const SAT_ARM = 18;

const SHAPE_VARIANTS = [
  {
    id: 'rectangle',
    kind: 'rectangle',
    long: LONG_SIDE,
    short: SHORT_SIDE,
    palette: [
      ['#0f4b7a', '#18b7ff'],
      ['#0e2f52', '#1cc8ff']
    ]
  },
  {
    id: 'square',
    kind: 'square',
    size: 92,
    palette: [
      ['#2c3f68', '#33c7ff'],
      ['#1f2a44', '#5be0ff']
    ]
  },
  {
    id: 'circle',
    kind: 'circle',
    size: 88,
    palette: [
      ['#3a4f6f', '#9edcff'],
      ['#2f3855', '#67b8ff']
    ]
  },
  {
    id: 'triangle',
    kind: 'triangle',
    size: 110,
    palette: [
      ['#1d2a46', '#58e4ff'],
      ['#1b1f36', '#3ad2ff']
    ]
  }
];

const SHAPE_LOOKUP = SHAPE_VARIANTS.reduce((acc, shape) => {
  acc[shape.id] = shape;
  return acc;
}, {});

const SHAPE_ORDER = ['circle', 'square', 'rectangle', 'triangle'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const lerp = (a, b, t) => a + (b - a) * t;

const drawRoundedRect = (ctx, x, y, width, height, radius, fillStyle, strokeStyle) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
};

const createStarfield = () =>
  Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    depth: 0.5 + Math.random() * 1.5
  }));

const driftOffsetForMode = (time, amplitude, mode, phase) => {
  return Math.sin(time / 700 + phase) * amplitude;
};

const drawStar = (ctx, { x, y, radius, rotation = 0, fill = '#ffd166', glow = 'rgba(255, 209, 102, 0.6)' }) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  const spikes = 5;
  const inner = radius * 0.48;
  for (let i = 0; i < spikes; i++) {
    const outerAngle = (i * 2 * Math.PI) / spikes - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / spikes;
    ctx.lineTo(Math.cos(outerAngle) * radius, Math.sin(outerAngle) * radius);
    ctx.lineTo(Math.cos(innerAngle) * inner, Math.sin(innerAngle) * inner);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.restore();
};

const renderShape = (ctx, { x, y, width, height, rotation, type, colors, alpha = 1, scale = 1 }) => {
  const [c1, c2] = colors;
  const size = Math.max(width, height);
  const cx = x + width / 2;
  const cy = y + height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;

  const drawSatellite = () => {
    const panelW = Math.max(28, size * 0.32);
    const panelH = Math.max(14, size * 0.16);
    const arm = Math.max(10, size * 0.1);
    const panelFill = ctx.createLinearGradient(-panelW, -panelH / 2, panelW, panelH / 2);
    panelFill.addColorStop(0, '#0a2440');
    panelFill.addColorStop(1, '#0d4c80');
    const panelStroke = 'rgba(120, 210, 255, 0.35)';
    drawRoundedRect(ctx, -panelW - arm, -panelH / 2, panelW, panelH, 6, panelFill, panelStroke);
    drawRoundedRect(ctx, arm, -panelH / 2, panelW, panelH, 6, panelFill, panelStroke);

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    [-6, 0, 6].forEach((yLine) => {
      ctx.beginPath();
      ctx.moveTo(-panelW - arm + 4, yLine);
      ctx.lineTo(-arm - 4, yLine);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(arm + 4, yLine);
      ctx.lineTo(panelW + arm - 4, yLine);
      ctx.stroke();
    });

    const bodyW = Math.max(26, size * 0.28);
    const bodyH = Math.max(26, size * 0.28);
    const bodyFill = ctx.createLinearGradient(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2);
    bodyFill.addColorStop(0, c1);
    bodyFill.addColorStop(1, c2);
    drawRoundedRect(ctx, -bodyW / 2, -bodyH / 2, bodyW, bodyH, 8, bodyFill, 'rgba(255,255,255,0.25)');

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(200,230,255,0.8)';
    ctx.lineWidth = 2;
    ctx.arc(0, -bodyH / 2 - 8, 10, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -bodyH / 2);
    ctx.lineTo(0, -bodyH / 2 - 8);
    ctx.stroke();

    ctx.fillStyle = 'rgba(120,230,255,0.9)';
    ctx.fillRect(-4, -4, 2, 2);
    ctx.fillRect(2, -8, 2, 2);
    ctx.fillRect(6, 6, 2, 2);

    ctx.fillStyle = 'rgba(255,180,120,0.9)';
    ctx.beginPath();
    ctx.moveTo(-4, bodyH / 2);
    ctx.lineTo(0, bodyH / 2 + 12 + Math.sin(performance.now() / 80) * 2);
    ctx.lineTo(4, bodyH / 2);
    ctx.closePath();
    ctx.fill();
  };

  const drawPod = () => {
    const bodySize = size * 0.65;
    const radius = Math.max(8, bodySize * 0.18);
    const bodyFill = ctx.createLinearGradient(-bodySize / 2, -bodySize / 2, bodySize / 2, bodySize / 2);
    bodyFill.addColorStop(0, '#1a2744');
    bodyFill.addColorStop(1, '#2f8acb');
    drawRoundedRect(ctx, -bodySize / 2, -bodySize / 2, bodySize, bodySize, radius, bodyFill, 'rgba(255,255,255,0.2)');
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(-bodySize / 2 + 6, -bodySize / 2 + 6, bodySize - 12, bodySize - 12);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(120,230,255,0.9)';
    ctx.fillRect(-4, -4, 3, 3);
    ctx.fillRect(2, 2, 3, 3);
  };

  const drawProbe = () => {
    const orbR = size * 0.34;
    const orbFill = ctx.createRadialGradient(0, 0, orbR * 0.3, 0, 0, orbR);
    orbFill.addColorStop(0, '#9edcff');
    orbFill.addColorStop(1, '#3a4f6f');
    ctx.beginPath();
    ctx.arc(0, 0, orbR, 0, Math.PI * 2);
    ctx.fillStyle = orbFill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(120, 230, 255, 0.7)';
    ctx.lineWidth = 3;
    const armLen = orbR * 1.6;
    [0, 120, 240].forEach((deg) => {
      const rad = (deg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(Math.cos(rad) * (orbR * 0.6), Math.sin(rad) * (orbR * 0.6));
      ctx.lineTo(Math.cos(rad) * armLen, Math.sin(rad) * armLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(Math.cos(rad) * armLen, Math.sin(rad) * armLen, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,210,255,0.8)';
      ctx.fill();
    });
  };

  const drawRocket = () => {
    const bodyH = Math.max(size * 0.9, 70);
    const bodyW = Math.max(size * 0.45, 28);
    const noseH = bodyH * 0.25;
    const finH = bodyH * 0.18;
    const finW = bodyW * 0.65;

    ctx.fillStyle = '#22314f';
    ctx.beginPath();
    ctx.moveTo(-bodyW / 2, bodyH / 2);
    ctx.lineTo(-bodyW / 2 - finW, bodyH / 2 + finH);
    ctx.lineTo(-bodyW / 2, bodyH / 2 + finH * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bodyW / 2, bodyH / 2);
    ctx.lineTo(bodyW / 2 + finW, bodyH / 2 + finH);
    ctx.lineTo(bodyW / 2, bodyH / 2 + finH * 0.2);
    ctx.closePath();
    ctx.fill();

    const bodyFill = ctx.createLinearGradient(0, -bodyH / 2, 0, bodyH / 2);
    bodyFill.addColorStop(0, '#1b2a46');
    bodyFill.addColorStop(1, '#3ad2ff');
    drawRoundedRect(ctx, -bodyW / 2, -bodyH / 2, bodyW, bodyH, 14, bodyFill, 'rgba(255,255,255,0.18)');

    ctx.fillStyle = 'rgba(255, 184, 94, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-bodyW / 4, bodyH / 2);
    ctx.lineTo(0, bodyH / 2 + 18 + Math.sin(performance.now() / 90) * 2);
    ctx.lineTo(bodyW / 4, bodyH / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(120,230,255,0.9)';
    ctx.beginPath();
    ctx.arc(0, -bodyH / 2 + noseH * 0.4, bodyW * 0.18, 0, Math.PI * 2);
    ctx.fill();
  };

  if (type === 'rectangle') {
    drawSatellite();
  } else if (type === 'square') {
    drawPod();
  } else if (type === 'circle') {
    drawProbe();
  } else {
    drawRocket();
  }

  ctx.restore();
};

const useGameLogic = () => {
  const canvasRef = useRef(null);
  const [shapeX, setShapeX] = useState((GAME_WIDTH - LONG_SIDE) / 2);
  const shapeXRef = useRef((GAME_WIDTH - LONG_SIDE) / 2);
  const [shapeY, setShapeY] = useState(-SHORT_SIDE * 1.5);
  const shapeYRef = useRef(-SHORT_SIDE * 1.5);
  const [shapeRotation, setShapeRotation] = useState(0);
  const rotationRef = useRef(0);
  const [shapeType, setShapeType] = useState('rectangle');
  const shapeTypeRef = useRef('rectangle');
  const shapeColorsRef = useRef(['#4df3c9', '#7dd8ff']);
  const shapeOrderIndexRef = useRef(0);
  const initialWallY = Math.round(GAME_HEIGHT * 0.82);
  const [wallY, setWallY] = useState(initialWallY);
  const wallYRef = useRef(initialWallY);
  const [gapX, setGapX] = useState((GAME_WIDTH - INITIAL_GAP) / 2);
  const gapXRef = useRef((GAME_WIDTH - INITIAL_GAP) / 2);
  const [gapWidth, setGapWidth] = useState(INITIAL_GAP);
  const gapWidthRef = useRef(INITIAL_GAP);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const speedRef = useRef(INITIAL_SPEED);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [perfectActive, setPerfectActive] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const highScoreRef = useRef(0);
  const driftAmplitudeRef = useRef(INITIAL_DRIFT);
  const perfectTimerRef = useRef(null);
  const rafRef = useRef(null);
  const activeGapXRef = useRef(gapXRef.current);
  const audioCtxRef = useRef(null);
  const runningRef = useRef(false);
  const particlesRef = useRef([]);
  const trailRef = useRef([]);
  const starfieldRef = useRef([]);
  const driftModeRef = useRef('sine');
  const driftPhaseRef = useRef(0);
  const shakeRef = useRef(0);
  const squashRef = useRef(1);
  const [timeToDrop, setTimeToDrop] = useState(null);
  const lastEtaUpdateRef = useRef(0);
  const [rewardActive, setRewardActive] = useState(false);
  const rewardPosRef = useRef({ x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.35 });
  const nextRewardScoreRef = useRef(REWARD_FIRST_SCORE);
  const alienStateRef = useRef(createAlienState());
  const { shapeDamageRef, totalHitsRef } = alienStateRef.current;

  const ensureAudioContext = useCallback(() => {
    if (audioCtxRef.current) return audioCtxRef.current;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }, []);

  const playTone = useCallback(
    (frequency, duration = 120, volume = 0.08) => {
      const ctx = ensureAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      osc.type = 'sine';
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration / 1000 + 0.05);
    },
    [ensureAudioContext]
  );

  const playClick = useCallback(() => playTone(520, 90, 0.06), [playTone]);
  const playChime = useCallback(() => {
    playTone(880, 130, 0.08);
    setTimeout(() => playTone(660, 120, 0.06), 20);
  }, [playTone]);
  const playFail = useCallback(() => playTone(210, 240, 0.09), [playTone]);

  const vibrate = useCallback((ms = 120) => {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }, []);

  const getShapeSize = useCallback((rotation = rotationRef.current, type = shapeTypeRef.current) => {
    const variant = SHAPE_LOOKUP[type] || SHAPE_VARIANTS[0];
    let width = LONG_SIDE;
    let height = SHORT_SIDE;
    let insetX = HITBOX_INSET;
    let insetY = HITBOX_INSET;

    if (variant.kind === 'rectangle') {
      insetX = 18;
      insetY = 10;
      if (rotation % 180 === 0) {
        width = variant.long;
        height = variant.short;
      } else {
        width = variant.short;
        height = variant.long;
      }
    } else if (variant.kind === 'square') {
      insetX = insetY = 12;
      width = variant.size;
      height = variant.size;
    } else if (variant.kind === 'circle') {
      insetX = insetY = 14;
      width = variant.size;
      height = variant.size;
    } else if (variant.kind === 'triangle') {
      insetX = 16;
      insetY = 12;
      const base = variant.size * 0.82;
      const triHeight = base * 0.9;
      if (rotation % 180 === 0) {
        width = base;
        height = triHeight;
      } else {
        width = triHeight;
        height = base;
      }
    }

    return {
      width: Math.max(16, width - insetX * 2),
      height: Math.max(16, height - insetY * 2)
    };
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = GAME_WIDTH * dpr;
    canvas.height = GAME_HEIGHT * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }, []);

  useEffect(() => {
    resizeCanvas();
    starfieldRef.current = createStarfield();
    const stored = Number(localStorage.getItem('perfect-fit-highscore') || 0);
    if (!Number.isNaN(stored)) {
      setHighScore(stored);
      highScoreRef.current = stored;
    }
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resizeCanvas]);

  const drawFrame = useCallback(
    (currentGapX = activeGapXRef.current, overrideY, now = performance.now(), delta = 1) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      const shake = shakeRef.current;
      if (shake > 0.2) {
        const k = shakeRef.current;
        const jitterX = (Math.random() - 0.5) * k;
        const jitterY = (Math.random() - 0.5) * k;
        ctx.translate(jitterX, jitterY);
        shakeRef.current = lerp(shakeRef.current, 0, 0.08 * delta);
      }

      const bgGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      bgGrad.addColorStop(0, '#0c162b');
      bgGrad.addColorStop(1, '#0a1020');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Planet limb glow
      const planet = ctx.createRadialGradient(GAME_WIDTH * 0.9, GAME_HEIGHT * 0.2, 40, GAME_WIDTH * 0.85, GAME_HEIGHT * 0.15, 260);
      planet.addColorStop(0, 'rgba(80, 140, 255, 0.22)');
      planet.addColorStop(1, 'rgba(10, 16, 32, 0)');
      ctx.fillStyle = planet;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#6ee7f0';
      for (let i = 0; i <= GAME_HEIGHT; i += 64) {
        ctx.fillRect(0, i, GAME_WIDTH, 1);
      }
      ctx.restore();

      // Parallax starfield
      ctx.save();
      starfieldRef.current.forEach((star) => {
        const speed = (0.35 + star.depth * 0.8) * delta;
        star.y += speed;
        if (star.y > GAME_HEIGHT + 4) {
          star.y = -4;
          star.x = Math.random() * GAME_WIDTH;
        }
        ctx.globalAlpha = 0.4 + star.depth * 0.35;
        ctx.fillStyle = '#86e4ff';
        ctx.fillRect(star.x, star.y, 1.2 + star.depth * 0.8, 1.2 + star.depth * 0.8);
      });
      ctx.restore();

      const wallTop = wallYRef.current;
      const gapSize = gapWidthRef.current;
      const narrowness = clamp(1 - (gapSize - MIN_GAP) / (INITIAL_GAP - MIN_GAP), 0, 1);
      const pulse = 0.4 + Math.sin(now / 240) * 0.2 * narrowness;
      ctx.save();
      ctx.shadowColor = `rgba(86, 206, 255, ${0.35 + 0.25 * pulse})`;
      ctx.shadowBlur = 24 + pulse * 12;
      ctx.fillStyle = '#0a1525';
      ctx.fillRect(0, wallTop, currentGapX, WALL_HEIGHT);
      ctx.fillRect(currentGapX + gapSize, wallTop, GAME_WIDTH - (currentGapX + gapSize), WALL_HEIGHT);
      ctx.restore();
      ctx.save();
      ctx.fillStyle = `rgba(140, 226, 255, ${0.45 + 0.3 * narrowness})`;
      ctx.fillRect(0, wallTop - 2, currentGapX, 2);
      ctx.fillRect(currentGapX + gapSize, wallTop - 2, GAME_WIDTH - (currentGapX + gapSize), 2);
      ctx.restore();

      // Docking ring ticks
      ctx.save();
      ctx.fillStyle = 'rgba(120, 220, 255, 0.4)';
      const tickWidth = 8;
      const tickHeight = 3;
      for (let i = 0; i < 4; i++) {
        const offset = i * 18;
        ctx.fillRect(currentGapX - tickWidth - 4, wallTop + offset, tickWidth, tickHeight);
        ctx.fillRect(currentGapX + gapSize + 4, wallTop + offset + tickHeight, tickWidth, tickHeight);
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.moveTo(currentGapX, wallTop + WALL_HEIGHT / 2);
      ctx.lineTo(currentGapX + gapSize, wallTop + WALL_HEIGHT / 2);
      ctx.stroke();
      ctx.restore();

      drawAliens(ctx, alienStateRef.current, now);

      // Trail
      ctx.save();
      trailRef.current.forEach((snap, idx) => {
        const alpha = 0.24 - idx * 0.02;
        if (alpha <= 0) return;
        const { width, height } = getShapeSize(snap.rotation, snap.type);
        renderShape(ctx, {
          x: snap.x,
          y: snap.y,
          width,
          height,
          rotation: snap.rotation,
          type: snap.type,
          colors: snap.colors,
          alpha,
          scale: (0.98 - idx * 0.02) * VISUAL_SCALE
        });
      });
      ctx.restore();

      // Particles
      ctx.save();
      particlesRef.current = particlesRef.current.filter((p) => p.life < p.maxLife);
      particlesRef.current.forEach((p) => {
        p.life += delta * 16;
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.vy += 0.02 * delta;
        const lifeRatio = Math.max(0, 1 - p.life / p.maxLife);
        if (lifeRatio <= 0) return;
        ctx.globalAlpha = lifeRatio * 0.8;
        ctx.fillStyle = p.color;
        if (p.kind === 'shard') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot || 0);
          ctx.fillRect(-p.size * 0.6, -p.size * 0.3, p.size * 1.2, p.size * 0.6);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.restore();

      if (rewardActive) {
        const { x: rx, y: ry } = rewardPosRef.current;
        drawStar(ctx, {
          x: rx,
          y: ry,
          radius: REWARD_SIZE / 2,
          rotation: now / 400,
          fill: '#ffd166',
          glow: 'rgba(255, 209, 102, 0.5)'
        });
      }

      const { width: shapeWidth, height: shapeHeight } = getShapeSize();
      const rectY = overrideY !== undefined ? overrideY : shapeYRef.current;
      ctx.save();
      const damageHits = shapeDamageRef.current;
      const shadowAlpha = damageHits > 0 ? 0.18 : 0.4;
      ctx.shadowColor = `rgba(87, 246, 205, ${shadowAlpha})`;
      ctx.shadowBlur = damageHits > 0 ? 16 : 28;
      const easedSquash = lerp(squashRef.current, 1, 0.08 * delta);
      squashRef.current = easedSquash;
      renderShape(ctx, {
        x: shapeXRef.current,
        y: rectY,
        width: shapeWidth,
        height: shapeHeight,
        rotation: rotationRef.current,
        type: shapeTypeRef.current,
        colors: shapeColorsRef.current,
        alpha: damageHits > 0 ? 0.82 : 1,
        scale: easedSquash * VISUAL_SCALE * (damageHits > 0 ? 0.98 : 1)
      });
      ctx.restore();

      drawAlienShots(ctx, alienStateRef.current);

      if (perfectActive) {
        ctx.save();
        const ribbonY = GAME_HEIGHT * 0.28;
        const gradient = ctx.createLinearGradient(0, ribbonY, GAME_WIDTH, ribbonY + 40);
        gradient.addColorStop(0, 'rgba(255, 184, 94, 0.75)');
        gradient.addColorStop(0.5, 'rgba(255, 220, 140, 0.95)');
        gradient.addColorStop(1, 'rgba(255, 172, 86, 0.75)');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(-40, ribbonY + Math.sin(now / 220) * 6);
        ctx.quadraticCurveTo(GAME_WIDTH / 2, ribbonY + 34 + Math.cos(now / 200) * 8, GAME_WIDTH + 40, ribbonY + Math.sin(now / 180) * 6);
        ctx.stroke();
        ctx.font = '700 24px "Space Grotesk", system-ui';
        ctx.fillStyle = '#2c1400';
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 10;
        ctx.fillText('Solar flare!', GAME_WIDTH / 2 - 58, ribbonY + 12);
        ctx.restore();
      }
    },
    [getShapeSize, perfectActive, rewardActive]
  );

  const triggerPerfect = useCallback(() => {
    if (perfectTimerRef.current) {
      clearTimeout(perfectTimerRef.current);
    }
    setPerfectActive(true);
    perfectTimerRef.current = setTimeout(() => setPerfectActive(false), 500);
    shakeRef.current = 6;
    squashRef.current = 1.06;
  }, []);

  const spawnParticles = useCallback((x, y, tint = '#7dd8ff', count = 26, kind = 'spark') => {
    const pool = particlesRef.current;
    for (let i = 0; i < count; i++) {
      if (pool.length >= MAX_PARTICLES) break;
      pool.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 3.2,
        vy: -1.2 + Math.random() * 2.4,
        size: 2.2 + Math.random() * 2.6,
        life: 0,
        maxLife: 380 + Math.random() * 240,
        color: tint,
        kind,
        rot: Math.random() * Math.PI
      });
    }
  }, []);

  const pickDriftMode = useCallback(() => {
    driftModeRef.current = 'sine';
    driftPhaseRef.current = Math.random() * Math.PI * 2;
  }, []);

  const spawnReward = useCallback(() => {
    const margin = 12 + REWARD_SIZE / 2;
    const usable = GAME_WIDTH - margin * 2;
    const x = margin + Math.random() * usable;
    const y = Math.max(140, wallYRef.current - 220);
    rewardPosRef.current = { x, y };
    setRewardActive(true);
  }, []);

  const collectReward = useCallback(() => {
    if (!rewardActive) return;
    const { x, y } = rewardPosRef.current;
    setRewardActive(false);
    spawnParticles(x, y, '#ffd166', 40);
    const slowed = Math.max(INITIAL_SPEED * 0.7, speedRef.current * REWARD_SPEED_SCALE);
    speedRef.current = slowed;
    setSpeed(slowed);
    const widened = clamp(gapWidthRef.current + REWARD_GAP_BONUS, MIN_GAP, INITIAL_GAP);
    gapWidthRef.current = widened;
    setGapWidth(widened);
    const newGapX = clamp(gapXRef.current, 0, GAME_WIDTH - widened);
    gapXRef.current = newGapX;
    setGapX(newGapX);
  }, [rewardActive, spawnParticles]);

  const randomGapX = useCallback(
    (width) => {
      const margin = 6;
      const usable = GAME_WIDTH - width - margin * 2;
      const base = Math.random() * usable + margin;
      return clamp(base, 0, GAME_WIDTH - width);
    },
    []
  );

  const setHighScoreIfNeeded = useCallback(
    (value) => {
      if (value > highScoreRef.current) {
        highScoreRef.current = value;
        setHighScore(value);
        localStorage.setItem('perfect-fit-highscore', String(value));
      }
    },
    []
  );

  const pickShapeVariant = useCallback(() => {
    const nextIndex = shapeOrderIndexRef.current % SHAPE_ORDER.length;
    const nextId = SHAPE_ORDER[nextIndex];
    shapeOrderIndexRef.current = nextIndex + 1;
    return SHAPE_LOOKUP[nextId] || SHAPE_VARIANTS[0];
  }, []);

  const handleAlienHit = useCallback(
    (shapeBounds, lethal = true) => {
      playFail();
      vibrate(150);
      shakeRef.current = 12;
      const cx = shapeBounds.x + shapeBounds.width / 2;
      const cy = shapeBounds.y + shapeBounds.height / 2;
      spawnParticles(cx, cy, '#ff8c6a', 30, 'shard');
      if (!lethal) return;
      setTimeToDrop(null);
      setRewardActive(false);
      runningRef.current = false;
      setGameOver(true);
      setGameRunning(false);
      setPaused(false);
    },
    [playFail, spawnParticles, vibrate]
  );

  const spawnShape = useCallback(
    (randomizeType = true) => {
      const variant = randomizeType ? pickShapeVariant() : SHAPE_LOOKUP[shapeTypeRef.current] || SHAPE_VARIANTS[0];
      const colors = variant.palette[Math.floor(Math.random() * variant.palette.length)];
      shapeColorsRef.current = colors;
      shapeTypeRef.current = variant.id;
      setShapeType(variant.id);
      rotationRef.current = 0;
      setShapeRotation(0);
      shapeDamageRef.current = 0;
      const { width, height } = getShapeSize(0, variant.id);
      const spawnSlots = [6, (GAME_WIDTH - width) / 2 + (Math.random() - 0.5) * 20, GAME_WIDTH - width - 6];
      const slotPick = spawnSlots[Math.floor(Math.random() * spawnSlots.length)];
      const startX = clamp(slotPick, 0, GAME_WIDTH - width);
      const resetY = -height - 20;
      shapeXRef.current = startX;
      setShapeX(startX);
      shapeYRef.current = resetY;
      setShapeY(resetY);
      return { width, height };
    },
    [getShapeSize, pickShapeVariant]
  );

  const handleLanding = useCallback(
    ({ gapPos, currentGapWidth, shapeWidth, shapeHeight }) => {
      const hitWall = shapeXRef.current < gapPos || shapeXRef.current + shapeWidth > gapPos + currentGapWidth;
      if (hitWall) {
        playFail();
        vibrate(140);
        shakeRef.current = 12;
        spawnParticles(shapeXRef.current + shapeWidth / 2, wallYRef.current - WALL_HEIGHT, '#4a5568', 28, 'shard');
        setTimeToDrop(null);
        setRewardActive(false);
        runningRef.current = false;
        setGameOver(true);
        setGameRunning(false);
        setPaused(false);
        return;
      }

      const scoreGain = shapeDamageRef.current > 0 ? 0.5 : 1;
      const nextScore = scoreRef.current + scoreGain;
      scoreRef.current = nextScore;
      setScore(nextScore);
      setHighScoreIfNeeded(nextScore);
      maybeActivateAliens(alienStateRef.current, nextScore, () =>
        spawnAlienWave(alienStateRef.current, {
          wallY: wallYRef.current,
          gapX: gapXRef.current,
          gapWidth: gapWidthRef.current,
          gameWidth: GAME_WIDTH
        })
      );
      if (nextScore >= nextRewardScoreRef.current) {
        spawnReward();
        nextRewardScoreRef.current += REWARD_INTERVAL;
      }

      const leftover = currentGapWidth - shapeWidth;
      if (leftover <= PERFECT_TOLERANCE) {
        triggerPerfect();
        spawnParticles(shapeXRef.current + shapeWidth / 2, wallYRef.current - WALL_HEIGHT * 1.6, '#ffb347', 40);
      }
      playChime();
      spawnParticles(shapeXRef.current + shapeWidth / 2, wallYRef.current - WALL_HEIGHT, '#6fd8ff', 24);
      squashRef.current = 0.9;

      const nextGapWidth = Math.max(MIN_GAP, currentGapWidth - GAP_SHRINK);
      const nextSpeed = Math.min(MAX_SPEED, speedRef.current + SPEED_STEP);
      const nextDrift = Math.min(MAX_DRIFT, driftAmplitudeRef.current + DRIFT_STEP);
      const nextGapX = randomGapX(nextGapWidth);

      gapWidthRef.current = nextGapWidth;
      setGapWidth(nextGapWidth);
      gapXRef.current = nextGapX;
      setGapX(nextGapX);
      speedRef.current = nextSpeed;
      setSpeed(nextSpeed);
      driftAmplitudeRef.current = nextDrift;
      pickDriftMode();

      spawnShape(true);
    },
    [maybeActivateAliens, pickDriftMode, playChime, playFail, randomGapX, setHighScoreIfNeeded, spawnAlienWave, spawnParticles, spawnReward, spawnShape, triggerPerfect, vibrate]
  );

  const startGame = useCallback(() => {
    if (perfectTimerRef.current) {
      clearTimeout(perfectTimerRef.current);
    }
    setPerfectActive(false);
    setTimeToDrop(null);
    particlesRef.current = [];
    trailRef.current = [];
    shakeRef.current = 0;
    setRewardActive(false);
    totalHitsRef.current = 0;
    shapeDamageRef.current = 0;
    resetAliensState(alienStateRef.current);
    nextRewardScoreRef.current = REWARD_FIRST_SCORE;
    scoreRef.current = 0;
    setScore(0);
    setGameOver(false);
    setPaused(false);
    const initialGapX = randomGapX(INITIAL_GAP);
    gapXRef.current = initialGapX;
    setGapX(initialGapX);
    gapWidthRef.current = INITIAL_GAP;
    setGapWidth(INITIAL_GAP);
    speedRef.current = INITIAL_SPEED;
    setSpeed(INITIAL_SPEED);
    driftAmplitudeRef.current = INITIAL_DRIFT;
    pickDriftMode();
    wallYRef.current = initialWallY;
    setWallY(initialWallY);
    shapeOrderIndexRef.current = 0;
    spawnShape(true);
    runningRef.current = true;
    setGameRunning(true);
  }, [pickDriftMode, randomGapX, resetAliensState, spawnShape]);

  const restartGame = useCallback(() => {
    startGame();
  }, [startGame]);

  const togglePause = useCallback(() => {
    if (!gameRunning || gameOver) return;
    setPaused((prev) => !prev);
  }, [gameOver, gameRunning]);

  const rotateBy = useCallback(
    (delta) => {
      if (!gameRunning || paused || gameOver) return;
      const currentRotation = rotationRef.current;
      const nextRotation = ((currentRotation + delta) % 360 + 360) % 360;
      const { width: currentWidth } = getShapeSize(currentRotation);
      const { width: nextWidth } = getShapeSize(nextRotation);
      const center = shapeXRef.current + currentWidth / 2;
      const rollDistance = Math.sign(delta) * Math.max(18, Math.min(44, currentWidth * 0.45));
      const unclampedX = center - nextWidth / 2 + rollDistance;
      const clampedX = clamp(unclampedX, 0, GAME_WIDTH - nextWidth);
      rotationRef.current = nextRotation;
      setShapeRotation(nextRotation);
      shapeXRef.current = clampedX;
      setShapeX(clampedX);
      squashRef.current = 1.04;
      playClick();
    },
    [gameOver, gameRunning, getShapeSize, paused, playClick]
  );

  const rotateLeft = useCallback(() => rotateBy(-ROTATION_STEP), [rotateBy]);
  const rotateRight = useCallback(() => rotateBy(ROTATION_STEP), [rotateBy]);

  useEffect(() => {
    if (!gameRunning || paused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    let lastTime = performance.now();

    const step = (time) => {
      const delta = clamp((time - lastTime) / 16.67, 0.4, 2);
      lastTime = time;
      const { width: shapeWidth, height: shapeHeight } = getShapeSize();
      const driftOffset = driftOffsetForMode(time, driftAmplitudeRef.current, driftModeRef.current, driftPhaseRef.current);
      const gapPos = clamp(gapXRef.current + driftOffset, 0, GAME_WIDTH - gapWidthRef.current);
      activeGapXRef.current = gapPos;

      const nextY = shapeYRef.current + speedRef.current * FALL_MULTIPLIER * delta;
      const projectedY = Math.min(nextY, wallYRef.current - shapeHeight);
      const shapeBounds = { x: shapeXRef.current, y: projectedY, width: shapeWidth, height: shapeHeight };

      if (rewardActive) {
        const r = rewardPosRef.current;
        const half = REWARD_SIZE / 2;
        const sx = shapeBounds.x;
        const sy = shapeBounds.y;
        if (sx < r.x + half && sx + shapeWidth > r.x - half && sy < r.y + half && sy + shapeHeight > r.y - half) {
          collectReward();
        }
      }

      trailRef.current.unshift({
        x: shapeXRef.current,
        y: shapeYRef.current,
        rotation: rotationRef.current,
        type: shapeTypeRef.current,
        colors: shapeColorsRef.current
      });
      if (trailRef.current.length > TRAIL_LENGTH) {
        trailRef.current.length = TRAIL_LENGTH;
      }

      updateAliensForFrame(alienStateRef.current, {
        delta,
        now: time,
        gapX: gapPos,
        gapWidth: gapWidthRef.current,
        gameWidth: GAME_WIDTH
      });

      const { lethal: alienLethal } = updateAlienBullets(alienStateRef.current, {
        delta,
        shapeBounds,
        gameHeight: GAME_HEIGHT,
        onHit: (lethalHit, bounds) => handleAlienHit(bounds, lethalHit)
      });
      if (alienLethal) {
        drawFrame(gapPos, shapeBounds.y, time, delta);
        return;
      }

      const remaining = wallYRef.current - shapeBounds.y - shapeHeight;
      if (time - lastEtaUpdateRef.current > 90) {
        const etaSeconds = remaining > 0 ? remaining / (speedRef.current * FALL_MULTIPLIER * 60) : 0;
        setTimeToDrop(Number(etaSeconds.toFixed(1)));
        lastEtaUpdateRef.current = time;
      }

      if (nextY >= wallYRef.current - shapeHeight) {
        drawFrame(gapPos, wallYRef.current - shapeHeight, time, delta);
        handleLanding({
          gapPos,
          currentGapWidth: gapWidthRef.current,
          shapeWidth,
          shapeHeight
        });
        if (runningRef.current) {
          rafRef.current = requestAnimationFrame(step);
        }
      } else {
        shapeYRef.current = nextY;
        setShapeY(nextY);
        drawFrame(gapPos, undefined, time, delta);
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [collectReward, drawFrame, gameRunning, getShapeSize, handleLanding, paused, rewardActive, updateAlienBullets, updateAliensForFrame]);

  useEffect(() => {
    runningRef.current = gameRunning;
  }, [gameRunning]);

  useEffect(() => {
    drawFrame(gapXRef.current);
    return () => {
      if (perfectTimerRef.current) clearTimeout(perfectTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [drawFrame]);

  return {
    canvasRef,
    rotateLeft,
    rotateRight,
    startGame,
    restartGame,
    togglePause,
    gameRunning,
    paused,
    gameOver,
    shapeRotation,
    gapWidth,
    speed,
    score,
    highScore,
    shapeY,
    shapeX,
    wallY,
    perfectActive,
    timeToDrop
  };
};

export default useGameLogic;
