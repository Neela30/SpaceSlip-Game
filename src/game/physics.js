import { HITBOX_INSET, LONG_SIDE, MIN_GAP, SHORT_SIDE, SHAPE_LOOKUP, SHAPE_ORDER } from './constants';

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const lerp = (a, b, t) => a + (b - a) * t;

export const driftOffsetForMode = (time, amplitude, mode, phase) => {
  if (mode === 'sine') {
    return Math.sin(time / 700 + phase) * amplitude;
  }
  return 0;
};

export const getOrientedAABB = ({ x, y, width, height, rotation = 0 }) => {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const wRot = Math.abs(cos) * width + Math.abs(sin) * height;
  const hRot = Math.abs(sin) * width + Math.abs(cos) * height;

  return {
    x: cx - wRot / 2,
    y: cy - hRot / 2,
    width: wRot,
    height: hRot,
    cx,
    cy
  };
};

export const getShapeSize = (_rotation = 0, type = 'rectangle') => {
  const variant = SHAPE_LOOKUP[type] || SHAPE_LOOKUP[SHAPE_ORDER[0]];
  // Compute a single footprint per type; rotation only affects orientation, not size.

  if (variant.kind === 'rectangle') {
    const insetLong = 18;
    const insetShort = 10;
    const usableLong = Math.max(16, variant.long - insetLong * 2);
    const usableShort = Math.max(16, variant.short - insetShort * 2);
    return { width: usableLong, height: usableShort };
  }

  if (variant.kind === 'square') {
    const inset = 12;
    const size = Math.max(16, variant.size - inset * 2);
    return { width: size, height: size };
  }

  if (variant.kind === 'circle') {
    const inset = 14;
    const size = Math.max(16, variant.size - inset * 2);
    return { width: size, height: size };
  }

  if (variant.kind === 'triangle') {
    const insetLong = 16;
    const insetShort = 12;
    const base = variant.size * 0.82;
    const triHeight = base * 0.9;
    const usableBase = Math.max(16, base - insetLong * 2);
    const usableHeight = Math.max(16, triHeight - insetShort * 2);
    return { width: usableBase, height: usableHeight };
  }

  // Fallback to a conservative default if an unknown type is provided.
  return { width: LONG_SIDE - HITBOX_INSET * 2, height: SHORT_SIDE - HITBOX_INSET * 2 };
};
