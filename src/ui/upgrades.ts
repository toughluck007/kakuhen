import type { UpgradeCard } from '../data/upgrades';

export interface UpgradePanelController {
  element: HTMLElement;
  render(cards: UpgradeCard[], onSelect: (card: UpgradeCard) => void): void;
  setVisible(visible: boolean): void;
  clear(): void;
}

export function createUpgradePanel(parent: HTMLElement): UpgradePanelController {
  const panel = document.createElement('div');
  panel.className = 'upgrade-panel';
  panel.style.display = 'none';
  parent.appendChild(panel);

  return {
    element: panel,
    render(cards, onSelect) {
      panel.innerHTML = '';
      for (const card of cards) {
        const cardEl = document.createElement('div');
        cardEl.className = 'upgrade-card';
        const title = document.createElement('h4');
        title.textContent = card.name;
        const desc = document.createElement('p');
        desc.textContent = card.description;
        cardEl.append(title, desc);
        cardEl.addEventListener('click', () => onSelect(card));
        panel.appendChild(cardEl);
      }
    },
    setVisible(visible) {
      panel.style.display = visible ? 'grid' : 'none';
    },
    clear() {
      panel.innerHTML = '';
    },
  };
}
