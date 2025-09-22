import type { PRNG } from 'seedrandom';
import type { RunState } from '../state';
import type { PipeEffect } from '../pipes/types';
import type { PipeMaterialKey } from '../pipes/materials';

export type PegTag =
  | 'MULT'
  | 'GROW'
  | 'FORK'
  | 'BANK'
  | 'BIAS_Y+'
  | 'MATERIAL_GLOW'
  | 'MATERIAL_GLASS'
  | 'MATERIAL_CHROME';

export interface PegDefinition {
  id: string;
  position: { x: number; y: number };
  radius: number;
  tags: PegTag[];
}

export interface PegHitResult {
  labels: string[];
  pipeEffects: PipeEffect[];
  coinsDelta: number;
  material?: PipeMaterialKey;
}

export function generatePegLayout(
  width: number,
  height: number,
  rng: PRNG,
): PegDefinition[] {
  const rows = 11;
  const cols = 9;
  const pegRadius = Math.min(width / cols, height / (rows + 4)) * 0.18;
  const horizontalSpacing = width / cols;
  const verticalSpacing = (height * 0.75) / rows;

  const pegs: PegDefinition[] = [];

  for (let row = 0; row < rows; row += 1) {
    const offset = row % 2 === 0 ? 0 : horizontalSpacing / 2;
    for (let col = 0; col < cols; col += 1) {
      const x = offset + (col + 0.5) * horizontalSpacing;
      if (x < pegRadius || x > width - pegRadius) continue;
      const y = height * 0.12 + row * verticalSpacing;
      const tags: PegTag[] = choosePegTags(rng);
      pegs.push({
        id: `peg-${row}-${col}`,
        position: { x, y },
        radius: pegRadius,
        tags,
      });
    }
  }

  return pegs;
}

function choosePegTags(rng: PRNG): PegTag[] {
  const roll = rng.quick();
  if (roll < 0.08) return ['FORK'];
  if (roll < 0.18) return ['GROW'];
  if (roll < 0.28) return ['MULT'];
  if (roll < 0.36) return ['BANK'];
  if (roll < 0.44) return ['BIAS_Y+'];
  if (roll < 0.52) return ['MATERIAL_GLOW'];
  if (roll < 0.6) return ['MATERIAL_GLASS'];
  if (roll < 0.66) return ['MATERIAL_CHROME'];
  return [];
}

export function resolvePegHit(peg: PegDefinition, state: RunState): PegHitResult {
  const labels: string[] = [];
  const pipeEffects: PipeEffect[] = [];
  let coinsDelta = 0;

  for (const tag of peg.tags) {
    switch (tag) {
      case 'MULT':
        pipeEffects.push({ type: 'mult', amount: 0.15 });
        labels.push('MULT +15%');
        break;
      case 'GROW':
        pipeEffects.push({ type: 'grow', amount: 0.3, duration: 3 });
        labels.push('GROW +30%');
        break;
      case 'FORK':
        pipeEffects.push({ type: 'fork', amount: 1 + state.modifiers.forkBonus });
        labels.push('FORK +1');
        break;
      case 'BANK': {
        const bonus = 1 + state.modifiers.bankBonus;
        coinsDelta += bonus;
        labels.push(`BANK +${bonus}c`);
        break;
      }
      case 'BIAS_Y+':
        pipeEffects.push({ type: 'bias', axis: 'y', amount: 2 });
        labels.push('BIAS Y+');
        break;
      case 'MATERIAL_GLOW':
        pipeEffects.push({ type: 'material', material: 'Glow' });
        labels.push('Glow Blend');
        break;
      case 'MATERIAL_GLASS':
        pipeEffects.push({ type: 'material', material: 'Glass' });
        labels.push('Glass Strand');
        break;
      case 'MATERIAL_CHROME':
        pipeEffects.push({ type: 'material', material: 'Chrome' });
        labels.push('Chrome Surge');
        break;
      default:
        break;
    }
  }

  if (peg.tags.length === 0) {
    pipeEffects.push({ type: 'pulse', amount: 1 });
    labels.push('Riff');
  }

  return { labels, pipeEffects, coinsDelta };
}
