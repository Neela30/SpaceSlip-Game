import { useCallback, useEffect, useRef, useState } from 'react';

const GAME_WIDTH = 360;
const GAME_HEIGHT = 640;
const LONG_SIDE = 138;
const SHORT_SIDE = 46;
const WALL_HEIGHT = 18;
const INITIAL_GAP = 210;
const MIN_GAP = 74;
const INITIAL_SPEED = 1.1;
const SPEED_STEP = 0.2;
const GAP_SHRINK = 5.4;
const INITIAL_DRIFT = 8;
const DRIFT_STEP = 0.9;
const MAX_DRIFT = 40;
const MAX_SPEED = 11;
const PERFECT_TOLERANCE = 12;
const FALL_MULTIPLIER = 1.7;
const ROTATION_STEP = 90;

const SHAPE_VARIANTS = [
  {
    id: 'rectangle',
    kind: 'rectangle',
    long: LONG_SIDE,
    short: SHORT_SIDE,
    palette: [
      ['#5ef0c7', '#6ae0ff'],
      ['#7b8bff', '#5ce6ff']
    ]
  },
  {
    id: 'square',
    kind: 'square',
    size: 92,
    palette: [
      ['#ff8ad9', '#7de6ff'],
      ['#ffcc70', '#c850c0']
    ]
  },
  {
    id: 'circle',
    kind: 'circle',
    size: 88,
    palette: [
      ['#a3ffb0', '#4de1ff'],
      ['#ffc3a0', '#ff5fa2']
    ]
  },
  {
    id: 'triangle',
    kind: 'triangle',
    size: 110,
    palette: [
      ['#9ef5ff', '#ff8ad9'],
      ['#c6ff8a', '#5cd7ff']
    ]
  }
];

const SHAPE_LOOKUP = SHAPE_VARIANTS.reduce((acc, shape) => {
  acc[shape.id] = shape;
  return acc;
}, {});

