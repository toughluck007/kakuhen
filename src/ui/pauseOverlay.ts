export interface PauseOverlayController {
  element: HTMLElement;
  show(): void;
  hide(): void;
  toggle(force?: boolean): void;
  isVisible(): boolean;
  onResume(handler: () => void): void;
}

export function createPauseOverlay(parent: HTMLElement): PauseOverlayController {
  const overlay = document.createElement('div');
  overlay.className = 'pause-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('div');
  panel.className = 'pause-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const title = document.createElement('h2');
  title.textContent = 'Paused';

  const description = document.createElement('p');
  description.textContent = 'Aim and drop balls manually to test the board layout.';

  const controlsHeading = document.createElement('h3');
  controlsHeading.textContent = 'Controls';

  const controlList = document.createElement('dl');
  controlList.className = 'control-list';

  addControl(controlList, 'Mouse Move', 'Aim the drop position.');
  addControl(controlList, 'Left Click or Space', 'Drop the current ball.');
  addControl(controlList, 'Esc or P', 'Toggle this pause menu.');

  const hint = document.createElement('p');
  hint.className = 'pause-hint';
  hint.textContent = 'Runs end automatically when a ball settles in a bottom slot.';

  const resumeButton = document.createElement('button');
  resumeButton.type = 'button';
  resumeButton.textContent = 'Resume (Esc)';

  panel.append(title, description, controlsHeading, controlList, hint, resumeButton);
  overlay.appendChild(panel);
  parent.appendChild(overlay);

  const resumeHandlers: Array<() => void> = [];
  function triggerResume(): void {
    for (const handler of resumeHandlers) {
      handler();
    }
  }

  resumeButton.addEventListener('click', (event) => {
    event.preventDefault();
    triggerResume();
  });

  overlay.addEventListener('click', () => {
    triggerResume();
  });

  panel.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  let visible = false;

  function show(): void {
    if (visible) return;
    visible = true;
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function hide(): void {
    if (!visible) return;
    visible = false;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function toggle(force?: boolean): void {
    const shouldShow = force ?? !visible;
    if (shouldShow) {
      show();
    } else {
      hide();
    }
  }

  return {
    element: overlay,
    show,
    hide,
    toggle,
    isVisible: () => visible,
    onResume(handler) {
      resumeHandlers.push(handler);
    },
  };
}

function addControl(list: HTMLDListElement, label: string, description: string): void {
  const term = document.createElement('dt');
  term.textContent = label;
  const detail = document.createElement('dd');
  detail.textContent = description;
  list.append(term, detail);
}
