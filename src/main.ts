import './style.css';

import { BoardSystem } from './board/board';
import type { PegCollisionEvent } from './board/board';
import { resolvePegHit } from './data/pegs';
import { rollUpgrades, type UpgradeCard } from './data/upgrades';
import { PipeSystem } from './pipes/pipes';
import type { PipeBreakdown } from './pipes/types';
import {
  addCoins,
  applyShowcaseRewards,
  applyUpgradeModifier,
  createInitialState,
  setPhase,
  startNextRound,
} from './state';
import { createHud } from './ui/hud';
import { createUpgradePanel } from './ui/upgrades';

const seed = new Date().toISOString().slice(0, 10);
const state = createInitialState(seed);

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app container');
}

const layout = document.createElement('div');
layout.className = 'main-layout';
const boardContainer = document.createElement('div');
boardContainer.className = 'canvas-container';
const pipesContainer = document.createElement('div');
pipesContainer.className = 'canvas-container';
layout.append(boardContainer, pipesContainer);
app.appendChild(layout);

const hud = createHud(boardContainer);
const upgrades = createUpgradePanel(app);

hud.update(state);

const pipeSystem = new PipeSystem({ container: pipesContainer, state });
const boardSystem = new BoardSystem({
  container: boardContainer,
  state,
  onPegHit(event) {
    handlePegHit(event);
  },
  onRoundComplete() {
    handleRoundComplete();
  },
});

function handlePegHit(event: PegCollisionEvent): void {
  if (state.phase !== 'drop') return;
  const peg = event.peg;
  const result = resolvePegHit(peg, state);
  if (result.coinsDelta) {
    addCoins(state, result.coinsDelta);
  }
  pipeSystem.applyEffects(result.pipeEffects);
  hud.pushToast(result.labels);
  hud.update(state);
}

function handleRoundComplete(): void {
  if (state.phase !== 'drop') return;
  setPhase(state, 'showcase');
  hud.setPhase('showcase');
  boardSystem.setPaused(true);
  pipeSystem.startShowcase((breakdown) => {
    onShowcaseFinished(breakdown);
  });
}

function onShowcaseFinished(breakdown: PipeBreakdown): void {
  applyShowcaseRewards(state, breakdown.total, breakdown.coinBonus);
  hud.update(state, breakdown);
  setPhase(state, 'compression');
  hud.setPhase('compression');
  pipeSystem.startCompression(() => {
    enterUpgrades();
  });
}

function enterUpgrades(): void {
  setPhase(state, 'upgrades');
  hud.setPhase('upgrades');
  hud.update(state);
  boardSystem.setPaused(true);
  const cards = rollUpgrades(state);
  upgrades.render(cards, (card) => {
    applyUpgrade(card);
    upgrades.setVisible(false);
    upgrades.clear();
    beginNextRound();
  });
  upgrades.setVisible(true);
}

function applyUpgrade(card: UpgradeCard): void {
  switch (card.effect.kind) {
    case 'pipe-multiplier':
      applyUpgradeModifier(state, {
        pipeValueBonus: state.modifiers.pipeValueBonus + card.effect.amount,
      });
      break;
    case 'grow-speed':
      applyUpgradeModifier(state, {
        growSpeedBonus: state.modifiers.growSpeedBonus + card.effect.amount,
      });
      break;
    case 'extra-ball':
      applyUpgradeModifier(state, {
        extraBallDrops: state.modifiers.extraBallDrops + card.effect.amount,
      });
      break;
    case 'bank-bonus':
      applyUpgradeModifier(state, {
        bankBonus: state.modifiers.bankBonus + card.effect.amount,
      });
      break;
    case 'fork-bonus':
      applyUpgradeModifier(state, {
        forkBonus: state.modifiers.forkBonus + card.effect.amount,
      });
      break;
    case 'showcase-bonus':
      applyUpgradeModifier(state, {
        showcaseBonus: state.modifiers.showcaseBonus + card.effect.amount,
      });
      break;
    case 'material-bias':
      applyUpgradeModifier(state, {
        materialBias: {
          ...state.modifiers.materialBias,
          [card.effect.material]:
            (state.modifiers.materialBias[card.effect.material] ?? 0) + card.effect.amount,
        },
      });
      break;
    default:
      break;
  }
}

function beginNextRound(): void {
  startNextRound(state);
  boardSystem.resetForNextRound();
  boardSystem.setPaused(false);
  pipeSystem.resetSystem();
  hud.update(state);
  hud.setPhase('drop');
}
