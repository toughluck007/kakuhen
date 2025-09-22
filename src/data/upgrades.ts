import seedrandom from 'seedrandom';
import type { RunState } from '../state';
import { registerReroll } from '../state';
import type { PipeMaterialKey } from '../pipes/materials';

export type UpgradeTarget = 'peg' | 'pipes' | 'board' | 'global';

export type UpgradeEffect =
  | { kind: 'pipe-multiplier'; amount: number }
  | { kind: 'grow-speed'; amount: number }
  | { kind: 'extra-ball'; amount: number }
  | { kind: 'bank-bonus'; amount: number }
  | { kind: 'fork-bonus'; amount: number }
  | { kind: 'showcase-bonus'; amount: number }
  | { kind: 'material-bias'; material: PipeMaterialKey; amount: number };

export interface UpgradeCard {
  id: string;
  name: string;
  description: string;
  target: UpgradeTarget;
  effect: UpgradeEffect;
  cost?: number;
}

export const UPGRADE_POOL: UpgradeCard[] = [
  {
    id: 'pipe-mult-1',
    name: 'Resonant Alloy',
    description: '+12% pipe value this run.',
    target: 'pipes',
    effect: { kind: 'pipe-multiplier', amount: 0.12 },
  },
  {
    id: 'pipe-mult-2',
    name: 'Spectral Echo',
    description: 'Pipes earn +20% during showcase.',
    target: 'global',
    effect: { kind: 'showcase-bonus', amount: 0.2 },
  },
  {
    id: 'grow-speed-1',
    name: 'Overclocked Pumps',
    description: 'Pipe growth speed +25%.',
    target: 'pipes',
    effect: { kind: 'grow-speed', amount: 0.25 },
  },
  {
    id: 'extra-ball-1',
    name: 'Bonus Drop',
    description: '+1 ball each round.',
    target: 'board',
    effect: { kind: 'extra-ball', amount: 1 },
  },
  {
    id: 'bank-bonus-1',
    name: 'Coin Minters',
    description: 'Bank pegs grant +1 coin.',
    target: 'peg',
    effect: { kind: 'bank-bonus', amount: 1 },
  },
  {
    id: 'fork-bonus-1',
    name: 'Branch Architects',
    description: 'Fork pegs spawn an additional head.',
    target: 'pipes',
    effect: { kind: 'fork-bonus', amount: 1 },
  },
  {
    id: 'material-bias-glass',
    name: 'Glass Harmonics',
    description: 'Pipes lean Glass (+15% chance).',
    target: 'pipes',
    effect: { kind: 'material-bias', material: 'Glass', amount: 0.15 },
  },
  {
    id: 'material-bias-chrome',
    name: 'Chrome Bloom',
    description: 'Pipes lean Chrome (+15% chance).',
    target: 'pipes',
    effect: { kind: 'material-bias', material: 'Chrome', amount: 0.15 },
  },
  {
    id: 'material-bias-glow',
    name: 'Glow Amplifiers',
    description: 'Pipes lean Glow (+15% chance).',
    target: 'pipes',
    effect: { kind: 'material-bias', material: 'Glow', amount: 0.15 },
  },
];

export function rollUpgrades(state: RunState, count = 3): UpgradeCard[] {
  const seed = `${state.baseSeed}|upgrades|round${state.round}|reroll${state.rerolls}`;
  const rng = seedrandom(seed);
  const pool = [...UPGRADE_POOL];
  const picks: UpgradeCard[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const index = Math.floor(rng.quick() * pool.length);
    const [card] = pool.splice(index, 1);
    picks.push(card);
  }
  return picks;
}

export function registerRerollAndRoll(state: RunState, count = 3): UpgradeCard[] {
  registerReroll(state);
  return rollUpgrades(state, count);
}
