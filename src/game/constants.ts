import type { Color } from '../types/game';

export const BLUE: Color   = { r: 0x67, g: 0xd7, b: 0xf0 };
export const GREEN: Color  = { r: 0xa6, g: 0xe0, b: 0x2c };
export const PINK: Color   = { r: 0xfa, g: 0x24, b: 0x73 };
export const ORANGE: Color = { r: 0xfe, g: 0x95, b: 0x22 };
export const allColors: Color[] = [BLUE, GREEN, PINK, ORANGE];

export const CAMERA_DISTANCE = 900;
export const SCENE_SCALE = 1;
export const CAMERA_FADE_START_Z = 0.45 * CAMERA_DISTANCE;
export const CAMERA_FADE_END_Z = 0.65 * CAMERA_DISTANCE;
export const CAMERA_FADE_RANGE = CAMERA_FADE_END_Z - CAMERA_FADE_START_Z;

export const BACKBOARD_Z = -400;
export const SHADOW_COLOR = '#262e36';
export const AIR_DRAG = 0.022;
export const GRAVITY = 0.3;

export const SPARK_COLOR = 'rgba(170,221,255,.9)';
export const SPARK_THICKNESS = 2.2;
export const AIR_DRAG_SPARK = 0.1;

export const TOUCH_TRAIL_COLOR = 'rgba(170,221,255,.62)';
export const TOUCH_TRAIL_THICKNESS = 7;
export const TOUCH_POINT_LIFE = 120;

export const TARGET_RADIUS = 40;
export const TARGET_HIT_RADIUS = 50;
export const FRAG_RADIUS = TARGET_RADIUS / 3;

export const MIN_POINTER_SPEED = 60;
export const HIT_DAMPENING = 0.1;

export const SLOWMO_THRESHOLD = 10;
export const STRONG_THRESHOLD = 25;
export const SPINNER_THRESHOLD = 25;
export const DOUBLE_STRONG_ENABLE_SCORE = 2000;
export const SLOWMO_DURATION = 1500;

export const SPAWN_DELAY_MAX = 1400;
export const SPAWN_DELAY_MIN = 550;

export const HIGH_SCORE_KEY = '__slash__highScore';
