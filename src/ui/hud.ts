import type { PipeBreakdown } from '../pipes/types';
import type { RunPhase, RunState } from '../state';

export interface HudController {
  element: HTMLElement;
  update(state: RunState, breakdown?: PipeBreakdown): void;
  pushToast(labels: string[]): void;
  setPhase(phase: RunPhase): void;
}

export function createHud(parent: HTMLElement): HudController {
  const hud = document.createElement('div');
  hud.className = 'hud';

  const topRow = document.createElement('div');
  topRow.className = 'hud-top';
  const bottomRow = document.createElement('div');
  bottomRow.className = 'toast-container';

  const roundCard = createCard('Round', '1');
  const targetCard = createCard('Target', '0');
  const pointsCard = createCard('Points', '0');
  const coinsCard = createCard('Coins', '0');
  const phaseCard = createCard('Phase', 'Drop');

  topRow.append(roundCard.container, targetCard.container, pointsCard.container, coinsCard.container, phaseCard.container);

  hud.append(topRow, bottomRow);
  parent.appendChild(hud);

  return {
    element: hud,
    update(state, breakdown) {
      roundCard.value.textContent = `R${state.round}`;
      targetCard.value.textContent = state.target.toLocaleString();
      pointsCard.value.textContent = state.roundPoints.toLocaleString();
      coinsCard.value.textContent = `${state.coins}`;
      phaseCard.value.textContent = state.phase.toUpperCase();

      if (breakdown) {
        pointsCard.subtitle.textContent = `Showcase ${Math.round(breakdown.total)} pts`;
        coinsCard.subtitle.textContent = `+${Math.floor(breakdown.total / 50) + breakdown.coinBonus} coins`;
      } else {
        pointsCard.subtitle.textContent = 'Round score';
        coinsCard.subtitle.textContent = 'Bank';
      }
    },
    pushToast(labels) {
      if (labels.length === 0) return;
      for (const label of labels) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = label;
        bottomRow.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => {
          toast.classList.remove('visible');
          setTimeout(() => toast.remove(), 300);
        }, 1600);
      }
    },
    setPhase(phase) {
      phaseCard.value.textContent = phase.toUpperCase();
    },
  };
}

function createCard(title: string, value: string) {
  const container = document.createElement('div');
  container.className = 'hud-card';

  const valueEl = document.createElement('strong');
  valueEl.textContent = value;

  const subtitle = document.createElement('span');
  subtitle.textContent = '';

  const label = document.createElement('div');
  label.textContent = title.toUpperCase();
  label.style.fontSize = '0.7rem';
  label.style.opacity = '0.6';
  label.style.marginBottom = '0.25rem';

  container.append(label, valueEl, subtitle);
  return { container, value: valueEl, subtitle };
}
