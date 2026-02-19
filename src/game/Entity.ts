import type { ModelDef, Color, Poly, ShadowPoly, Vec3 } from '../types/game';
import { cloneVertices, copyVerticesTo, colorToHex, shadeColor, transformVertices } from './mathUtils';

const cameraDistance = 900;
const sceneScale = 1;

export function projectVertexTo(v: Vec3, target: Vec3) {
  const focalLength = cameraDistance * sceneScale;
  const depth = focalLength / (cameraDistance - v.z);
  target.x = v.x * depth;
  target.y = v.y * depth;
}

export function projectVertex(v: Vec3) {
  const focalLength = cameraDistance * sceneScale;
  const depth = focalLength / (cameraDistance - v.z);
  v.x = v.x * depth;
  v.y = v.y * depth;
}

export function computeTriMiddle(poly: Poly | ShadowPoly) {
  const v = poly.vertices;
  poly.middle.x = (v[0].x + v[1].x + v[2].x) / 3;
  poly.middle.y = (v[0].y + v[1].y + v[2].y) / 3;
  poly.middle.z = (v[0].z + v[1].z + v[2].z) / 3;
}

export function computeQuadMiddle(poly: Poly | ShadowPoly) {
  const v = poly.vertices;
  poly.middle.x = (v[0].x + v[1].x + v[2].x + v[3].x) / 4;
  poly.middle.y = (v[0].y + v[1].y + v[2].y + v[3].y) / 4;
  poly.middle.z = (v[0].z + v[1].z + v[2].z + v[3].z) / 4;
}

export function computePolyMiddle(poly: Poly | ShadowPoly) {
  if (poly.vertices.length === 3) computeTriMiddle(poly);
  else computeQuadMiddle(poly);
}

export function computePolyDepth(poly: Poly) {
  computePolyMiddle(poly);
  const dX = poly.middle.x;
  const dY = poly.middle.y;
  const dZ = poly.middle.z - cameraDistance;
  poly.depth = Math.hypot(dX, dY, dZ);
}

export function computePolyNormal(poly: Poly | ShadowPoly, normalKey: 'normalWorld' | 'normalCamera') {
  const v1 = poly.vertices[0], v2 = poly.vertices[1], v3 = poly.vertices[2];
  const ax = v1.x - v2.x, ay = v1.y - v2.y, az = v1.z - v2.z;
  const bx = v1.x - v3.x, by = v1.y - v3.y, bz = v1.z - v3.z;
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const mag = Math.hypot(nx, ny, nz);
  const n = poly[normalKey];
  n.x = nx / mag; n.y = ny / mag; n.z = nz / mag;
}

export class Entity {
  model: ModelDef;
  vertices: Vec3[];
  polys: Poly[];
  shadowVertices: Vec3[];
  shadowPolys: ShadowPoly[];
  projected: { x: number; y: number };
  color: Color;
  wireframe: boolean;
  hit = false;
  maxHealth = 0;
  health = 0;

  x = 0; y = 0; z = 0;
  xD = 0; yD = 0; zD = 0;
  rotateX = 0; rotateY = 0; rotateZ = 0;
  rotateXD = 0; rotateYD = 0; rotateZD = 0;
  scaleX = 1; scaleY = 1; scaleZ = 1;

  constructor({ model, color, wireframe = false }: { model: ModelDef; color: Color; wireframe?: boolean }) {
    this.model = model;
    this.color = color;
    this.wireframe = wireframe;
    this.projected = { x: 0, y: 0 };

    const vertices = cloneVertices(model.vertices);
    const shadowVertices = cloneVertices(model.vertices);
    const colorHex = colorToHex(color);
    const darkColorHex = shadeColor(color, 0.4);

    this.vertices = vertices;
    this.shadowVertices = shadowVertices;

    this.polys = model.polys.map((p) => ({
      vertices: p.vIndexes.map((vi) => vertices[vi]),
      color,
      wireframe,
      strokeWidth: wireframe ? 2 : 0,
      strokeColor: colorHex,
      strokeColorDark: darkColorHex,
      depth: 0,
      middle: { x: 0, y: 0, z: 0 },
      normalWorld: { x: 0, y: 0, z: 0 },
      normalCamera: { x: 0, y: 0, z: 0 },
    }));

    this.shadowPolys = model.polys.map((p) => ({
      vertices: p.vIndexes.map((vi) => shadowVertices[vi]),
      wireframe,
      normalWorld: { x: 0, y: 0, z: 0 },
      middle: { x: 0, y: 0, z: 0 },
    }));
  }

  reset() {
    this.x = 0; this.y = 0; this.z = 0;
    this.xD = 0; this.yD = 0; this.zD = 0;
    this.rotateX = 0; this.rotateY = 0; this.rotateZ = 0;
    this.rotateXD = 0; this.rotateYD = 0; this.rotateZD = 0;
    this.scaleX = 1; this.scaleY = 1; this.scaleZ = 1;
    this.projected.x = 0; this.projected.y = 0;
  }

  transform() {
    transformVertices(
      this.model.vertices, this.vertices,
      this.x, this.y, this.z,
      this.rotateX, this.rotateY, this.rotateZ,
      this.scaleX, this.scaleY, this.scaleZ
    );
    copyVerticesTo(this.vertices, this.shadowVertices);
  }

  project() {
    projectVertexTo(this, this.projected);
  }
}
