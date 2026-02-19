import { Entity, computePolyNormal, computePolyDepth, projectVertex, computePolyMiddle } from './Entity';
import { optimizeModel, makeRecursiveCubeModel, mengerSpongeSplit, makeCubeModel } from './models';
import { makeCooldown, makeSpawner, type Cooldown, type Spawner } from './cooldown';
import {
  BLUE, GREEN, PINK, ORANGE, allColors,
  TARGET_RADIUS, TARGET_HIT_RADIUS, FRAG_RADIUS,
  BACKBOARD_Z, SHADOW_COLOR, AIR_DRAG, GRAVITY,
  SPARK_COLOR, SPARK_THICKNESS, AIR_DRAG_SPARK,
  TOUCH_TRAIL_COLOR, TOUCH_TRAIL_THICKNESS, TOUCH_POINT_LIFE,
  MIN_POINTER_SPEED, HIT_DAMPENING,
  SLOWMO_THRESHOLD, STRONG_THRESHOLD, SPINNER_THRESHOLD,
  DOUBLE_STRONG_ENABLE_SCORE, SLOWMO_DURATION,
  SPAWN_DELAY_MAX, SPAWN_DELAY_MIN,
  CAMERA_FADE_START_Z, CAMERA_FADE_END_Z, CAMERA_FADE_RANGE,
  CAMERA_DISTANCE,
} from './constants';
import { playSound } from './sounds';
import {
  random, randomInt, pickOne, clamp, cloneVertices,
  copyVerticesTo, normalize, shadeColor, TAU, transformVertices,
} from './mathUtils';
import type { Color, Spark, TouchPoint, Poly, ShadowPoly, Vec3 } from '../types/game';
import { GameMode, MenuState } from '../types/game';

export interface GameStateData {
  score: number;
  cubeCount: number;
  menu: MenuState;
  mode: GameMode;
  slowmoPercent: number;
}

export type OnStateChange = (data: Partial<GameStateData>) => void;
export type OnGameEnd = (score: number) => void;

