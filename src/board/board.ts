import p5 from 'p5';
import {
  Body,
  Bodies,
  Composite,
  Engine,
  Events,
  Vector,
  World,
} from 'matter-js';
import type { RunState } from '../state';
import { incrementPegHits, makeLabelledRng } from '../state';
import { generatePegLayout } from '../data/pegs';
import type { PegDefinition } from '../data/pegs';
import { createPegBody, type PegEntity } from './pegs';
import { createBall, type BallEntity } from './balls';
import { DEFAULT_BALL } from '../data/balls';

export interface PegCollisionEvent {
  peg: PegDefinition;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
}

export interface BoardSystemOptions {
  container: HTMLElement;
  state: RunState;
  onPegHit: (event: PegCollisionEvent) => void;
  onRoundComplete: () => void;
}

const BASE_DROPS_PER_ROUND = 6;
const SLOT_COUNT = 6;
const SLOT_WALL_THICKNESS = 16;
const SLOT_SENSOR_HEIGHT = 44;

export class BoardSystem {
  private readonly container: HTMLElement;
  private readonly engine: Engine;
  private readonly world: World;
  private readonly walls: Body[] = [];
  private readonly options: BoardSystemOptions;
  private sketch?: p5;
  private width = 600;
  private height = 800;
  private pegs: PegEntity[] = [];
  private balls: BallEntity[] = [];
  private dropCount = 0;
  private dropCooldown = 0;
  private aimX = this.width / 2;
  private slotWalls: Body[] = [];
  private slotSensors: Array<{ body: Body; index: number }> = [];
  private paused = false;
  private roundCompleteSignalled = false;
  private lastTimestamp = performance.now();

