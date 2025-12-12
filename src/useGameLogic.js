import { useCallback, useEffect, useMemo, useRef } from 'react';
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
import {
  FALL_MULTIPLIER,
  GAME_HEIGHT,
  GAME_WIDTH,
  GAP_SHRINK,
  INITIAL_DRIFT,
  INITIAL_GAP,
  INITIAL_SPEED,
  DRIFT_STEP,
  GAP_EDGE_MARGIN,
  MAX_PARTICLES,
  MAX_SPEED,
  MIN_GAP,
  PERFECT_TOLERANCE,
  REWARD_SIZE,
  SPEED_STEP,
  TRAIL_LENGTH,
  VISUAL_SCALE,
  WALL_HEIGHT
} from './game/constants';
import { renderShape, createStarfield, drawStar } from './game/drawing';
import { createSfx, vibrate } from './game/audio';
import { clamp, driftOffsetForMode, lerp, getShapeSize as baseGetShapeSize } from './game/physics';
import { createCoreState } from './game/state';
import { collectReward, resetRewards, shouldSpawnReward, spawnReward } from './game/rewards';
import { SHAPE_LOOKUP, SHAPE_ORDER, SHAPE_VARIANTS } from './game/constants';

const ROTATE_STEP = 90; // ✅ force 90° rotation per action
const GAP_MOVE_DELAY = 200; // wait briefly before sliding the bar after a pass

