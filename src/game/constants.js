export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;
export const LONG_SIDE = 138;
export const SHORT_SIDE = 46;
export const WALL_HEIGHT = 18;
export const INITIAL_GAP = 210;
export const MIN_GAP = 74;
export const INITIAL_SPEED = 1.1;
export const SPEED_STEP = 0.2;
export const GAP_SHRINK = 6.4;
export const INITIAL_DRIFT = 8;
export const DRIFT_STEP = 0.9;
export const MAX_DRIFT = 40;
export const MAX_SPEED = 11;
export const PERFECT_TOLERANCE = 12;
export const FALL_MULTIPLIER = 1.7;
export const ROTATION_STEP = 90;
export const TRAIL_LENGTH = 8;
export const MAX_PARTICLES = 140;
export const STAR_COUNT = 42;
export const HITBOX_INSET = 8;
export const VISUAL_SCALE = 1.12;
export const REWARD_FIRST_SCORE = 10;
export const REWARD_INTERVAL = 4;
export const REWARD_SIZE = 28;
export const REWARD_GAP_BONUS = 28;
export const REWARD_SPEED_SCALE = 0.72;

export const SHAPE_VARIANTS = [
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

export const SHAPE_LOOKUP = SHAPE_VARIANTS.reduce((acc, shape) => {
  acc[shape.id] = shape;
  return acc;
}, {});

export const SHAPE_ORDER = ['circle', 'square', 'rectangle', 'triangle'];