  constructor(options: BoardSystemOptions) {
    this.options = options;
    this.container = options.container;
    this.engine = Engine.create({ enableSleeping: false });
    this.world = this.engine.world;
    this.world.gravity.y = 1.1;

    this.buildBoundaries();
    this.regeneratePegs();
    this.rebuildSlots();
    this.bindCollisions();
    this.createSketch();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  resetForNextRound(): void {
    this.dropCount = 0;
    this.dropCooldown = 0;
    this.roundCompleteSignalled = false;
    this.clearBalls();
    this.regeneratePegs();
    this.aimX = this.clampAim(this.width / 2);
  }

  updateLayout(): void {
    this.width = this.container.clientWidth || this.width;
    this.height = this.container.clientHeight || this.height;
    this.repositionWalls();
    this.regeneratePegs();
    this.rebuildSlots();
    this.dropCount = 0;
    this.roundCompleteSignalled = false;
    this.aimX = this.clampAim(this.aimX);
  }

  private createSketch(): void {
    const self = this;
    this.sketch = new p5((p: p5) => {
      p.setup = () => {
        self.width = self.container.clientWidth || self.width;
        self.height = self.container.clientHeight || self.height;
        const canvas = p.createCanvas(self.width, self.height);
        canvas.parent(self.container);
        p.pixelDensity(1.5);
        self.updateLayout();
      };

      p.windowResized = () => {
        const newWidth = self.container.clientWidth || self.width;
        const newHeight = self.container.clientHeight || self.height;
        self.width = newWidth;
        self.height = newHeight;
        p.resizeCanvas(newWidth, newHeight);
        self.repositionWalls();
        self.rebuildSlots();
        self.aimX = self.clampAim(self.aimX);
      };

      p.draw = () => {
        const now = performance.now();
        const dt = (now - self.lastTimestamp) / 1000;
        self.lastTimestamp = now;
        self.update(dt);
        self.render(p);
      };
    });
  }

  private update(dt: number): void {
    if (!this.paused) {
      Engine.update(this.engine, dt * 1000);
      this.dropCooldown = Math.max(0, this.dropCooldown - dt);
    }

    this.cullBalls();

    const targetDrops = this.getDropsPerRound();
    if (!this.paused && this.dropCount >= targetDrops && this.balls.length === 0 && !this.roundCompleteSignalled) {
      this.roundCompleteSignalled = true;
      this.options.onRoundComplete();
    }
  }

  private render(p: p5): void {
    p.background(5, 12, 24);
    this.drawBackplate(p);
    this.drawSlots(p);
    this.drawPegs(p);
    this.drawBalls(p);
    this.drawAimGuide(p);
    this.drawDropMeter(p);
  }

  private drawBackplate(p: p5): void {
    p.push();
    const gradientSteps = 6;
    for (let i = 0; i < gradientSteps; i += 1) {
      const t = i / gradientSteps;
      const alpha = 80 - t * 60;
      p.noStroke();
      p.fill(12 + t * 40, 45 + t * 10, 92 + t * 8, alpha);
      p.rect(0, (this.height / gradientSteps) * i, this.width, this.height / gradientSteps + 2);
    }
    p.pop();
  }

  private drawSlots(p: p5): void {
    const slotDepth = this.getSlotDepth();
    if (slotDepth <= 0) return;
    const startY = this.height - slotDepth;
    p.push();
    p.noStroke();
    p.fill(8, 24, 48, 180);
    p.rect(0, startY, this.width, slotDepth);
    p.stroke(70, 140, 220, 180);
    p.strokeWeight(2);
    for (let i = 1; i < SLOT_COUNT; i += 1) {
      const x = (this.width / SLOT_COUNT) * i;
      p.line(x, startY + 6, x, this.height - 6);
    }
    p.pop();
  }

  private drawPegs(p: p5): void {
    p.noStroke();
    for (const peg of this.pegs) {
      const { x, y } = peg.definition.position;
      const radius = peg.definition.radius;
      const color = getPegColor(peg.definition);
      p.fill(color.r, color.g, color.b, color.a);
      p.circle(x, y, radius * 2.1);
      p.fill(240, 240, 255, 220);
      p.circle(x, y - radius * 0.15, radius * 1.4);
      p.fill(250, 250, 250, 120);
      p.circle(x + radius * 0.3, y - radius * 0.3, radius * 0.6);
    }
  }

  private drawAimGuide(p: p5): void {
    if (this.options.state.phase !== 'drop') return;
    if (this.dropCount >= this.getDropsPerRound()) return;
    if (this.balls.length > 0) return;

    const radius = this.getBallRadius();
    const x = this.clampAim(this.aimX);
    const top = Math.min(this.height * 0.12, radius * 3);
    const bottom = this.height * 0.22;
    const canDrop = this.canDropBall();
    const strokeColor = canDrop ? [190, 240, 255, 220] : [120, 160, 200, 120];

    p.push();
    p.stroke(strokeColor[0], strokeColor[1], strokeColor[2], strokeColor[3]);
    p.strokeWeight(2);
    p.line(x, top - radius * 0.6, x, bottom);
    p.noStroke();
    p.fill(strokeColor[0], strokeColor[1], strokeColor[2], strokeColor[3]);
    p.circle(x, top - radius * 0.6, radius * 2.2);
    p.pop();
  }

  private drawBalls(p: p5): void {
    for (const ball of this.balls) {
      const { x, y } = ball.body.position;
      p.push();
      p.translate(x, y);
      const radius = ball.spec.radius;
      p.noStroke();
      p.fill(210, 220, 240, 220);
      p.circle(0, 0, radius * 2.2);
      p.fill(255, 255, 255, 200);
      p.circle(-radius * 0.4, -radius * 0.4, radius * 1.1);
      p.fill(180, 190, 220, 120);
      p.circle(radius * 0.4, radius * 0.4, radius * 0.6);
      p.pop();
    }
  }

  private drawDropMeter(p: p5): void {
    const targetDrops = this.getDropsPerRound();
    const meterHeight = this.height * 0.7;
    const meterX = this.width - 24;
    const meterY = this.height * 0.15;
    p.push();
    p.stroke(120, 180, 255, 150);
    p.noFill();
    p.rect(meterX - 8, meterY - 12, 16, meterHeight + 24, 8);
    p.noStroke();
    for (let i = 0; i < targetDrops; i += 1) {
      const filled = i < this.dropCount;
      const y = meterY + meterHeight - (meterHeight / targetDrops) * (i + 1);
      p.fill(filled ? 'rgba(160,220,255,0.8)' : 'rgba(50,90,120,0.35)');
      p.rect(meterX - 6, y + 4, 12, meterHeight / targetDrops - 8, 6);
    }
    p.pop();
  }

  private spawnBallAt(x: number): void {
    const clamped = this.clampAim(x);
    const ball = createBall(DEFAULT_BALL, { x: clamped, y: this.height * 0.05 });
    World.addBody(this.world, ball.body);
    this.balls.push(ball);
  }

  private cullBalls(): void {
    const remaining: BallEntity[] = [];
    for (const ball of this.balls) {
      if (ball.body.position.y > this.height + 120) {
        Composite.remove(this.world, ball.body);
      } else {
        remaining.push(ball);
      }
    }
    this.balls = remaining;
  }

  private clearBalls(): void {
    for (const ball of this.balls) {
      Composite.remove(this.world, ball.body);
    }
    this.balls = [];
  }

  private removeBall(target: BallEntity): void {
    Composite.remove(this.world, target.body);
    this.balls = this.balls.filter((ball) => ball !== target);
  }

  private getDropsPerRound(): number {
    const bonus = Math.max(0, Math.floor(this.options.state.modifiers.extraBallDrops));
    return BASE_DROPS_PER_ROUND + bonus;
  }

  private buildBoundaries(): void {
    const thickness = 80;
    const bottom = Bodies.rectangle(this.width / 2, this.height + thickness / 2, this.width, thickness, {
      isStatic: true,
      label: 'boundary',
    });
    const left = Bodies.rectangle(-thickness / 2, this.height / 2, thickness, this.height * 2, {
      isStatic: true,
      label: 'boundary',
    });
    const right = Bodies.rectangle(this.width + thickness / 2, this.height / 2, thickness, this.height * 2, {
      isStatic: true,
      label: 'boundary',
    });
    this.walls.push(bottom, left, right);
    World.add(this.world, this.walls);
  }

  private repositionWalls(): void {
    if (this.walls.length === 0) return;
    Body.setPosition(this.walls[0], Vector.create(this.width / 2, this.height + 40));
    Body.setPosition(this.walls[1], Vector.create(-40, this.height / 2));
    Body.setPosition(this.walls[2], Vector.create(this.width + 40, this.height / 2));
  }

  private rebuildSlots(): void {
    for (const wall of this.slotWalls) {
      Composite.remove(this.world, wall);
    }
    for (const sensor of this.slotSensors) {
      Composite.remove(this.world, sensor.body);
    }
    this.slotWalls = [];
    this.slotSensors = [];

    const slotDepth = this.getSlotDepth();
    if (slotDepth <= 0) return;
    const baseY = this.height - slotDepth / 2;
    const slotWidth = this.width / SLOT_COUNT;

    for (let i = 0; i <= SLOT_COUNT; i += 1) {
      const x = slotWidth * i;
      const wall = Bodies.rectangle(x, baseY, SLOT_WALL_THICKNESS, slotDepth, {
        isStatic: true,
        label: 'slot-wall',
      });
      this.slotWalls.push(wall);
      World.addBody(this.world, wall);
    }

    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const x = slotWidth * (i + 0.5);
      const sensorWidth = Math.max(24, slotWidth - SLOT_WALL_THICKNESS * 1.4);
      const sensorY = this.height - SLOT_SENSOR_HEIGHT / 2 - 4;
      const sensor = Bodies.rectangle(x, sensorY, sensorWidth, SLOT_SENSOR_HEIGHT, {
        isStatic: true,
        isSensor: true,
        label: 'slot-sensor',
      });
      const plugin = (sensor as Body & { plugin?: Record<string, unknown> }).plugin ?? {};
      plugin.slotIndex = i;
      (sensor as Body & { plugin: Record<string, unknown> }).plugin = plugin;
      this.slotSensors.push({ body: sensor, index: i });
      World.addBody(this.world, sensor);
    }
  }

