import p5 from 'p5';
import type { PRNG } from 'seedrandom';
import type { RunState } from '../state';
import { makeLabelledRng } from '../state';
import { getMaterial, MATERIAL_SEQUENCE, type PipeMaterialKey } from './materials';
import { scorePipes, type PipeScoreInput } from './scoring';
import type { PipeBreakdown, PipeEffect, PipeStatsSnapshot, Vector3 } from './types';

interface Pipe {
  id: number;
  material: PipeMaterialKey;
  points: Vector3[];
  length: number;
  multiplier: number;
  pulse: number;
}

interface PipeHead {
  id: number;
  pipeId: number;
  position: Vector3;
  direction: Vector3;
  bias: Vector3;
  timer: number;
  growInterval: number;
  speedBonus: number;
}

type PipeMode = 'growing' | 'showcase' | 'compression' | 'idle';

export interface PipeSystemOptions {
  container: HTMLElement;
  state: RunState;
}

const BASE_STEP = 28;
const BASE_INTERVAL = 0.45;
const SHOWCASE_DURATION = 4.2;
const COMPRESSION_DURATION = 2.4;
const BOUNDS: Vector3 = { x: 180, y: 210, z: 180 };

export class PipeSystem {
  private readonly container: HTMLElement;
  private readonly state: RunState;
  private sketch?: p5;
  private pipes: Pipe[] = [];
  private heads: PipeHead[] = [];
  private mode: PipeMode = 'growing';
  private rng: PRNG;
  private pipeIdCounter = 0;
  private headIdCounter = 0;
  private showcaseTimer = 0;
  private compressionTimer = 0;
  private cameraAngle = 0;
  private pendingShowcaseCallback?: (breakdown: PipeBreakdown) => void;
  private pendingCompressionCallback?: () => void;
  private lastTimestamp = performance.now();

  constructor(options: PipeSystemOptions) {
    this.container = options.container;
    this.state = options.state;
    this.rng = makeLabelledRng(this.state, 'pipes');
    this.createSketch();
    this.resetSystem();
  }

  applyEffects(effects: PipeEffect[]): void {
    if (effects.length === 0) return;
    for (const effect of effects) {
      const head = this.pickHead();
      if (!head) break;
      const pipe = this.pipes.find((p) => p.id === head.pipeId);
      if (!pipe) continue;
      switch (effect.type) {
        case 'grow':
          head.speedBonus += effect.amount ?? 0.2;
          head.growInterval = Math.max(0.12, head.growInterval * (1 - (effect.amount ?? 0.2)));
          pipe.pulse = 1.2;
          break;
        case 'fork': {
          const forks = Math.max(1, Math.round(effect.amount ?? 1));
          for (let i = 0; i < forks; i += 1) {
            this.spawnFork(head, pipe.material);
          }
          pipe.pulse = 1.1;
          break;
        }
        case 'mult':
          pipe.multiplier += effect.amount ?? 0.1;
          pipe.pulse = 1.25;
          break;
        case 'bias':
          if (effect.axis === 'x') {
            head.bias.x += effect.amount ?? 1;
          } else if (effect.axis === 'y') {
            head.bias.y += effect.amount ?? 1;
          } else if (effect.axis === 'z') {
            head.bias.z += effect.amount ?? 1;
          }
          pipe.pulse = 1.05;
          break;
        case 'material':
          if (effect.material) {
            pipe.material = effect.material;
            pipe.pulse = 1.3;
          }
          break;
        case 'pulse':
          pipe.pulse = Math.max(pipe.pulse, 1 + (effect.amount ?? 0.2));
          break;
        default:
          break;
      }
    }
  }

  tick(): void {
    const now = performance.now();
    const dt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    this.update(dt);
  }

  startShowcase(callback: (breakdown: PipeBreakdown) => void): void {
    this.mode = 'showcase';
    this.showcaseTimer = 0;
    this.pendingShowcaseCallback = callback;
  }

