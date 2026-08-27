export interface PopupElements {
  readonly form: HTMLFormElement;
  readonly modes: readonly HTMLInputElement[];
  readonly openReader: HTMLAnchorElement;
  readonly operationPanel: HTMLElement;
  readonly operationProgress: HTMLOutputElement;
  readonly retry: HTMLButtonElement;
  readonly root: HTMLElement;
  readonly save: HTMLButtonElement;
  readonly selection: HTMLOutputElement;
  readonly stage: HTMLButtonElement;
  readonly status: HTMLElement;
  readonly title: HTMLOutputElement;
  readonly url: HTMLOutputElement;
}

export function popupElements(): PopupElements | undefined {
  const elements = {
    form: query<HTMLFormElement>('[data-role="capture-form"]'),
    modes: [...document.querySelectorAll<HTMLInputElement>('[name="capture-mode"]')],
    openReader: query<HTMLAnchorElement>('[data-action="open-reader"]'),
    operationPanel: query<HTMLElement>('[data-role="operation-panel"]'),
    operationProgress: query<HTMLOutputElement>('[data-role="operation-progress"]'),
    retry: query<HTMLButtonElement>('[data-action="retry"]'),
    root: document.querySelector('main'),
    save: query<HTMLButtonElement>('[data-action="save"]'),
    selection: query<HTMLOutputElement>('[data-role="draft-selection"]'),
    stage: query<HTMLButtonElement>('[data-action="stage"]'),
    status: query<HTMLElement>('[data-role="status"]'),
    title: query<HTMLOutputElement>('[data-role="draft-title"]'),
    url: query<HTMLOutputElement>('[data-role="draft-url"]'),
  };
  return Object.values(elements).some((value) => value === null) || elements.modes.length !== 2
    ? undefined : elements as PopupElements;
}

export function selectMode(elements: PopupElements, mode: 'quick' | 'tracked'): void {
  const input = elements.modes.find((candidate) => candidate.value === mode);
  if (input !== undefined) input.checked = true;
}

export function selectedMode(elements: PopupElements): 'quick' | 'tracked' {
  return elements.modes.find((candidate) => candidate.checked)?.value === 'tracked' ? 'tracked' : 'quick';
}

function query<T extends Element>(selector: string): T | null {
  return document.querySelector<T>(selector);
}
