export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Color {
  r: number;
  g: number;
  b: number;
}

export interface Poly {
  vertices: Vec3[];
  color: Color;
  wireframe: boolean;
  strokeWidth: number;
  strokeColor: string;
  strokeColorDark: string;
  depth: number;
  middle: Vec3;
  normalWorld: Vec3;
  normalCamera: Vec3;
}

export interface ShadowPoly {
  vertices: Vec3[];
  wireframe: boolean;
  normalWorld: Vec3;
}

export interface ModelDef {
  vertices: Vec3[];
  polys: { vIndexes: number[] }[];
}

export interface Spark {
  x: number;
  y: number;
  xD: number;
  yD: number;
  life: number;
  maxLife: number;
}

export interface TouchPoint {
  x: number;
  y: number;
  life: number;
  touchBreak?: boolean;
}

export enum GameMode {
  RANKED = 'RANKED',
  CASUAL = 'CASUAL',
}

export enum MenuState {
  MAIN = 'MAIN',
  PAUSE = 'PAUSE',
  SCORE = 'SCORE',
  NONE = 'NONE',
}

export interface GameState {
  mode: GameMode;
  time: number;
  score: number;
  cubeCount: number;
  menu: MenuState;
  highScore: number;
}
