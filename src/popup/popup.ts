import {
  createDraft,
  createReadyState,
  markDraftError,
  markDraftQueued,
  stageDraft,
  type CaptureDraft,
  type DraftState,
  type TabContext,
} from '../capture/draft';
import { assertNever, createPopupStageMessage, decodePopupReply } from '../protocol/messages';
import { createPopupSubmitMessage, decodeCaptureQueuedReply } from '../protocol/article-submission';
import { createCaptureStatusMessage, decodeCaptureStatusReply, type CaptureStatusReply } from '../protocol/capture-status';
import { operationIsTerminal, operationMessage, retryableOperation } from './operation-panel';
import { saveableDraft } from './submission-controls';

interface PopupElements {
  readonly form: HTMLFormElement;
  readonly root: HTMLElement;
  readonly quickSave: HTMLButtonElement;
  readonly retry: HTMLButtonElement;
  readonly selection: HTMLOutputElement;
  readonly stage: HTMLButtonElement;
  readonly status: HTMLElement;
  readonly trackedSave: HTMLButtonElement;
  readonly title: HTMLOutputElement;
  readonly url: HTMLOutputElement;
  readonly operationPanel: HTMLElement;
  readonly operationProgress: HTMLOutputElement;
  readonly openReader: HTMLAnchorElement;
}

let state: DraftState | undefined;
let delivery: { readonly captureId: string; readonly mode: 'quick' | 'tracked' } | undefined;
const elements = popupElements();

if (elements !== undefined) {
  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    void stageCurrentDraft();
  });
  elements.quickSave.addEventListener('click', () => void saveCurrentDraft('quick'));
  elements.trackedSave.addEventListener('click', () => void saveCurrentDraft('tracked'));
  elements.retry.addEventListener('click', () => delivery === undefined ? undefined : void saveCurrentDraft(delivery.mode));
  void loadActiveTab();
}

async function saveCurrentDraft(mode: 'quick' | 'tracked'): Promise<void> {
  const draft = saveableDraft(state);
  if (draft === undefined) {
    return;
  }
  try {
    const reply = decodeCaptureQueuedReply(await chrome.runtime.sendMessage(createPopupSubmitMessage(draft, mode)));
    if (reply.type === 'capture.queued') {
      delivery = { captureId: reply.captureId, mode: reply.mode };
      render(markDraftQueued({ draft, status: 'staged' }));
      startTracking(reply);
    } else {
      render(markDraftError('Capture delivery is unavailable.'));
    }
  } catch {
    render(markDraftError('Capture delivery is unavailable.'));
  }
}

async function stageCurrentDraft(): Promise<void> {
  if (state === undefined || state.status !== 'ready') {
    return;
  }

  const readyState = state;
  try {
    const reply = decodePopupReply(await chrome.runtime.sendMessage(createPopupStageMessage(readyState.draft)));
    switch (reply.type) {
      case 'capture-draft.staged':
        render(stageDraft(readyState));
        return;
      case 'protocol.error':
        render(markDraftError('Capture staging is unavailable.'));
        return;
      default:
        return assertNever(reply);
    }
  } catch {
    render(markDraftError('Capture staging is unavailable.'));
  }
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
  const quickSave = document.querySelector<HTMLButtonElement>('[data-action="quick-save"]');
  const trackedSave = document.querySelector<HTMLButtonElement>('[data-action="tracked-save"]');
  const retry = document.querySelector<HTMLButtonElement>('[data-action="retry"]');
  const operationPanel = document.querySelector<HTMLElement>('[data-role="operation-panel"]');
  const operationProgress = document.querySelector<HTMLOutputElement>('[data-role="operation-progress"]');
  const openReader = document.querySelector<HTMLAnchorElement>('[data-action="open-reader"]');
  const status = document.querySelector<HTMLElement>('[data-role="status"]');
  const candidate = { form, openReader, operationPanel, operationProgress, quickSave, retry, root, selection, stage, status, trackedSave, title, url };
  return Object.values(candidate).some((value) => value === null) ? undefined : candidate as unknown as PopupElements;
}

function render(nextState: DraftState): void {
  if (elements === undefined) {
    return;
  }
  state = nextState;
  elements.root.dataset.state = nextState.status;
  elements.stage.disabled = nextState.status !== 'ready';
  elements.quickSave.disabled = nextState.status !== 'staged';
  elements.trackedSave.disabled = nextState.status !== 'staged';
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
      return 'Draft staged locally. Choose quick save or tracked save.';
    case 'queued':
      return 'Capture is queued for delivery.';
    case 'submitted':
      return 'Capture submitted to Ratatoskr.';
    case 'error':
      return nextState.message;
  }
}

async function refreshTrackedStatus(): Promise<void> {
  if (delivery?.mode !== 'tracked') {
    return;
  }
  try {
    const reply = decodeCaptureStatusReply(await chrome.runtime.sendMessage(createCaptureStatusMessage(delivery.captureId)));
    if (reply.type === 'capture.status') {
      renderOperation(reply);
      if (!operationIsTerminal(reply.operation?.status)) {
        window.setTimeout(() => void refreshTrackedStatus(), 2_000);
      }
    }
  } catch {
    window.setTimeout(() => void refreshTrackedStatus(), 2_000);
  }
}

function renderOperation(reply: CaptureStatusReply): void {
  if (elements === undefined || reply.mode !== 'tracked') {
    return;
  }
  const operation = reply.operation;
  elements.operationPanel.hidden = false;
  elements.operationProgress.value = operationMessage(operation);
  renderReaderLink(operation?.readerLink);
  elements.retry.hidden = !retryableOperation(operation);
}

function startTracking(reply: { readonly captureId: string; readonly mode: 'quick' | 'tracked' }): void {
  if (reply.mode === 'tracked') {
    renderOperation({ captureId: reply.captureId, mode: reply.mode, protocolVersion: 1, queueStatus: 'queued', type: 'capture.status' });
    void refreshTrackedStatus();
  }
}

function renderReaderLink(link: string | undefined): void {
  if (elements === undefined) {
    return;
  }
  elements.openReader.hidden = link === undefined;
  if (link !== undefined) {
    elements.openReader.href = link;
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