  startCompression(onComplete: () => void): void {
    this.mode = 'compression';
    this.compressionTimer = 0;
    this.pendingCompressionCallback = onComplete;
  }

  resetSystem(): void {
    this.pipes = [];
    this.heads = [];
    this.pipeIdCounter = 0;
    this.headIdCounter = 0;
    this.mode = 'growing';
    this.rng = makeLabelledRng(this.state, `pipes-round-${this.state.round}`);
    this.spawnInitialPipes();
  }

  getBreakdown(): PipeBreakdown {
    const inputs: PipeScoreInput[] = this.pipes.map((pipe) => ({
      material: pipe.material,
      length: pipe.length,
      multiplier: pipe.multiplier,
    }));
    const breakdown = scorePipes(inputs, {
      pipeValueBonus: this.state.modifiers.pipeValueBonus,
    });
    return breakdown;
  }

  getStats(): PipeStatsSnapshot {
    return {
      pipeCount: this.pipes.length,
      activeHeads: this.heads.length,
      totalLength: this.pipes.reduce((acc, pipe) => acc + pipe.length, 0),
    };
  }

  private createSketch(): void {
    const self = this;
    this.sketch = new p5((p: p5) => {
      p.setup = () => {
        const canvas = p.createCanvas(
          self.container.clientWidth || 640,
          self.container.clientHeight || 640,
          p.WEBGL,
        );
        canvas.parent(self.container);
        p.colorMode(p.HSB, 360, 100, 100, 1);
        p.noStroke();
      };

      p.windowResized = () => {
        p.resizeCanvas(self.container.clientWidth, self.container.clientHeight);
      };

      p.draw = () => {
        self.tick();
        self.render(p);
      };
    });
  }

  private update(dt: number): void {
    switch (this.mode) {
      case 'growing':
        this.tickGrowth(dt);
        break;
      case 'showcase':
        this.showcaseTimer += dt;
        if (this.showcaseTimer >= SHOWCASE_DURATION) {
          this.mode = 'compression';
          this.compressionTimer = 0;
          this.pendingShowcaseCallback?.(this.getBreakdown());
          this.pendingShowcaseCallback = undefined;
        }
        break;
      case 'compression':
        this.compressionTimer += dt;
        if (this.compressionTimer >= COMPRESSION_DURATION) {
          this.mode = 'idle';
          this.pendingCompressionCallback?.();
          this.pendingCompressionCallback = undefined;
        }
        break;
      default:
        break;
    }

    this.cameraAngle += dt * 0.35;
    this.updatePulses(dt);
  }

  private tickGrowth(dt: number): void {
    const globalSpeed = 1 + this.state.modifiers.growSpeedBonus;
    for (const head of this.heads) {
      const pipe = this.pipes.find((p) => p.id === head.pipeId);
      if (!pipe) continue;
      const materialStep = getMaterial(pipe.material).step;
      const interval = head.growInterval * (1 / materialStep);
      head.timer += dt * (1 + head.speedBonus) * globalSpeed;
      while (head.timer >= interval) {
        head.timer -= interval;
        this.extendHead(head, pipe);
      }
    }
  }

  private extendHead(head: PipeHead, pipe: Pipe): void {
    const direction = this.chooseDirection(head);
    head.direction = direction;
    const step = BASE_STEP;
    const next: Vector3 = {
      x: clamp(head.position.x + direction.x * step, -BOUNDS.x, BOUNDS.x),
      y: clamp(head.position.y + direction.y * step, -BOUNDS.y, BOUNDS.y),
      z: clamp(head.position.z + direction.z * step, -BOUNDS.z, BOUNDS.z),
    };
    head.position = next;
    pipe.points.push({ ...next });
    pipe.length += step;
    pipe.pulse = Math.max(pipe.pulse, 1.05);
  }

