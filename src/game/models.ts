import type { ModelDef, Vec3 } from '../types/game';
import { scaleVector, cloneVertices, add } from './mathUtils';

export function makeCubeModel(scale = 1): ModelDef {
  return {
    vertices: [
      { x: -scale, y: -scale, z: scale },
      { x: scale, y: -scale, z: scale },
      { x: scale, y: scale, z: scale },
      { x: -scale, y: scale, z: scale },
      { x: -scale, y: -scale, z: -scale },
      { x: scale, y: -scale, z: -scale },
      { x: scale, y: scale, z: -scale },
      { x: -scale, y: scale, z: -scale },
    ],
    polys: [
      { vIndexes: [0, 1, 2, 3] },
      { vIndexes: [7, 6, 5, 4] },
      { vIndexes: [3, 2, 6, 7] },
      { vIndexes: [4, 5, 1, 0] },
      { vIndexes: [5, 6, 2, 1] },
      { vIndexes: [0, 3, 7, 4] },
    ],
  };
}

export function mengerSpongeSplit(o: Vec3, s: number): Vec3[] {
  return [
    { x: o.x + s, y: o.y - s, z: o.z + s },
    { x: o.x + s, y: o.y - s, z: o.z + 0 },
    { x: o.x + s, y: o.y - s, z: o.z - s },
    { x: o.x + 0, y: o.y - s, z: o.z + s },
    { x: o.x + 0, y: o.y - s, z: o.z - s },
    { x: o.x - s, y: o.y - s, z: o.z + s },
    { x: o.x - s, y: o.y - s, z: o.z + 0 },
    { x: o.x - s, y: o.y - s, z: o.z - s },
    { x: o.x + s, y: o.y + s, z: o.z + s },
    { x: o.x + s, y: o.y + s, z: o.z + 0 },
    { x: o.x + s, y: o.y + s, z: o.z - s },
    { x: o.x + 0, y: o.y + s, z: o.z + s },
    { x: o.x + 0, y: o.y + s, z: o.z - s },
    { x: o.x - s, y: o.y + s, z: o.z + s },
    { x: o.x - s, y: o.y + s, z: o.z + 0 },
    { x: o.x - s, y: o.y + s, z: o.z - s },
    { x: o.x + s, y: o.y + 0, z: o.z + s },
    { x: o.x + s, y: o.y + 0, z: o.z - s },
    { x: o.x - s, y: o.y + 0, z: o.z + s },
    { x: o.x - s, y: o.y + 0, z: o.z - s },
  ];
}

export function makeRecursiveCubeModel(
  recursionLevel: number,
  splitFn: (o: Vec3, s: number) => Vec3[],
  scale = 1
): ModelDef {
  const getScaleAtLevel = (level: number) => 1 / 3 ** level;
  let cubeOrigins: Vec3[] = [{ x: 0, y: 0, z: 0 }];

  for (let i = 1; i <= recursionLevel; i++) {
    const s = getScaleAtLevel(i) * 2;
    const next: Vec3[] = [];
    cubeOrigins.forEach((o) => next.push(...splitFn(o, s)));
    cubeOrigins = next;
  }

  const finalModel: ModelDef = { vertices: [], polys: [] };
  const cubeModel = makeCubeModel(1);
  cubeModel.vertices.forEach(scaleVector(getScaleAtLevel(recursionLevel)));

  cubeOrigins.forEach((origin, cubeIndex) => {
    finalModel.vertices.push(
      ...cubeModel.vertices.map((v) => ({
        x: (v.x + origin.x) * scale,
        y: (v.y + origin.y) * scale,
        z: (v.z + origin.z) * scale,
      }))
    );
    finalModel.polys.push(
      ...cubeModel.polys.map((poly) => ({
        vIndexes: poly.vIndexes.map(add(cubeIndex * 8)),
      }))
    );
  });

  return finalModel;
}

export function optimizeModel(model: ModelDef, threshold = 0.0001): ModelDef {
  const { vertices, polys } = model;
  const extVertices = vertices as (Vec3 & { originalIndexes: number[] })[];

  const compareV = (a: Vec3, b: Vec3) =>
    Math.abs(a.x - b.x) < threshold &&
    Math.abs(a.y - b.y) < threshold &&
    Math.abs(a.z - b.z) < threshold;

  const comparePolys = (p1: { vIndexes: number[] }, p2: { vIndexes: number[] }) => {
    const v1 = p1.vIndexes, v2 = p2.vIndexes;
    return (
      (v1[0] === v2[0] || v1[0] === v2[1] || v1[0] === v2[2] || v1[0] === v2[3]) &&
      (v1[1] === v2[0] || v1[1] === v2[1] || v1[1] === v2[2] || v1[1] === v2[3]) &&
      (v1[2] === v2[0] || v1[2] === v2[1] || v1[2] === v2[2] || v1[2] === v2[3]) &&
      (v1[3] === v2[0] || v1[3] === v2[1] || v1[3] === v2[2] || v1[3] === v2[3])
    );
  };

  extVertices.forEach((v, i) => { v.originalIndexes = [i]; });

  for (let i = extVertices.length - 1; i >= 0; i--) {
    for (let ii = i - 1; ii >= 0; ii--) {
      if (compareV(extVertices[i], extVertices[ii])) {
        const removed = extVertices.splice(i, 1)[0];
        extVertices[ii].originalIndexes.push(...removed.originalIndexes);
        break;
      }
    }
  }

  extVertices.forEach((v, i) => {
    polys.forEach((p) => {
      p.vIndexes.forEach((vi, ii, arr) => {
        if (v.originalIndexes.includes(vi)) arr[ii] = i;
      });
    });
  });

  const extPolys = polys as ({ vIndexes: number[]; sum?: number })[];
  extPolys.forEach((p) => { p.sum = p.vIndexes[0] + p.vIndexes[1] + p.vIndexes[2] + p.vIndexes[3]; });
  extPolys.sort((a, b) => (b.sum ?? 0) - (a.sum ?? 0));

  for (let i = extPolys.length - 1; i >= 0; i--) {
    for (let ii = i - 1; ii >= 0; ii--) {
      if (extPolys[i].sum !== extPolys[ii].sum) break;
      if (comparePolys(extPolys[i], extPolys[ii])) {
        extPolys.splice(i, 1);
        extPolys.splice(ii, 1);
        i--;
        break;
      }
    }
  }

  return model;
}
