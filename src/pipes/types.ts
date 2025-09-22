import type { PipeMaterialKey } from './materials';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type PipeEffectType = 'grow' | 'fork' | 'mult' | 'bias' | 'material' | 'pulse';

export interface PipeEffect {
  type: PipeEffectType;
  amount?: number;
  duration?: number;
  axis?: 'x' | 'y' | 'z';
  material?: PipeMaterialKey;
}

export interface PipeBreakdown {
  total: number;
  byMaterial: Partial<Record<PipeMaterialKey, number>>;
  coinBonus: number;
}

export interface PipeStatsSnapshot {
  pipeCount: number;
  activeHeads: number;
  totalLength: number;
}