const makeTargetGlueColor = () => 'rgb(170,221,255)';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private viewScale = 1;
  private width = 0;
  private height = 0;
  private gameTime = 0;
  private gameSpeed = 1;
  private score = 0;
  private cubeCount = 0;
  private mode: GameMode = GameMode.RANKED;
  private menu: MenuState = MenuState.MAIN;
  private slowmoRemaining = 0;
  private spawnTime = 0;
  private spawnExtra = 0;
  private spawnExtraDelay = 300;
  private targetSpeed = 1;
  private rafId = 0;
  private lastTimestamp = 0;

  private pointerIsDown = false;
  private pointerScreen = { x: 0, y: 0 };
  private pointerScene = { x: 0, y: 0 };
  private pointerDelta = { x: 0, y: 0 };
  private pointerDeltaScaled = { x: 0, y: 0 };
  private touchPoints: TouchPoint[] = [];

  private targets: Entity[] = [];
  private frags: Entity[] = [];
  private sparks: Spark[] = [];

  private targetPool = new Map<Color, Entity[]>(allColors.map((c) => [c, []]));
  private targetWireframePool = new Map<Color, Entity[]>(allColors.map((c) => [c, []]));
  private fragPool = new Map<Color, Entity[]>(allColors.map((c) => [c, []]));
  private fragWireframePool = new Map<Color, Entity[]>(allColors.map((c) => [c, []]));
  private sparkPool: Spark[] = [];

  private allVertices: Vec3[] = [];
  private allPolys: Poly[] = [];
  private allShadowVertices: Vec3[] = [];
  private allShadowPolys: (ShadowPoly & { middle: Vec3 })[] = [];

  private slowmoSpawner!: Spawner;
  private strongSpawner!: Spawner;
  private spinnerSpawner!: Spawner;
  private allCooldowns: Cooldown[] = [];
  private doubleStrong = false;

  private onStateChange: OnStateChange;
  private onGameEnd: OnGameEnd;

  // Precomputed burst data
  private burstBasePositions: Vec3[];
  private burstPositions: Vec3[];
  private burstPrevPositions: Vec3[];
  private burstVelocities: Vec3[];
  private burstBaseNormals: Vec3[];
  private burstPositionNormals: Vec3[];

  constructor(canvas: HTMLCanvasElement, onStateChange: OnStateChange, onGameEnd: OnGameEnd) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = window.devicePixelRatio || 1;
    this.onStateChange = onStateChange;
    this.onGameEnd = onGameEnd;

    this.burstBasePositions = mengerSpongeSplit({ x: 0, y: 0, z: 0 }, FRAG_RADIUS * 2);
    this.burstPositions = cloneVertices(this.burstBasePositions);
    this.burstPrevPositions = cloneVertices(this.burstBasePositions);
    this.burstVelocities = cloneVertices(this.burstBasePositions);
    this.burstBaseNormals = this.burstBasePositions.map(normalize);
    this.burstPositionNormals = cloneVertices(this.burstBaseNormals);

    this.initSpawners();
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  }

  private initSpawners() {
    const getTime = () => this.gameTime;
    const makeCd = (r: number, u: number) => {
      const cd = makeCooldown(r, u, getTime);
      this.allCooldowns.push(cd);
      return cd;
    };

    this.slowmoSpawner = makeSpawner({ chance: 0.5, cooldownPerSpawn: 10000, maxSpawns: 1 }, getTime);
    this.strongSpawner = makeSpawner({ chance: 0.3, cooldownPerSpawn: 12000, maxSpawns: 1 }, getTime);
    this.spinnerSpawner = makeSpawner({ chance: 0.1, cooldownPerSpawn: 10000, maxSpawns: 1 }, getTime);
  }

  private handleResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.viewScale = h / 1000;
    this.width = w / this.viewScale;
    this.height = h / this.viewScale;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  };

  private getSpawnDelay(): number {
    const delay = SPAWN_DELAY_MAX - this.cubeCount * 3.1;
    return Math.max(delay, SPAWN_DELAY_MIN);
  }

  private isInGame = () => this.menu === MenuState.NONE;
  private isCasual = () => this.mode === GameMode.CASUAL;

  // Target pooling
  private getTargetOfStyle(color: Color, wireframe: boolean): Entity {
    const pool = wireframe ? this.targetWireframePool : this.targetPool;
    let target = pool.get(color)?.pop();
    if (!target) {
      target = new Entity({
        model: optimizeModel(makeRecursiveCubeModel(1, mengerSpongeSplit, TARGET_RADIUS)),
        color,
        wireframe,
      });
      target.color = color;
      target.wireframe = wireframe;
    }
    return target;
  }

  private getTarget(): Entity {
    if (this.doubleStrong && this.score <= DOUBLE_STRONG_ENABLE_SCORE) {
      this.doubleStrong = false;
    } else if (!this.doubleStrong && this.score > DOUBLE_STRONG_ENABLE_SCORE) {
      this.doubleStrong = true;
      this.strongSpawner.mutate({ maxSpawns: 2 });
    }

    let color: Color = pickOne([BLUE, GREEN, ORANGE]);
    let wireframe = false;
    let health = 1;
    const spinner =
      this.cubeCount >= SPINNER_THRESHOLD &&
      this.isInGame() &&
      this.spinnerSpawner.shouldSpawn();

    if (this.cubeCount >= SLOWMO_THRESHOLD && this.slowmoSpawner.shouldSpawn()) {
      color = BLUE;
      wireframe = true;
    } else if (this.cubeCount >= STRONG_THRESHOLD && this.strongSpawner.shouldSpawn()) {
      color = PINK;
      health = 3;
    }

    const target = this.getTargetOfStyle(color, wireframe);
    target.hit = false;
    target.maxHealth = 3;
    target.health = health;
    this.updateTargetHealth(target, 0);

    const spinSpeeds = [Math.random() * 0.1 - 0.05, Math.random() * 0.1 - 0.05];
    if (spinner) {
      spinSpeeds[0] = -0.25;
      spinSpeeds[1] = 0;
      target.rotateZ = random(0, TAU);
    }

    const axisOptions = [['x', 'y'], ['y', 'z'], ['z', 'x']];
    const axes = pickOne(axisOptions);
    spinSpeeds.forEach((speed, i) => {
      if (axes[i] === 'x') target.rotateXD = speed;
      else if (axes[i] === 'y') target.rotateYD = speed;
      else target.rotateZD = speed;
    });

    return target;
  }

  private updateTargetHealth(target: Entity, delta: number) {
    target.health += delta;
    if (!target.wireframe) {
      const sw = target.health - 1;
      const sc = makeTargetGlueColor();
      for (const p of target.polys) {
        p.strokeWidth = sw;
        p.strokeColor = sc;
      }
    }
  }

  private returnTarget(target: Entity) {
    target.reset();
    const pool = target.wireframe ? this.targetWireframePool : this.targetPool;
    pool.get(target.color)?.push(target);
  }

  private getFragForTarget(target: Entity): Entity {
    const pool = target.wireframe ? this.fragWireframePool : this.fragPool;
    let frag = pool.get(target.color)?.pop();
    if (!frag) {
      frag = new Entity({
        model: makeCubeModel(FRAG_RADIUS),
        color: target.color,
        wireframe: target.wireframe,
      });
      frag.color = target.color;
      frag.wireframe = target.wireframe;
    }
    return frag;
  }

  private createBurst(target: Entity, force = 1) {
    const fragCount = this.burstBasePositions.length;
    transformVertices(this.burstBasePositions, this.burstPositions, target.x, target.y, target.z, target.rotateX, target.rotateY, target.rotateZ, 1, 1, 1);
    transformVertices(this.burstBasePositions, this.burstPrevPositions, target.x - target.xD, target.y - target.yD, target.z - target.zD, target.rotateX - target.rotateXD, target.rotateY - target.rotateYD, target.rotateZ - target.rotateZD, 1, 1, 1);

    for (let i = 0; i < fragCount; i++) {
      const pos = this.burstPositions[i];
      const prev = this.burstPrevPositions[i];
      const vel = this.burstVelocities[i];
      vel.x = pos.x - prev.x;
      vel.y = pos.y - prev.y;
      vel.z = pos.z - prev.z;
    }

    transformVertices(this.burstBaseNormals, this.burstPositionNormals, 0, 0, 0, target.rotateX, target.rotateY, target.rotateZ, 1, 1, 1);

    for (let i = 0; i < fragCount; i++) {
      const position = this.burstPositions[i];
      const velocity = this.burstVelocities[i];
      const normal = this.burstPositionNormals[i];
      const frag = this.getFragForTarget(target);
      frag.x = position.x; frag.y = position.y; frag.z = position.z;
      frag.rotateX = target.rotateX; frag.rotateY = target.rotateY; frag.rotateZ = target.rotateZ;

      const burstSpeed = 2 * force;
      const randSpeed = 2 * force;
      const rotateScale = 0.015;
      frag.xD = velocity.x + normal.x * burstSpeed + Math.random() * randSpeed;
      frag.yD = velocity.y + normal.y * burstSpeed + Math.random() * randSpeed;
      frag.zD = velocity.z + normal.z * burstSpeed + Math.random() * randSpeed;
      frag.rotateXD = frag.xD * rotateScale;
      frag.rotateYD = frag.yD * rotateScale;
      frag.rotateZD = frag.zD * rotateScale;
      this.frags.push(frag);
    }
  }

  private addSpark(x: number, y: number, xD: number, yD: number) {
    const spark = this.sparkPool.pop() || {} as Spark;
    spark.x = x + xD * 0.5;
    spark.y = y + yD * 0.5;
    spark.xD = xD; spark.yD = yD;
    spark.life = random(200, 300);
    spark.maxLife = spark.life;
    this.sparks.push(spark);
  }

  private sparkBurst(x: number, y: number, count: number, maxSpeed: number) {
    const angleInc = TAU / count;
    for (let i = 0; i < count; i++) {
      const angle = i * angleInc + angleInc * Math.random();
      const speed = (1 - Math.random() ** 3) * maxSpeed;
      this.addSpark(x, y, Math.sin(angle) * speed, Math.cos(angle) * speed);
    }
  }

  private glueShedSparks(target: Entity) {
    const verts = cloneVertices(target.vertices);
    verts.forEach((v) => {
      if (Math.random() < 0.4) {
        projectVertex(v);
        this.addSpark(v.x, v.y, random(-12, 12), random(-12, 12));
      }
    });
  }

  tick(simTime: number, simSpeed: number, lag: number) {
    this.gameTime += simTime;

    if (this.slowmoRemaining > 0) {
      this.slowmoRemaining -= simTime;
      if (this.slowmoRemaining < 0) this.slowmoRemaining = 0;
      this.targetSpeed = this.pointerIsDown ? 0.075 : 0.3;
    } else {
      const menuPointerDown = this.menu !== MenuState.NONE && this.pointerIsDown;
      this.targetSpeed = menuPointerDown ? 0.025 : 1;
    }

    this.onStateChange({ slowmoPercent: this.slowmoRemaining / SLOWMO_DURATION });

    this.gameSpeed += (this.targetSpeed - this.gameSpeed) / 22 * lag;
    this.gameSpeed = clamp(this.gameSpeed, 0, 1);

    const { width, height } = this;
    const centerX = width / 2;
    const centerY = height / 2;
    const simAirDrag = 1 - AIR_DRAG * simSpeed;
    const simAirDragSpark = 1 - AIR_DRAG_SPARK * simSpeed;

    const forceMultiplier = 1 / (simSpeed * 0.75 + 0.25);
    this.pointerDelta.x = 0; this.pointerDelta.y = 0;
    this.pointerDeltaScaled.x = 0; this.pointerDeltaScaled.y = 0;

    const lastPointer = this.touchPoints[this.touchPoints.length - 1];
    if (this.pointerIsDown && lastPointer && !lastPointer.touchBreak) {
      this.pointerDelta.x = this.pointerScene.x - lastPointer.x;
      this.pointerDelta.y = this.pointerScene.y - lastPointer.y;
      this.pointerDeltaScaled.x = this.pointerDelta.x * forceMultiplier;
      this.pointerDeltaScaled.y = this.pointerDelta.y * forceMultiplier;
    }
    const pointerSpeed = Math.hypot(this.pointerDelta.x, this.pointerDelta.y);
    const pointerSpeedScaled = pointerSpeed * forceMultiplier;

    this.touchPoints.forEach((p) => (p.life -= simTime));
    if (this.pointerIsDown) {
      this.touchPoints.push({ x: this.pointerScene.x, y: this.pointerScene.y, life: TOUCH_POINT_LIFE });
    }
    while (this.touchPoints[0] && this.touchPoints[0].life <= 0) this.touchPoints.shift();

    // Spawn targets
    this.spawnTime -= simTime;
    if (this.spawnTime <= 0) {
      if (this.spawnExtra > 0) {
        this.spawnExtra--;
        this.spawnTime = this.spawnExtraDelay;
      } else {
        this.spawnTime = this.getSpawnDelay();
      }
      const target = this.getTarget();
      const spawnRadius = Math.min(centerX * 0.8, 450);
      target.x = Math.random() * spawnRadius * 2 - spawnRadius;
      target.y = centerY + TARGET_HIT_RADIUS * 2;
      target.z = Math.random() * TARGET_RADIUS * 2 - TARGET_RADIUS;
      target.xD = Math.random() * (target.x * -2 / 120);
      target.yD = -20;
      this.targets.push(target);
    }

    const leftBound = -centerX + TARGET_RADIUS;
    const rightBound = centerX - TARGET_RADIUS;
    const ceiling = -centerY - 120;
    const boundDamping = 0.4;

    targetLoop: for (let i = this.targets.length - 1; i >= 0; i--) {
      const target = this.targets[i];
      target.x += target.xD * simSpeed;
      target.y += target.yD * simSpeed;

      if (target.y < ceiling) { target.y = ceiling; target.yD = 0; }
      if (target.x < leftBound) { target.x = leftBound; target.xD *= -boundDamping; }
      else if (target.x > rightBound) { target.x = rightBound; target.xD *= -boundDamping; }
      if (target.z < BACKBOARD_Z) { target.z = BACKBOARD_Z; target.zD *= -boundDamping; }

      target.yD += GRAVITY * simSpeed;
      target.rotateX += target.rotateXD * simSpeed;
      target.rotateY += target.rotateYD * simSpeed;
      target.rotateZ += target.rotateZD * simSpeed;
      target.transform();
      target.project();

      if (target.y > centerY + TARGET_HIT_RADIUS * 2) {
        this.targets.splice(i, 1);
        this.returnTarget(target);
        if (this.isInGame()) {
          if (this.isCasual()) {
            this.incrementScore(-25);
          } else {
            this.endGame();
          }
        }
        continue;
      }

      const hitTestCount = Math.ceil(pointerSpeed / TARGET_RADIUS * 2);
      for (let ii = 1; ii <= hitTestCount; ii++) {
        const percent = 1 - ii / hitTestCount;
        const hitX = this.pointerScene.x - this.pointerDelta.x * percent;
        const hitY = this.pointerScene.y - this.pointerDelta.y * percent;
        const distance = Math.hypot(hitX - target.projected.x, hitY - target.projected.y);

        if (distance <= TARGET_HIT_RADIUS) {
          if (!target.hit) {
            target.hit = true;
            target.xD += this.pointerDeltaScaled.x * HIT_DAMPENING;
            target.yD += this.pointerDeltaScaled.y * HIT_DAMPENING;
            target.rotateXD += this.pointerDeltaScaled.y * 0.001;
            target.rotateYD += this.pointerDeltaScaled.x * 0.001;

            const sparkSpeed = 7 + pointerSpeedScaled * 0.125;

            if (pointerSpeedScaled > MIN_POINTER_SPEED) {
              target.health--;

              playSound('swoosh');
              this.incrementScore(10);

              if (target.health <= 0) {
                this.incrementCubeCount(1);
                this.createBurst(target, forceMultiplier);
                this.sparkBurst(hitX, hitY, 8, sparkSpeed);
                if (target.wireframe) {
                  this.slowmoRemaining = SLOWMO_DURATION;
                  this.spawnTime = 0;
                  this.spawnExtra = 2;
                }
                this.targets.splice(i, 1);
                this.returnTarget(target);
              } else {
                this.sparkBurst(hitX, hitY, 8, sparkSpeed);
                this.glueShedSparks(target);
                this.updateTargetHealth(target, 0);
              }
            } else {
              this.incrementScore(5);
              this.sparkBurst(hitX, hitY, 3, sparkSpeed);
            }
          }
          continue targetLoop;
        }
      }
      target.hit = false;
    }

    // Animate frags
    const fragBackboardZ = BACKBOARD_Z + FRAG_RADIUS;
    const fragLeftBound = -width;
    const fragRightBound = width;
    for (let i = this.frags.length - 1; i >= 0; i--) {
      const frag = this.frags[i];
      frag.x += frag.xD * simSpeed; frag.y += frag.yD * simSpeed; frag.z += frag.zD * simSpeed;
      frag.xD *= simAirDrag; frag.yD *= simAirDrag; frag.zD *= simAirDrag;
      if (frag.y < ceiling) { frag.y = ceiling; frag.yD = 0; }
      if (frag.z < fragBackboardZ) { frag.z = fragBackboardZ; frag.zD *= -boundDamping; }
      frag.yD += GRAVITY * simSpeed;
      frag.rotateX += frag.rotateXD * simSpeed;
      frag.rotateY += frag.rotateYD * simSpeed;
      frag.rotateZ += frag.rotateZD * simSpeed;
      frag.transform(); frag.project();
      if (frag.projected.y > centerY + TARGET_HIT_RADIUS || frag.projected.x < fragLeftBound || frag.projected.x > fragRightBound || frag.z > CAMERA_FADE_END_Z) {
        this.frags.splice(i, 1);
        frag.reset();
        const pool = frag.wireframe ? this.fragWireframePool : this.fragPool;
        pool.get(frag.color)?.push(frag);
      }
    }

    // Animate sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      spark.life -= simTime;
      if (spark.life <= 0) { this.sparks.splice(i, 1); this.sparkPool.push(spark); continue; }
      spark.x += spark.xD * simSpeed; spark.y += spark.yD * simSpeed;
      spark.xD *= simAirDragSpark; spark.yD *= simAirDragSpark;
      spark.yD += GRAVITY * simSpeed;
    }

    // Aggregate vertices
    this.allVertices.length = 0; this.allPolys.length = 0;
    this.allShadowVertices.length = 0; this.allShadowPolys.length = 0;
    [...this.targets, ...this.frags].forEach((entity) => {
      this.allVertices.push(...entity.vertices);
      this.allPolys.push(...entity.polys);
      this.allShadowVertices.push(...entity.shadowVertices);
      entity.shadowPolys.forEach((sp) => {
        this.allShadowPolys.push(sp as ShadowPoly & { middle: Vec3 });
      });
    });

    this.allPolys.forEach((p) => computePolyNormal(p, 'normalWorld'));
    this.allPolys.forEach(computePolyDepth);
    this.allPolys.sort((a, b) => b.depth - a.depth);
    this.allVertices.forEach(projectVertex);
    this.allPolys.forEach((p) => computePolyNormal(p, 'normalCamera'));

    // Shadows
    transformVertices(this.allShadowVertices, this.allShadowVertices, 0, 0, 0, TAU / 8, 0, 0, 1, 1, 1);
    this.allShadowPolys.forEach((p) => computePolyNormal(p, 'normalWorld'));

    const shadowDistanceMult = Math.hypot(1, 1);
    for (let i = 0; i < this.allShadowVertices.length; i++) {
      const dist = this.allVertices[i].z - BACKBOARD_Z;
      this.allShadowVertices[i].z -= shadowDistanceMult * dist;
    }
    transformVertices(this.allShadowVertices, this.allShadowVertices, 0, 0, 0, -TAU / 8, 0, 0, 1, 1, 1);
    this.allShadowVertices.forEach(projectVertex);
  }

  draw() {
    const ctx = this.ctx;
    const { width, height, dpr, viewScale } = this;
    const halfW = width / 2;
    const halfH = height / 2;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const drawScale = dpr * viewScale;
    ctx.setTransform(drawScale, 0, 0, drawScale, halfW * drawScale, halfH * drawScale);

    ctx.lineJoin = 'bevel';
    ctx.fillStyle = SHADOW_COLOR;
    ctx.strokeStyle = SHADOW_COLOR;

    this.allShadowPolys.forEach((p) => {
      if (p.wireframe) {
        ctx.lineWidth = 2;
        ctx.beginPath();
        const v = p.vertices;
        ctx.moveTo(v[0].x, v[0].y);
        for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.beginPath();
        const v = p.vertices;
        ctx.moveTo(v[0].x, v[0].y);
        for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
        ctx.closePath();
        ctx.fill();
      }
    });

    this.allPolys.forEach((p) => {
      if (!p.wireframe && p.normalCamera.z < 0) return;
      if (p.strokeWidth !== 0) {
        ctx.lineWidth = p.normalCamera.z < 0 ? p.strokeWidth * 0.5 : p.strokeWidth;
        ctx.strokeStyle = p.normalCamera.z < 0 ? p.strokeColorDark : p.strokeColor;
      }
      const verts = p.vertices;
      const lastV = verts[verts.length - 1];
      const fadeOut = p.middle.z > CAMERA_FADE_START_Z;

      if (!p.wireframe) {
        const nl = p.normalWorld.y * 0.5 + p.normalWorld.z * -0.5;
        const lightness = nl > 0 ? 0.1 : ((nl ** 32 - nl) / 2) * 0.9 + 0.1;
        ctx.fillStyle = shadeColor(p.color, lightness);
      }

      if (fadeOut) {
        ctx.globalAlpha = Math.max(0, 1 - (p.middle.z - CAMERA_FADE_START_Z) / CAMERA_FADE_RANGE);
      }

      ctx.beginPath();
      ctx.moveTo(lastV.x, lastV.y);
      for (const v of verts) ctx.lineTo(v.x, v.y);
      if (!p.wireframe) ctx.fill();
      if (p.strokeWidth !== 0) ctx.stroke();
      if (fadeOut) ctx.globalAlpha = 1;
    });

    // Sparks
    ctx.strokeStyle = SPARK_COLOR;
    ctx.lineWidth = SPARK_THICKNESS;
    ctx.beginPath();
    this.sparks.forEach((spark) => {
      ctx.moveTo(spark.x, spark.y);
      const scale = (spark.life / spark.maxLife) ** 0.5 * 1.5;
      ctx.lineTo(spark.x - spark.xD * scale, spark.y - spark.yD * scale);
    });
    ctx.stroke();

    // Touch trail
    ctx.strokeStyle = TOUCH_TRAIL_COLOR;
    const tpCount = this.touchPoints.length;
    for (let i = 1; i < tpCount; i++) {
      const cur = this.touchPoints[i];
      const prev = this.touchPoints[i - 1];
      if (cur.touchBreak || prev.touchBreak) continue;
      const scale = cur.life / TOUCH_POINT_LIFE;
      ctx.lineWidth = scale * TOUCH_TRAIL_THICKNESS;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(cur.x, cur.y);
      ctx.stroke();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Public control methods
  handlePointerDown(x: number, y: number) {
    if (!this.pointerIsDown) {
      this.pointerIsDown = true;
      this.pointerScreen.x = x;
      this.pointerScreen.y = y;
    }
  }

  handlePointerUp() {
    if (this.pointerIsDown) {
      this.pointerIsDown = false;
      this.touchPoints.push({ touchBreak: true, x: 0, y: 0, life: TOUCH_POINT_LIFE });
    }
  }

  handlePointerMove(x: number, y: number) {
    if (this.pointerIsDown) {
      this.pointerScreen.x = x;
      this.pointerScreen.y = y;
    }
  }

  setMenu(menu: MenuState) {
    this.menu = menu;
    this.onStateChange({ menu });
  }

  setMode(mode: GameMode) {
    this.mode = mode;
  }

  resetGame() {
    // Clear all entities
    while (this.targets.length) this.returnTarget(this.targets.pop()!);
    this.frags.length = 0;
    this.sparks.length = 0;

    this.gameTime = 0;
    this.allCooldowns.forEach((cd) => cd.reset());
    this.doubleStrong = false;
    this.slowmoRemaining = 0;
    this.score = 0;
    this.cubeCount = 0;
    this.spawnTime = this.getSpawnDelay();
    this.gameSpeed = 1;

    this.onStateChange({ score: 0, cubeCount: 0, slowmoPercent: 0 });
  }

  pauseGame() {
    if (this.isInGame()) {
      this.menu = MenuState.PAUSE;
      this.onStateChange({ menu: MenuState.PAUSE });
    }
  }

  resumeGame() {
    if (this.menu === MenuState.PAUSE) {
      this.menu = MenuState.NONE;
      this.onStateChange({ menu: MenuState.NONE });
    }
  }

  endGame() {
    this.handlePointerUp();
    this.menu = MenuState.SCORE;
    this.onStateChange({ menu: MenuState.SCORE });
    this.onGameEnd(this.score);
  }

  startLoop() {
    const frame = (timestamp: number) => {
      this.rafId = requestAnimationFrame(frame);
      let frameTime = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;

      if (this.menu === MenuState.PAUSE) return;

      if (frameTime < 0) frameTime = 17;
      else if (frameTime > 68) frameTime = 68;

      const halfW = this.width / 2;
      const halfH = this.height / 2;
      this.pointerScene.x = this.pointerScreen.x / this.viewScale - halfW;
      this.pointerScene.y = this.pointerScreen.y / this.viewScale - halfH;

      const lag = frameTime / 16.6667;
      const simTime = this.gameSpeed * frameTime;
      const simSpeed = this.gameSpeed * lag;

      this.tick(simTime, simSpeed, lag);
      this.draw();
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stopLoop() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
  }

  private incrementScore(inc: number) {
    if (this.isInGame()) {
      this.score += inc;
      if (this.score < 0) this.score = 0;
      this.onStateChange({ score: this.score });
    }
  }

  private incrementCubeCount(inc: number) {
    if (this.isInGame()) {
      this.cubeCount += inc;
      this.onStateChange({ cubeCount: this.cubeCount });
    }
  }
}