  private regeneratePegs(): void {
    for (const peg of this.pegs) {
      Composite.remove(this.world, peg.body);
    }
    this.pegs = [];

    const rng = makeLabelledRng(this.options.state, 'board-layout');
    const definitions = generatePegLayout(this.width, this.height, rng);
    for (const def of definitions) {
      const peg = createPegBody(def);
      World.addBody(this.world, peg.body);
      this.pegs.push(peg);
    }
  }

  private bindCollisions(): void {
    Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const { bodyA, bodyB, collision } = pair;
        const pegEntity = this.extractPeg(bodyA) ?? this.extractPeg(bodyB);
        const ballEntity = this.extractBall(bodyA) ?? this.extractBall(bodyB);
        if (pegEntity && ballEntity) {
          incrementPegHits(this.options.state);
          const position = collision.supports[0] ?? ballEntity.body.position;
          const velocity = ballEntity.body.velocity;
          this.options.onPegHit({
            peg: pegEntity.definition,
            position: { x: position.x, y: position.y },
            velocity: { x: velocity.x, y: velocity.y },
          });
        }

        const slotIndex = this.extractSlotSensor(bodyA) ?? this.extractSlotSensor(bodyB);
        if (slotIndex != null && ballEntity) {
          this.handleSlotCapture(slotIndex, ballEntity);
        }
      }
    });
  }

  tryDropBallAt(x?: number): boolean {
    if (this.paused) return false;
    if (this.options.state.phase !== 'drop') return false;
    if (this.balls.length > 0) return false;
    if (this.dropCooldown > 0) return false;
    const targetDrops = this.getDropsPerRound();
    if (this.dropCount >= targetDrops) return false;

    const spawnX = this.clampAim(x ?? this.aimX);
    this.spawnBallAt(spawnX);
    this.dropCount += 1;
    this.dropCooldown = 0.5;
    return true;
  }

  setAimX(x: number): void {
    this.aimX = this.clampAim(x);
  }

  private canDropBall(): boolean {
    if (this.paused) return false;
    if (this.options.state.phase !== 'drop') return false;
    if (this.dropCooldown > 0) return false;
    if (this.balls.length > 0) return false;
    if (this.dropCount >= this.getDropsPerRound()) return false;
    return true;
  }

  private clampAim(x: number): number {
    const radius = this.getBallRadius();
    const margin = radius + 8;
    return Math.min(this.width - margin, Math.max(margin, x));
  }

  private getBallRadius(): number {
    return DEFAULT_BALL.radius;
  }

  private handleSlotCapture(_slot: number, ball: BallEntity): void {
    this.removeBall(ball);
  }

  private extractPeg(body: Body): PegEntity | null {
    if (body.label !== 'peg') return null;
    return this.pegs.find((peg) => peg.body === body) ?? null;
  }

  private extractBall(body: Body): BallEntity | null {
    if (body.label !== 'ball') return null;
    return this.balls.find((ball) => ball.body === body) ?? null;
  }

  private extractSlotSensor(body: Body): number | null {
    if (body.label !== 'slot-sensor') return null;
    const plugin = (body as Body & { plugin?: Record<string, unknown> }).plugin;
    const index = plugin?.slotIndex;
    return typeof index === 'number' ? index : null;
  }

  private getSlotDepth(): number {
    return Math.min(220, this.height * 0.22);
  }
}

function getPegColor(def: PegDefinition): { r: number; g: number; b: number; a: number } {
  if (def.tags.includes('FORK')) return { r: 255, g: 160, b: 90, a: 220 };
  if (def.tags.includes('MULT')) return { r: 120, g: 200, b: 255, a: 220 };
  if (def.tags.includes('GROW')) return { r: 120, g: 255, b: 160, a: 220 };
  if (def.tags.includes('BANK')) return { r: 240, g: 220, b: 120, a: 220 };
  if (def.tags.includes('MATERIAL_GLASS')) return { r: 200, g: 220, b: 255, a: 200 };
  if (def.tags.includes('MATERIAL_CHROME')) return { r: 230, g: 230, b: 255, a: 210 };
  if (def.tags.includes('MATERIAL_GLOW')) return { r: 180, g: 90, b: 255, a: 220 };
  if (def.tags.includes('BIAS_Y+')) return { r: 255, g: 110, b: 160, a: 210 };
  return { r: 120, g: 140, b: 180, a: 180 };
}
