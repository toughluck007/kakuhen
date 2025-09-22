import seedrandom from 'seedrandom';
import type { PRNG } from 'seedrandom';
import type { PipeMaterialKey } from './pipes/materials';

export type RunPhase = 'drop' | 'showcase' | 'compression' | 'upgrades';

export interface RunModifiers {
  pipeValueBonus: number;
  growSpeedBonus: number;
  forkBonus: number;
  bankBonus: number;
  extraBallDrops: number;
  materialBias: Partial<Record<PipeMaterialKey, number>>;
  showcaseBonus: number;
}

export interface RunState {
  baseSeed: string;
  rng: PRNG;
  round: number;
  target: number;
  totalPoints: number;
  roundPoints: number;
  coins: number;
  phase: RunPhase;
  rerolls: number;
  pegHits: number;
  modifiers: RunModifiers;
}

export function createInitialState(seed: string): RunState {
  const rng = seedrandom(seed);
  return {
    baseSeed: seed,
    rng,
    round: 1,
    target: computeTarget(1),
    totalPoints: 0,
    roundPoints: 0,
    coins: 0,
    phase: 'drop',
    rerolls: 0,
    pegHits: 0,
    modifiers: {
      pipeValueBonus: 0,
      growSpeedBonus: 0,
      forkBonus: 0,
      bankBonus: 0,
      extraBallDrops: 0,
      materialBias: {},
      showcaseBonus: 0,
    },
  };
}

export function computeTarget(round: number): number {
  return Math.floor(400 * Math.pow(round, 1.35));
}

export function makeLabelledRng(state: RunState, label: string): PRNG {
  return seedrandom(`${state.baseSeed}|${label}|r${state.round}`);
}

export function addCoins(state: RunState, amount: number): void {
  state.coins = Math.max(0, Math.floor(state.coins + amount));
}

export function addPoints(state: RunState, amount: number): void {
  state.roundPoints = Math.max(0, state.roundPoints + amount);
  state.totalPoints = Math.max(0, state.totalPoints + amount);
}

export function incrementPegHits(state: RunState): void {
  state.pegHits += 1;
}

export function startNextRound(state: RunState): void {
  state.round += 1;
  state.target = computeTarget(state.round);
  state.roundPoints = 0;
  state.pegHits = 0;
  state.phase = 'drop';
}

export function setPhase(state: RunState, phase: RunPhase): void {
  state.phase = phase;
}

export function applyShowcaseRewards(state: RunState, points: number, coinBonus: number): void {
  const totalPoints = Math.floor(points * (1 + state.modifiers.showcaseBonus));
  addPoints(state, totalPoints);
  const coins = Math.floor(totalPoints / 50) + coinBonus;
  addCoins(state, coins);
}

export function registerReroll(state: RunState): void {
  state.rerolls += 1;
}

export function applyUpgradeModifier(state: RunState, modifier: Partial<RunModifiers>): void {
  state.modifiers = {
    ...state.modifiers,
    ...modifier,
    materialBias: {
      ...state.modifiers.materialBias,
      ...(modifier.materialBias ?? {}),
    },
  };
}