const useGameLogic = () => {
  const canvasRef = useRef(null);
  const { state: coreState, setters, refs, initialWallY } = createCoreState();

  const {
    gameRunning,
    gameOver,
    paused,
    perfectActive,
    highScore,
    timeToDrop,
    rewardActive
  } = coreState;

  const {
    setShapeX,
    setShapeY,
    setShapeRotation,
    setShapeType,
    setWallY,
    setGapX,
    setGapWidth,
    setSpeed,
    setScore,
    setGameRunning,
    setGameOver,
    setPaused,
    setPerfectActive,
    setHighScore,
    setTimeToDrop,
    setRewardActive
  } = setters;

  const {
    shapeXRef,
    shapeYRef,
    rotationRef,
    shapeTypeRef,
    shapeColorsRef,
    shapeOrderIndexRef,
    wallYRef,
    gapXRef,
    gapWidthRef,
    speedRef,
    scoreRef,
    highScoreRef,
    driftAmplitudeRef,
    perfectTimerRef,
    rafRef,
    activeGapXRef,
    audioCtxRef,
    runningRef,
    particlesRef,
    trailRef,
    starfieldRef,
    driftModeRef,
    driftPhaseRef,
    shakeRef,
    squashRef,
    lastEtaUpdateRef,
    rewardPosRef,
    nextRewardScoreRef
  } = refs;

  const alienStateRef = useRef(createAlienState());
  const { shapeDamageRef, totalHitsRef } = alienStateRef.current;

  // ✅ aiming velocity tracking for aliens
  const lastTargetXRef = useRef(null);
  const lastAimTimeRef = useRef(null);
  const targetVXRef = useRef(0);

  // ✅ NEW: track whether this falling object has already crossed the bar successfully
  const passedBarRef = useRef(false);
  // gap movement tween so the bar slides quickly then eases out
  const gapTransitionRef = useRef({ active: false, from: 0, to: 0, startTime: 0, duration: 1, delay: 0 });

  const sfx = useMemo(() => createSfx(audioCtxRef), []);

  const getShapeSize = useCallback(
    (rotation = rotationRef.current, type = shapeTypeRef.current) => baseGetShapeSize(rotation, type),
    []
  );

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
  }, [resizeCanvas, setHighScore, highScoreRef, starfieldRef]);

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

      // background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      bgGrad.addColorStop(0, '#0c162b');
      bgGrad.addColorStop(1, '#0a1020');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      const planet = ctx.createRadialGradient(
        GAME_WIDTH * 0.9,
        GAME_HEIGHT * 0.2,
        40,
        GAME_WIDTH * 0.85,
        GAME_HEIGHT * 0.15,
        260
      );
      planet.addColorStop(0, 'rgba(80, 140, 255, 0.22)');
      planet.addColorStop(1, 'rgba(10, 16, 32, 0)');
      ctx.fillStyle = planet;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // starfield
      ctx.save();
      starfieldRef.current.forEach((star) => {
        const sp = (0.35 + star.depth * 0.8) * delta;
        star.y += sp;
        if (star.y > GAME_HEIGHT + 4) {
          star.y = -4;
          star.x = Math.random() * GAME_WIDTH;
        }
        ctx.globalAlpha = 0.4 + star.depth * 0.35;
        ctx.fillStyle = '#86e4ff';
        ctx.fillRect(star.x, star.y, 1.2 + star.depth * 0.8, 1.2 + star.depth * 0.8);
      });
      ctx.restore();

      // bar
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

      // aliens
      drawAliens(ctx, alienStateRef.current, now);

      // trail
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

      // particles
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

      // reward
      if (rewardActive) {
        const { x: rx, y: ry } = rewardPosRef.current;
        drawStar(ctx, {
          x: rx,
          y: ry,
          radius: REWARD_SIZE / 2,
          rotation: now / 400,
          fill: '#ffe69a',
          glow: 'rgba(255, 230, 160, 0.85)'
        });
      }

      // falling shape (can now go below the bar)
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

      // alien bullets
      drawAlienShots(ctx, alienStateRef.current);

      // perfect ribbon
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
        ctx.quadraticCurveTo(
          GAME_WIDTH / 2,
          ribbonY + 34 + Math.cos(now / 200) * 8,
          GAME_WIDTH + 40,
          ribbonY + Math.sin(now / 180) * 6
        );
        ctx.stroke();
        ctx.font = '700 24px "Space Grotesk", system-ui';
        ctx.fillStyle = '#2c1400';
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 10;
        ctx.fillText('Solar flare!', GAME_WIDTH / 2 - 58, ribbonY + 12);
        ctx.restore();
      }
    },
    [getShapeSize, perfectActive, rewardActive, lerp]
  );

  const triggerPerfect = useCallback(() => {
    if (perfectTimerRef.current) clearTimeout(perfectTimerRef.current);
    setPerfectActive(true);
    perfectTimerRef.current = setTimeout(() => setPerfectActive(false), 500);
    shakeRef.current = 6;
    squashRef.current = 1.06;
  }, [perfectTimerRef, setPerfectActive]);

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
  }, [particlesRef]);

  const pickDriftMode = useCallback(() => {
    driftModeRef.current = 'sine';
    driftPhaseRef.current = Math.random() * Math.PI * 2;
  }, [driftModeRef, driftPhaseRef]);

  const randomGapX = useCallback((width) => {
    const margin = GAP_EDGE_MARGIN;
    const usable = Math.max(0, GAME_WIDTH - width - margin * 2);
    const base = Math.random() * usable + margin;
    const maxPos = Math.max(margin, GAME_WIDTH - width - margin);
    return clamp(base, margin, maxPos);
  }, []);

  const setHighScoreIfNeeded = useCallback(
    (value) => {
      if (value > highScoreRef.current) {
        highScoreRef.current = value;
        setHighScore(value);
        localStorage.setItem('perfect-fit-highscore', String(value));
      }
    },
    [highScoreRef, setHighScore]
  );

  const pickShapeVariant = useCallback(() => {
    const nextIndex = shapeOrderIndexRef.current % SHAPE_ORDER.length;
    const nextId = SHAPE_ORDER[nextIndex];
    shapeOrderIndexRef.current = nextIndex + 1;
    return SHAPE_LOOKUP[nextId] || SHAPE_VARIANTS[0];
  }, [shapeOrderIndexRef]);

  const handleAlienHit = useCallback(
    (shapeBounds, lethal = true) => {
      sfx.fail();
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
    [sfx, spawnParticles, setTimeToDrop, setRewardActive, setGameOver, setGameRunning, setPaused, runningRef]
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
    [getShapeSize, pickShapeVariant, setShapeType, setShapeRotation, setShapeX, setShapeY]
  );

  // ✅ NEW: what used to be "landing" is now "successful pass" (score + difficulty),
  // but we DO NOT spawn the next object here. The current one keeps falling.
  const handleSuccessfulPass = useCallback(
    ({ gapPos, currentGapWidth, shapeWidth }) => {
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

      if (shouldSpawnReward(nextScore, nextRewardScoreRef)) {
        spawnReward(rewardPosRef, wallYRef, setRewardActive);
      }

      const leftover = currentGapWidth - shapeWidth;
      if (leftover <= PERFECT_TOLERANCE) {
        triggerPerfect();
        spawnParticles(shapeXRef.current + shapeWidth / 2, wallYRef.current - WALL_HEIGHT * 1.6, '#ffb347', 40);
      }

      const prevGapX = gapXRef.current;

      sfx.chime();
      squashRef.current = 0.9;

      const nextGapWidth = Math.max(MIN_GAP, currentGapWidth - GAP_SHRINK);
      const nextSpeed = Math.min(MAX_SPEED, speedRef.current + SPEED_STEP);
      const nextDrift = Math.min(9999, driftAmplitudeRef.current + DRIFT_STEP);
      const nextGapX = randomGapX(nextGapWidth);

      gapWidthRef.current = nextGapWidth;
      setGapWidth(nextGapWidth);

      gapXRef.current = nextGapX;
      setGapX(nextGapX);

      speedRef.current = nextSpeed;
      setSpeed(nextSpeed);

      driftAmplitudeRef.current = nextDrift;
      pickDriftMode();

      // once we passed, ETA isn't meaningful until the next spawn
      setTimeToDrop(null);

      // slide the bar quickly to its next position, easing out
      gapTransitionRef.current = {
        active: true,
        from: prevGapX,
        to: nextGapX,
        startTime: performance.now(),
        duration: 260,
        delay: GAP_MOVE_DELAY
      };
    },
    [
      pickDriftMode,
      randomGapX,
      setGapWidth,
      setGapX,
      setHighScoreIfNeeded,
      setRewardActive,
      setScore,
      setSpeed,
      setTimeToDrop,
      sfx,
      spawnParticles,
      triggerPerfect
    ]
  );

  const startGame = useCallback(() => {
    if (perfectTimerRef.current) clearTimeout(perfectTimerRef.current);

    setPerfectActive(false);
    setTimeToDrop(null);

    particlesRef.current = [];
    trailRef.current = [];
    shakeRef.current = 0;
    setRewardActive(false);

    totalHitsRef.current = 0;
    shapeDamageRef.current = 0;

    // reset aim velocity tracking
    lastTargetXRef.current = null;
    lastAimTimeRef.current = null;
    targetVXRef.current = 0;

    // ✅ reset pass-through state
    passedBarRef.current = false;
    gapTransitionRef.current = { active: false, from: 0, to: 0, startTime: 0, duration: 1, delay: 0 };

    resetAliensState(alienStateRef.current);
    resetRewards(nextRewardScoreRef);

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
  }, [
    initialWallY,
    pickDriftMode,
    randomGapX,
    resetAliensState,
    setGameOver,
    setGameRunning,
    setGapWidth,
    setGapX,
    setPaused,
    setPerfectActive,
    setRewardActive,
    setScore,
    setSpeed,
    setTimeToDrop,
    setWallY,
    spawnShape,
    perfectTimerRef
  ]);

  const restartGame = useCallback(() => startGame(), [startGame]);

  const togglePause = useCallback(() => {
    if (!gameRunning || gameOver) return;
    setPaused((prev) => !prev);
  }, [gameOver, gameRunning, setPaused]);

  const rotateBy = useCallback(
    (delta) => {
      if (!gameRunning || paused || gameOver) return;

      const currentRotation = rotationRef.current;
      const nextRotation = ((currentRotation + delta) % 360 + 360) % 360;

      const currentType = shapeTypeRef.current;
      const { width: currentWidth } = getShapeSize(currentRotation, currentType);
      const { width: nextWidth } = getShapeSize(nextRotation, currentType);

      const center = shapeXRef.current + currentWidth / 2;

      const rollDistance = Math.sign(delta) * Math.max(18, Math.min(44, currentWidth * 0.45));
      const unclampedX = center - nextWidth / 2 + rollDistance;
      const clampedX = clamp(unclampedX, 0, GAME_WIDTH - nextWidth);

      rotationRef.current = nextRotation;
      setShapeRotation(nextRotation);

      shapeXRef.current = clampedX;
      setShapeX(clampedX);

      squashRef.current = 1.04;
      sfx.click();
    },
    [gameOver, gameRunning, getShapeSize, paused, sfx, setShapeRotation, setShapeX]
  );

  const rotateLeft = useCallback(() => rotateBy(-ROTATE_STEP), [rotateBy]);
  const rotateRight = useCallback(() => rotateBy(ROTATE_STEP), [rotateBy]);

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

      let baseGapX = gapXRef.current;
      const transition = gapTransitionRef.current;
      if (transition.active) {
        const elapsed = time - transition.startTime - (transition.delay || 0);
        if (elapsed <= 0) {
          baseGapX = transition.from;
        } else {
          const t = clamp(elapsed / transition.duration, 0, 1);
          const eased = 1 - (1 - t) * (1 - t);
          baseGapX = lerp(transition.from, transition.to, eased);
          if (t >= 1) {
            transition.active = false;
            baseGapX = transition.to;
          }
        }
      }

      const minGapX = GAP_EDGE_MARGIN;
      const maxGapX = Math.max(minGapX, GAME_WIDTH - gapWidthRef.current - GAP_EDGE_MARGIN);
      const gapPos = clamp(baseGapX + driftOffset, minGapX, maxGapX);
      activeGapXRef.current = gapPos;

      // ✅ IMPORTANT CHANGE:
      // DO NOT clamp Y to the bar anymore. Let it move past the bar.
      const prevY = shapeYRef.current;
      const nextY = prevY + speedRef.current * FALL_MULTIPLIER * delta;

      // bounds at nextY (for aiming + bullets)
      const shapeBounds = { x: shapeXRef.current, y: nextY, width: shapeWidth, height: shapeHeight };

      // reward collection
      if (rewardActive) {
        const r = rewardPosRef.current;
        const half = REWARD_SIZE / 2;
        const sx = shapeBounds.x;
        const sy = shapeBounds.y;
        if (sx < r.x + half && sx + shapeWidth > r.x - half && sy < r.y + half && sy + shapeHeight > r.y - half) {
          collectReward({
            rewardActive,
            rewardPosRef,
            setRewardActive,
            speedRef,
            setSpeed,
            gapWidthRef,
            setGapWidth,
            gapXRef,
            setGapX
          });
          spawnParticles(r.x, r.y, '#ffd166', 40);
        }
      }

      // trail
      trailRef.current.unshift({
        x: shapeXRef.current,
        y: shapeYRef.current,
        rotation: rotationRef.current,
        type: shapeTypeRef.current,
        colors: shapeColorsRef.current
      });
      if (trailRef.current.length > TRAIL_LENGTH) trailRef.current.length = TRAIL_LENGTH;

      // aiming velocity for aliens
      const targetX = shapeBounds.x + shapeBounds.width / 2;
      const targetY = shapeBounds.y + shapeBounds.height / 2;

      if (lastTargetXRef.current == null || lastAimTimeRef.current == null) {
        lastTargetXRef.current = targetX;
        lastAimTimeRef.current = time;
        targetVXRef.current = 0;
      } else {
        const dtMs = Math.max(1, time - lastAimTimeRef.current);
        const dx = targetX - lastTargetXRef.current;
        const vxPerFrame = dx / (dtMs / 16.67);
        const smoothed = targetVXRef.current * 0.75 + vxPerFrame * 0.25;
        targetVXRef.current = clamp(smoothed, -10, 10);
        lastTargetXRef.current = targetX;
        lastAimTimeRef.current = time;
      }

      updateAliensForFrame(alienStateRef.current, {
        delta,
        now: time,
        gapX: gapPos,
        gapWidth: gapWidthRef.current,
        gameWidth: GAME_WIDTH,
        targetX,
        targetY,
        targetVX: targetVXRef.current,
        targetVY: speedRef.current * FALL_MULTIPLIER
      });

      const { lethal: alienLethal } = updateAlienBullets(alienStateRef.current, {
        delta,
        shapeBounds,
        gameHeight: GAME_HEIGHT,
        onHit: (lethalHit, bounds) => handleAlienHit(bounds, lethalHit)
      });

      if (alienLethal) {
        // freeze where hit occurred visually
        drawFrame(gapPos, shapeBounds.y, time, delta);
        return;
      }

      // ✅ BAR CROSSING CHECK:
      // Keep validating while the shape overlaps the bar; only mark success after clearing it fully.
      const barTop = wallYRef.current;
      const barBottom = barTop + WALL_HEIGHT;
      const shapeTopNext = nextY;
      const shapeBottomNext = nextY + shapeHeight;
      const overlappingBar = shapeTopNext < barBottom && shapeBottomNext >= barTop;

      if (overlappingBar && !passedBarRef.current) {
        const hitWall = shapeXRef.current < gapPos || shapeXRef.current + shapeWidth > gapPos + gapWidthRef.current;

        if (hitWall) {
          // blast at impact point
          sfx.fail();
          vibrate(140);
          shakeRef.current = 12;

          const impactY = barTop - shapeHeight;
          spawnParticles(shapeXRef.current + shapeWidth / 2, impactY, '#4a5568', 32, 'shard');

          setTimeToDrop(null);
          setRewardActive(false);
          runningRef.current = false;
          setGameOver(true);
          setGameRunning(false);
          setPaused(false);

          drawFrame(gapPos, impactY, time, delta);
          return;
        }
      }

      // ✅ success: once fully below the bar, update score/difficulty, but KEEP falling
      if (!passedBarRef.current && shapeTopNext >= barBottom) {
        passedBarRef.current = true;
        handleSuccessfulPass({
          gapPos,
          currentGapWidth: gapWidthRef.current,
          shapeWidth,
          shapeHeight
        });
      }

      // ETA only matters before passing the bar
      if (!passedBarRef.current) {
        const remaining = wallYRef.current - nextY - shapeHeight;
        if (time - lastEtaUpdateRef.current > 90) {
          const etaSeconds = remaining > 0 ? remaining / (speedRef.current * FALL_MULTIPLIER * 60) : 0;
          setTimeToDrop(Number(etaSeconds.toFixed(1)));
          lastEtaUpdateRef.current = time;
        }
      }

      // apply y + draw
      shapeYRef.current = nextY;
      setShapeY(nextY);
      drawFrame(gapPos, undefined, time, delta);

      // ✅ respawn only after it has visually passed through and left the screen
      if (passedBarRef.current && nextY > GAME_HEIGHT + 60) {
        passedBarRef.current = false;
        spawnShape(true);
      }

      if (runningRef.current) rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [
    drawFrame,
    gameRunning,
    getShapeSize,
    handleAlienHit,
    handleSuccessfulPass,
    paused,
    rewardActive,
    spawnParticles,
    spawnShape,
    sfx,
    setGameOver,
    setGameRunning,
    setPaused,
    setRewardActive,
    setShapeY,
    setTimeToDrop
  ]);

  useEffect(() => {
    runningRef.current = gameRunning;
  }, [gameRunning, runningRef]);

  useEffect(() => {
    drawFrame(gapXRef.current);
    return () => {
      if (perfectTimerRef.current) clearTimeout(perfectTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [drawFrame, gapXRef, perfectTimerRef, rafRef]);

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
    shapeRotation: coreState.shapeRotation,
    gapWidth: coreState.gapWidth,
    speed: coreState.speed,
    score: coreState.score,
    highScore,
    shapeY: coreState.shapeY,
    shapeX: coreState.shapeX,
    wallY: coreState.wallY,
    perfectActive,
    timeToDrop
  };
};

export default useGameLogic;
