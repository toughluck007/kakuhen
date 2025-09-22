import type { PipeMaterialKey } from './materials';
import { getMaterial } from './materials';
import type { PipeBreakdown } from './types';

export interface PipeScoreInput {
  material: PipeMaterialKey;
  length: number;
  multiplier: number;
}

export interface ScoreContext {
  pipeValueBonus: number;
}

const LENGTH_EXPONENT = 0.85;

export function scorePipe(pipe: PipeScoreInput, context: ScoreContext): number {
  const material = getMaterial(pipe.material);
  const base = material.base;
  const lengthBonus = Math.pow(Math.max(pipe.length, 0.1), LENGTH_EXPONENT);
  const multiplier = 1 + context.pipeValueBonus + pipe.multiplier;
  return base * lengthBonus * multiplier;
}

export function scorePipes(pipes: PipeScoreInput[], context: ScoreContext): PipeBreakdown {
  const breakdown: PipeBreakdown = {
    total: 0,
    byMaterial: {},
    coinBonus: 0,
  };

  for (const pipe of pipes) {
    const value = scorePipe(pipe, context);
    breakdown.total += value;
    breakdown.byMaterial[pipe.material] = (breakdown.byMaterial[pipe.material] ?? 0) + value;
  }

  breakdown.coinBonus = Math.floor(breakdown.total / 200);

  return breakdown;
}
