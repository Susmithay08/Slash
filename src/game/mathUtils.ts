import type { Vec3, Color } from '../types/game';

export const PI = Math.PI;
export const TAU = Math.PI * 2;

export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
export const lerp = (a: number, b: number, mix: number) => (b - a) * mix + a;
export const random = (min: number, max: number) => Math.random() * (max - min) + min;
export const randomInt = (min: number, max: number) => ((Math.random() * (max - min + 1)) | 0) + min;
export const pickOne = <T>(arr: T[]): T => arr[(Math.random() * arr.length) | 0];

export const colorToHex = (color: Color): string =>
  '#' +
  (color.r | 0).toString(16).padStart(2, '0') +
  (color.g | 0).toString(16).padStart(2, '0') +
  (color.b | 0).toString(16).padStart(2, '0');

export const shadeColor = (color: Color, lightness: number): string => {
  let other: number, mix: number;
  if (lightness < 0.5) {
    other = 0;
    mix = 1 - lightness * 2;
  } else {
    other = 255;
    mix = lightness * 2 - 1;
  }
  return (
    '#' +
    (lerp(color.r, other, mix) | 0).toString(16).padStart(2, '0') +
    (lerp(color.g, other, mix) | 0).toString(16).padStart(2, '0') +
    (lerp(color.b, other, mix) | 0).toString(16).padStart(2, '0')
  );
};

export const normalize = (v: Vec3): Vec3 => {
  const mag = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
};

export const cloneVertices = (vertices: Vec3[]): Vec3[] =>
  vertices.map((v) => ({ x: v.x, y: v.y, z: v.z }));

export const copyVerticesTo = (arr1: Vec3[], arr2: Vec3[]) => {
  const len = arr1.length;
  for (let i = 0; i < len; i++) {
    arr2[i].x = arr1[i].x;
    arr2[i].y = arr1[i].y;
    arr2[i].z = arr1[i].z;
  }
};

export const add = (a: number) => (b: number) => a + b;
export const scaleVector = (scale: number) => (vector: Vec3) => {
  vector.x *= scale;
  vector.y *= scale;
  vector.z *= scale;
};

export function transformVertices(
  vertices: Vec3[],
  target: Vec3[],
  tX: number, tY: number, tZ: number,
  rX: number, rY: number, rZ: number,
  sX: number, sY: number, sZ: number
) {
  const sinX = Math.sin(rX), cosX = Math.cos(rX);
  const sinY = Math.sin(rY), cosY = Math.cos(rY);
  const sinZ = Math.sin(rZ), cosZ = Math.cos(rZ);

  vertices.forEach((v, i) => {
    const tv = target[i];
    const x1 = v.x;
    const y1 = v.z * sinX + v.y * cosX;
    const z1 = v.z * cosX - v.y * sinX;
    const x2 = x1 * cosY - z1 * sinY;
    const y2 = y1;
    const z2 = x1 * sinY + z1 * cosY;
    const x3 = x2 * cosZ - y2 * sinZ;
    const y3 = x2 * sinZ + y2 * cosZ;
    const z3 = z2;
    tv.x = x3 * sX + tX;
    tv.y = y3 * sY + tY;
    tv.z = z3 * sZ + tZ;
  });
}
