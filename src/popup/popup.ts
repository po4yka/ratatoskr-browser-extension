import {
  createDraft,
  createReadyState,
  markDraftError,
  stageDraft,
  type CaptureDraft,
  type DraftState,
  type TabContext,
} from '../capture/draft';

interface PopupElements {
  readonly form: HTMLFormElement;
  readonly root: HTMLElement;
  readonly selection: HTMLOutputElement;
  readonly stage: HTMLButtonElement;
  readonly status: HTMLElement;
  readonly title: HTMLOutputElement;
  readonly url: HTMLOutputElement;
}

let state: DraftState | undefined;
const elements = popupElements();

if (elements !== undefined) {
  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state !== undefined) {
      render(stageDraft(state));
    }
  });
  void loadActiveTab();
}

async function loadActiveTab(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    render(createReadyState(createDraft({ entryPoint: 'popup', tab: tabContext(tab) })));
  } catch (error) {
    render(markDraftError(errorMessage(error)));
  }
}

function popupElements(): PopupElements | undefined {
  const root = document.querySelector('main');
  const form = document.querySelector<HTMLFormElement>('[data-role="capture-form"]');
  const title = document.querySelector<HTMLOutputElement>('[data-role="draft-title"]');
  const url = document.querySelector<HTMLOutputElement>('[data-role="draft-url"]');
  const selection = document.querySelector<HTMLOutputElement>('[data-role="draft-selection"]');
  const stage = document.querySelector<HTMLButtonElement>('[data-action="stage"]');
  const status = document.querySelector<HTMLElement>('[data-role="status"]');
  return root === null || form === null || title === null || url === null || selection === null || stage === null || status === null
    ? undefined
    : { form, root, selection, stage, status, title, url };
}

function render(nextState: DraftState): void {
  if (elements === undefined) {
    return;
  }
  state = nextState;
  elements.root.dataset.state = nextState.status;
  elements.stage.disabled = nextState.status !== 'ready';
  renderDraft(presentDraft(nextState));
  elements.status.textContent = stateMessage(nextState);
}

function renderDraft(draft: CaptureDraft | undefined): void {
  if (elements === undefined) {
    return;
  }
  if (draft === undefined) {
    elements.title.value = 'Unavailable';
    elements.url.value = 'Unavailable';
    elements.selection.value = 'No selected text is available in the popup.';
    return;
  }
  elements.title.value = draft.title;
  elements.url.value = draft.url;
  elements.selection.value = draft.selectionText ?? 'No selected text is available in the popup.';
}

function presentDraft(nextState: DraftState): CaptureDraft | undefined {
  return nextState.status === 'error' ? undefined : nextState.draft;
}

function stateMessage(nextState: DraftState): string {
  switch (nextState.status) {
    case 'ready':
      return 'Review the draft, then stage it locally.';
    case 'staged':
      return 'Draft staged locally. It has not been submitted to Ratatoskr.';
    case 'submitted':
      return 'Capture submitted to Ratatoskr.';
    case 'error':
      return nextState.message;
  }
}

function tabContext(tab: chrome.tabs.Tab | undefined): TabContext {
  return {
    ...(tab?.title === undefined ? {} : { title: tab.title }),
    ...(tab?.url === undefined ? {} : { url: tab.url }),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The active page cannot be captured.';
}