const SHAPE_ORDER = ['circle', 'square', 'rectangle', 'triangle'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
    if (variant.kind === 'rectangle') {
      if (rotation % 180 === 0) {
        return { width: variant.long, height: variant.short };
      }
      return { width: variant.short, height: variant.long };
    }
    if (variant.kind === 'square') {
      return { width: variant.size, height: variant.size };
    }
    if (variant.kind === 'circle') {
      return { width: variant.size, height: variant.size };
    }
    if (variant.kind === 'triangle') {
      const base = variant.size;
      const height = variant.size * 0.9;
      if (rotation % 180 === 0) {
        return { width: base, height };
      }
      return { width: height, height: base };
    }
    return { width: LONG_SIDE, height: SHORT_SIDE };
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
    (currentGapX = activeGapXRef.current, overrideY) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      const bgGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      bgGrad.addColorStop(0, '#0c162b');
      bgGrad.addColorStop(1, '#0a1020');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#6ee7f0';
      for (let i = 0; i <= GAME_HEIGHT; i += 64) {
        ctx.fillRect(0, i, GAME_WIDTH, 1);
      }
      ctx.restore();

      const wallTop = wallYRef.current;
      const gapSize = gapWidthRef.current;
      ctx.save();
      ctx.shadowColor = 'rgba(76, 216, 255, 0.55)';
      ctx.shadowBlur = 22;
      ctx.fillStyle = '#102640';
      ctx.fillRect(0, wallTop, currentGapX, WALL_HEIGHT);
      ctx.fillRect(currentGapX + gapSize, wallTop, GAME_WIDTH - (currentGapX + gapSize), WALL_HEIGHT);
      ctx.restore();
      ctx.save();
      ctx.fillStyle = 'rgba(130, 216, 255, 0.35)';
      ctx.fillRect(0, wallTop - 2, currentGapX, 2);
      ctx.fillRect(currentGapX + gapSize, wallTop - 2, GAME_WIDTH - (currentGapX + gapSize), 2);
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

      const { width: shapeWidth, height: shapeHeight } = getShapeSize();
      const rectY = overrideY !== undefined ? overrideY : shapeYRef.current;
      const [c1, c2] = shapeColorsRef.current;
      const fill = ctx.createLinearGradient(shapeXRef.current, rectY, shapeXRef.current + shapeWidth, rectY + shapeHeight);
      fill.addColorStop(0, c1);
      fill.addColorStop(1, c2);

      ctx.save();
      ctx.shadowColor = 'rgba(87, 246, 205, 0.4)';
      ctx.shadowBlur = 20;
      const activeType = shapeTypeRef.current;
      const cx = shapeXRef.current + shapeWidth / 2;
      const cy = rectY + shapeHeight / 2;
      const rotationRad = (rotationRef.current * Math.PI) / 180;
      ctx.translate(cx, cy);
      ctx.rotate(rotationRad);

      if (activeType === 'triangle') {
        const hw = shapeWidth / 2;
        const hh = shapeHeight / 2;
        ctx.beginPath();
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw, hh);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (activeType === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, shapeWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        const radius = activeType === 'square' ? 10 : 12;
        drawRoundedRect(ctx, -shapeWidth / 2, -shapeHeight / 2, shapeWidth, shapeHeight, radius, fill, 'rgba(255,255,255,0.2)');
      }
      ctx.restore();
    },
    [getShapeSize]
  );

  const triggerPerfect = useCallback(() => {
    if (perfectTimerRef.current) {
      clearTimeout(perfectTimerRef.current);
    }
    setPerfectActive(true);
    perfectTimerRef.current = setTimeout(() => setPerfectActive(false), 500);
  }, []);

  const randomGapX = useCallback(
    (width) => {
      const wiggle = (Math.random() - 0.5) * (60 + Math.min(80, scoreRef.current * 3));
      const base = gapXRef.current + wiggle;
      const randomNudge = (Math.random() - 0.5) * 14;
      return clamp(base + randomNudge, 0, GAME_WIDTH - width);
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

  const spawnShape = useCallback(
    (randomizeType = true) => {
      const variant = randomizeType ? pickShapeVariant() : SHAPE_LOOKUP[shapeTypeRef.current] || SHAPE_VARIANTS[0];
      const colors = variant.palette[Math.floor(Math.random() * variant.palette.length)];
      shapeColorsRef.current = colors;
      shapeTypeRef.current = variant.id;
      setShapeType(variant.id);
      rotationRef.current = 0;
      setShapeRotation(0);
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
        runningRef.current = false;
        setGameOver(true);
        setGameRunning(false);
        setPaused(false);
        return;
      }

      const nextScore = scoreRef.current + 1;
      scoreRef.current = nextScore;
      setScore(nextScore);
      setHighScoreIfNeeded(nextScore);

      const leftover = currentGapWidth - shapeWidth;
      if (leftover <= PERFECT_TOLERANCE) {
        triggerPerfect();
      }
      playChime();

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

      spawnShape(true);
    },
    [playChime, playFail, randomGapX, setHighScoreIfNeeded, spawnShape, triggerPerfect, vibrate]
  );

  const startGame = useCallback(() => {
    if (perfectTimerRef.current) {
      clearTimeout(perfectTimerRef.current);
    }
    setPerfectActive(false);
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
    wallYRef.current = initialWallY;
    setWallY(initialWallY);
    shapeOrderIndexRef.current = 0;
    spawnShape(true);
    runningRef.current = true;
    setGameRunning(true);
  }, [randomGapX, spawnShape]);

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
      const driftOffset = Math.sin(time / 700) * driftAmplitudeRef.current;
      const gapPos = clamp(gapXRef.current + driftOffset, 0, GAME_WIDTH - gapWidthRef.current);
      activeGapXRef.current = gapPos;

      const nextY = shapeYRef.current + speedRef.current * FALL_MULTIPLIER * delta;
      if (nextY >= wallYRef.current - shapeHeight) {
        drawFrame(gapPos, wallYRef.current - shapeHeight);
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
        drawFrame(gapPos);
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [drawFrame, gameRunning, getShapeSize, handleLanding, paused]);

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
    perfectActive
  };
};

export default useGameLogic;