  private chooseDirection(head: PipeHead): Vector3 {
    const candidates: Vector3[] = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 },
    ];
    const weights = candidates.map((dir) => {
      let weight = 1;
      if (sameDirection(dir, head.direction)) weight += 3;
      weight += head.bias.x * dir.x + head.bias.y * dir.y + head.bias.z * dir.z;
      return Math.max(0.05, weight);
    });
    const total = weights.reduce((acc, w) => acc + w, 0);
    let roll = this.rng.quick() * total;
    for (let i = 0; i < candidates.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) return { ...candidates[i] };
    }
    return { ...candidates[0] };
  }

  private pickHead(): PipeHead | undefined {
    if (this.heads.length === 0) return undefined;
    const index = Math.floor(this.rng.quick() * this.heads.length);
    return this.heads[index];
  }

  private spawnFork(source: PipeHead, inheritMaterial: PipeMaterialKey): void {
    const material = this.pickMaterial(inheritMaterial);
    const pipe = this.createPipe(material, { ...source.position });
    const direction = this.chooseForkDirection(source.direction);
    const head: PipeHead = {
      id: this.headIdCounter++,
      pipeId: pipe.id,
      position: { ...source.position },
      direction,
      bias: { ...source.bias },
      timer: 0,
      growInterval: BASE_INTERVAL,
      speedBonus: 0.15,
    };
    this.heads.push(head);
  }

  private chooseForkDirection(previous: Vector3): Vector3 {
    const axis = this.rng.quick();
    if (axis < 0.33) return { x: previous.z, y: previous.y, z: -previous.x };
    if (axis < 0.66) return { x: -previous.y, y: previous.x, z: previous.z };
    return { x: previous.x, y: -previous.z, z: previous.y };
  }

  private spawnInitialPipes(): void {
    const positions: Vector3[] = [
      { x: -80, y: -140, z: 0 },
      { x: 80, y: -140, z: 0 },
      { x: 0, y: -60, z: 0 },
    ];
    for (const pos of positions) {
      const material = this.pickMaterial();
      const pipe = this.createPipe(material, { ...pos });
      const head: PipeHead = {
        id: this.headIdCounter++,
        pipeId: pipe.id,
        position: { ...pos },
        direction: { x: 0, y: 1, z: 0 },
        bias: { x: 0, y: 1, z: 0 },
        timer: 0,
        growInterval: BASE_INTERVAL,
        speedBonus: 0,
      };
      this.heads.push(head);
    }
  }

  private createPipe(material: PipeMaterialKey, origin: Vector3): Pipe {
    const pipe: Pipe = {
      id: this.pipeIdCounter++,
      material,
      points: [origin],
      length: 0,
      multiplier: 0,
      pulse: 0,
    };
    this.pipes.push(pipe);
    return pipe;
  }

  private pickMaterial(preferred?: PipeMaterialKey): PipeMaterialKey {
    const bias = this.state.modifiers.materialBias;
    const weights = MATERIAL_SEQUENCE.map((material) => {
      let weight = 1 + (bias[material] ?? 0);
      if (preferred && material === preferred) weight += 0.3;
      return Math.max(weight, 0.05);
    });
    const total = weights.reduce((acc, w) => acc + w, 0);
    let roll = this.rng.quick() * total;
    for (let i = 0; i < MATERIAL_SEQUENCE.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) return MATERIAL_SEQUENCE[i];
    }
    return MATERIAL_SEQUENCE[0];
  }

  private updatePulses(dt: number): void {
    for (const pipe of this.pipes) {
      if (pipe.pulse <= 0) continue;
      pipe.pulse = Math.max(0, pipe.pulse - dt * 1.6);
    }
  }

  private render(p: p5): void {
    if (!this.sketch) return;
    const width = this.container.clientWidth || 640;
    const height = this.container.clientHeight || 640;
    p.background(210, 60, 8);
    p.ambientLight(40);
    p.directionalLight(255, 255, 255, 0.5, -0.6, -0.4);
    p.pointLight(255, 120, 255, 0, -200, 400);
    p.pointLight(120, 200, 255, 200, 100, -200);
    (p as unknown as { orbitControl?: (sensitivityX?: number, sensitivityY?: number) => void }).orbitControl?.(
      0.7,
      0.4,
    );

    p.push();
    const compressionProgress = this.mode === 'compression' ? clamp(this.compressionTimer / COMPRESSION_DURATION, 0, 1) : 0;
    const showcaseTilt = this.mode === 'showcase' ? Math.sin(this.showcaseTimer * 1.2) * 0.15 : 0;
    p.translate(0, 80, -280);
    p.rotateX(-0.9 + showcaseTilt);
    p.rotateY(this.cameraAngle * (this.mode === 'growing' ? 0.4 : 0.7));
    const scale = 1 - compressionProgress * 0.8;
    p.scale(scale, scale, scale);

    this.drawPipeBase(p, width, height, compressionProgress);
    for (const pipe of this.pipes) {
      this.drawPipe(p, pipe, compressionProgress);
    }
    p.pop();

    if (this.mode === 'showcase') {
      this.drawBreakdownOverlay(p, width, height);
    }
  }

  private drawPipeBase(p: p5, width: number, height: number, compressionProgress: number): void {
    p.push();
    const shrink = 1 - compressionProgress * 0.5;
    p.translate(0, BOUNDS.y + 40, 0);
    p.scale(shrink, 0.5 * shrink, shrink);
    p.fill(220, 30, 12, 0.5);
    p.box(width * 0.6, 50, height * 0.25, 1, 1);
    p.pop();
  }

  private drawPipe(p: p5, pipe: Pipe, compressionProgress: number): void {
    if (pipe.points.length < 2) return;
    const material = getMaterial(pipe.material);
    const hue = material.color[0];
    const sat = material.color[1];
    const bri = material.color[2];
    const alpha = 0.8 + Math.min(0.2, pipe.pulse * 0.2);
    const thickness = 10 + Math.min(18, pipe.pulse * 14);

    p.push();
    p.stroke(hue, sat, bri, alpha);
    p.noFill();
    p.strokeWeight(thickness);
    p.beginShape();
    for (const point of pipe.points) {
      p.vertex(point.x, point.y, point.z);
    }
    p.endShape();
    p.pop();

    const head = this.heads.find((h) => h.pipeId === pipe.id);
    if (head) {
      p.push();
      p.translate(head.position.x, head.position.y, head.position.z);
      p.ambientMaterial(hue, sat * 0.4, Math.min(100, bri + 10));
      p.sphere(12 + Math.min(8, pipe.pulse * 6), 12, 12);
      p.pop();
    }

    if (compressionProgress > 0) {
      p.push();
      p.translate(0, 0, 0);
      p.fill(hue, sat * 0.2, Math.min(100, bri + 20), 0.4);
      p.noStroke();
      const scale = 1 - compressionProgress * 0.8;
      p.scale(scale, scale, scale);
      for (const point of pipe.points) {
        p.push();
        p.translate(point.x, point.y * (1 - compressionProgress), point.z);
        p.sphere(4, 6, 6);
        p.pop();
      }
      p.pop();
    }
  }

  private drawBreakdownOverlay(p: p5, width: number, height: number): void {
    const breakdown = this.getBreakdown();
    const total = breakdown.total;
    const materials = Object.entries(breakdown.byMaterial ?? {});
    p.push();
    p.resetMatrix();
    p.translate(-width / 2 + 24, -height / 2 + 32, 0);
    p.fill(0, 0, 0, 0.5);
    p.rect(0, 0, 260, 28 + materials.length * 20, 8);
    p.fill(210, 40, 95, 1);
    p.textSize(14);
    p.text(`Breakdown`, 12, 18);
    p.fill(200, 30, 95, 1);
    p.textSize(12);
    p.text(`Total ${total.toFixed(0)} pts`, 12, 36);
    let y = 56;
    for (const [key, value] of materials) {
      const mat = getMaterial(key as PipeMaterialKey);
      p.fill(mat.color[0], mat.color[1], mat.color[2], 0.9);
      p.text(`${key}: ${value.toFixed(0)}`, 12, y);
      y += 18;
    }
    p.pop();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sameDirection(a: Vector3, b: Vector3): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}
