import {
  GAME_WIDTH,
  INITIAL_GAP,
  GAP_EDGE_MARGIN,
  MIN_GAP,
  REWARD_FIRST_SCORE,
  REWARD_GAP_BONUS,
  REWARD_INTERVAL,
  REWARD_SIZE,
  REWARD_SPEED_SCALE
} from './constants';
import { clamp } from './physics';

export const spawnReward = (rewardPosRef, wallYRef, setRewardActive) => {
  const margin = 12 + REWARD_SIZE / 2;
  const usable = GAME_WIDTH - margin * 2;
  const x = margin + Math.random() * usable;
  const y = Math.max(140, wallYRef.current - 220);
  rewardPosRef.current = { x, y };
  setRewardActive(true);
};

export const collectReward = ({
  rewardActive,
  rewardPosRef,
  setRewardActive,
  speedRef,
  setSpeed,
  gapWidthRef,
  setGapWidth,
  gapXRef,
  setGapX
}) => {
  if (!rewardActive) return false;
  const { x, y } = rewardPosRef.current;
  setRewardActive(false);
  const slowed = Math.max(speedRef.current * REWARD_SPEED_SCALE, speedRef.current * 0.7);
  speedRef.current = slowed;
  setSpeed(slowed);
  const widened = clamp(gapWidthRef.current + REWARD_GAP_BONUS, MIN_GAP, INITIAL_GAP);
  gapWidthRef.current = widened;
  setGapWidth(widened);
  const minGapX = GAP_EDGE_MARGIN;
  const maxGapX = Math.max(minGapX, GAME_WIDTH - widened - GAP_EDGE_MARGIN);
  const newGapX = clamp(gapXRef.current, minGapX, maxGapX);
  gapXRef.current = newGapX;
  setGapX(newGapX);
  return { x, y };
};

export const shouldSpawnReward = (nextScore, nextRewardScoreRef) => {
  if (nextScore >= nextRewardScoreRef.current) {
    nextRewardScoreRef.current += REWARD_INTERVAL;
    return true;
  }
  return false;
};

export const resetRewards = (nextRewardScoreRef) => {
  nextRewardScoreRef.current = REWARD_FIRST_SCORE;
};
