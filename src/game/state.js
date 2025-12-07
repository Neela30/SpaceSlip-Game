import { useRef, useState } from 'react';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  INITIAL_DRIFT,
  INITIAL_GAP,
  INITIAL_SPEED,
  LONG_SIDE,
  REWARD_FIRST_SCORE,
  SHORT_SIDE
} from './constants';

export const createCoreState = () => {
  const initialWallY = Math.round(GAME_HEIGHT * 0.82);
  const [shapeX, setShapeX] = useState((GAME_WIDTH - LONG_SIDE) / 2);
  const [shapeY, setShapeY] = useState(-SHORT_SIDE * 1.5);
  const [shapeRotation, setShapeRotation] = useState(0);
  const [shapeType, setShapeType] = useState('rectangle');
  const [wallY, setWallY] = useState(initialWallY);
  const [gapX, setGapX] = useState((GAME_WIDTH - INITIAL_GAP) / 2);
  const [gapWidth, setGapWidth] = useState(INITIAL_GAP);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [score, setScore] = useState(0);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [perfectActive, setPerfectActive] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [timeToDrop, setTimeToDrop] = useState(null);
  const [rewardActive, setRewardActive] = useState(false);

  const refs = {
    shapeXRef: useRef((GAME_WIDTH - LONG_SIDE) / 2),
    shapeYRef: useRef(-SHORT_SIDE * 1.5),
    rotationRef: useRef(0),
    shapeTypeRef: useRef('rectangle'),
    shapeColorsRef: useRef(['#4df3c9', '#7dd8ff']),
    shapeOrderIndexRef: useRef(0),
    wallYRef: useRef(initialWallY),
    gapXRef: useRef((GAME_WIDTH - INITIAL_GAP) / 2),
    gapWidthRef: useRef(INITIAL_GAP),
    speedRef: useRef(INITIAL_SPEED),
    scoreRef: useRef(0),
    highScoreRef: useRef(0),
    driftAmplitudeRef: useRef(INITIAL_DRIFT),
    perfectTimerRef: useRef(null),
    rafRef: useRef(null),
    activeGapXRef: useRef((GAME_WIDTH - INITIAL_GAP) / 2),
    audioCtxRef: useRef(null),
    runningRef: useRef(false),
    particlesRef: useRef([]),
    trailRef: useRef([]),
    starfieldRef: useRef([]),
    driftModeRef: useRef('sine'),
    driftPhaseRef: useRef(0),
    shakeRef: useRef(0),
    squashRef: useRef(1),
    lastEtaUpdateRef: useRef(0),
    rewardPosRef: useRef({ x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.35 }),
    nextRewardScoreRef: useRef(REWARD_FIRST_SCORE)
  };

  return {
    state: {
      shapeX,
      shapeY,
      shapeRotation,
      shapeType,
      wallY,
      gapX,
      gapWidth,
      speed,
      score,
      gameRunning,
      gameOver,
      paused,
      perfectActive,
      highScore,
      timeToDrop,
      rewardActive
    },
    setters: {
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
    },
    refs,
    initialWallY
  };
};

export const resetCoreRefs = (refs) => {
  refs.particlesRef.current = [];
  refs.trailRef.current = [];
  refs.shakeRef.current = 0;
  refs.squashRef.current = 1;
  refs.perfectTimerRef.current && clearTimeout(refs.perfectTimerRef.current);
  refs.perfectTimerRef.current = null;
  refs.runningRef.current = false;
  refs.scoreRef.current = 0;
  refs.driftAmplitudeRef.current = INITIAL_DRIFT;
  refs.driftModeRef.current = 'sine';
  refs.driftPhaseRef.current = 0;
  refs.lastEtaUpdateRef.current = 0;
  refs.activeGapXRef.current = refs.gapXRef.current;
};
