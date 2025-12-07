import { HITBOX_INSET, LONG_SIDE, MIN_GAP, SHORT_SIDE, SHAPE_LOOKUP, SHAPE_ORDER } from './constants';

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const lerp = (a, b, t) => a + (b - a) * t;

export const driftOffsetForMode = (time, amplitude, mode, phase) => {
  if (mode === 'sine') {
    return Math.sin(time / 700 + phase) * amplitude;
  }
  return 0;
};

export const getShapeSize = (rotation = 0, type = 'rectangle') => {
  const variant = SHAPE_LOOKUP[type] || SHAPE_LOOKUP[SHAPE_ORDER[0]];
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
};
