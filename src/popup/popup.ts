import { createDraft, createReadyState, markDraftError, markDraftQueued, stageDraft, type CaptureDraft, type DraftState } from '../capture/draft';
import { localizeDocument, message } from '../i18n/messages';
import { createPopupSubmitMessage, decodeCaptureQueuedReply } from '../protocol/article-submission';
import { createCaptureStatusMessage, decodeCaptureStatusReply, type CaptureStatusReply } from '../protocol/capture-status';
import { assertNever, createPopupStageMessage, decodePopupReply } from '../protocol/messages';
import { decodeOptionsReply, optionsMessages } from '../protocol/options-control';
import { popupElements, selectMode, selectedMode } from './elements';
import { connectGithubPanel } from './github-panel';
import { localizedOperationMessage, operationIsTerminal, retryableOperation } from './operation-panel';
import { saveableDraft } from './submission-controls';
import { tabContext } from './tab-context';

localizeDocument();
const elements = popupElements();
const githubPanel = connectGithubPanel();
let state: DraftState | undefined;
let delivery: { readonly captureId: string; readonly mode: 'quick' | 'tracked' } | undefined;

if (elements !== undefined) {
  elements.form.addEventListener('submit', (event) => { event.preventDefault(); void stageCurrentDraft(); });
  elements.save.addEventListener('click', () => void saveCurrentDraft(selectedMode(elements)));
  elements.retry.addEventListener('click', () => delivery === undefined ? undefined : void saveCurrentDraft(delivery.mode));
  void initialize();
}

async function initialize(): Promise<void> {
  await loadPreference();
  await loadActiveTab();
}

async function loadPreference(): Promise<void> {
  if (elements === undefined) return;
  try {
    const reply = decodeOptionsReply(await chrome.runtime.sendMessage(optionsMessages.readPreference()));
    selectMode(elements, reply.type === 'capture.preference' ? reply.preference.defaultCaptureMode : 'quick');
  } catch {
    selectMode(elements, 'quick');
  }
}

async function saveCurrentDraft(mode: 'quick' | 'tracked'): Promise<void> {
  const draft = saveableDraft(state);
  if (draft === undefined || draft.github !== undefined) return;
  try {
    const reply = decodeCaptureQueuedReply(await chrome.runtime.sendMessage(createPopupSubmitMessage(draft, mode)));
    if (reply.type !== 'capture.queued') throw new Error('queue-unavailable');
    delivery = { captureId: reply.captureId, mode: reply.mode };
    render(markDraftQueued({ draft, status: 'staged' }));
    startTracking(reply);
  } catch {
    render(markDraftError(message('popupErrorDelivery')));
  }
}

async function stageCurrentDraft(): Promise<void> {
  if (state === undefined || state.status !== 'ready') return;
  const readyState = state;
  try {
    const reply = decodePopupReply(await chrome.runtime.sendMessage(createPopupStageMessage(readyState.draft)));
    switch (reply.type) {
      case 'capture-draft.staged': render(stageDraft(readyState)); return;
      case 'protocol.error': render(markDraftError(message('popupErrorStaging'))); return;
      default: return assertNever(reply);
    }
  } catch {
    render(markDraftError(message('popupErrorStaging')));
  }
}

async function loadActiveTab(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    render(createReadyState(createDraft({ entryPoint: 'popup', tab: tabContext(tab) })));
  } catch {
    render(markDraftError(message('popupErrorActiveTab')));
  }
}

function render(nextState: DraftState): void {
  if (elements === undefined) return;
  state = nextState;
  const draft = nextState.status === 'error' ? undefined : nextState.draft;
  elements.root.dataset.state = nextState.status;
  elements.stage.disabled = nextState.status !== 'ready';
  elements.save.disabled = nextState.status !== 'staged' || draft?.github !== undefined;
  renderDraft(draft);
  githubPanel?.present(draft, nextState.status === 'staged');
  elements.status.textContent = stateMessage(nextState);
}

function renderDraft(draft: CaptureDraft | undefined): void {
  if (elements === undefined) return;
  elements.title.value = draft?.title ?? message('commonUnavailable');
  elements.url.value = draft?.url ?? message('commonUnavailable');
  elements.selection.value = draft?.selectionText ?? chrome.i18n.getMessage('popupNoSelection');
}

function stateMessage(nextState: DraftState): string {
  switch (nextState.status) {
    case 'ready': return message('popupStateReady');
    case 'staged': return message(nextState.draft.github === undefined ? 'popupStateStaged' : 'popupStateRepositoryStaged');
    case 'queued': return message('popupStateQueued');
    case 'submitted': return message('popupStateSubmitted');
    case 'error': return nextState.message;
  }
}

async function refreshTrackedStatus(): Promise<void> {
  if (delivery?.mode !== 'tracked') return;
  try {
    const reply = decodeCaptureStatusReply(await chrome.runtime.sendMessage(createCaptureStatusMessage(delivery.captureId)));
    if (reply.type === 'capture.status') {
      renderOperation(reply);
      if (!operationIsTerminal(reply.operation?.status)) window.setTimeout(() => void refreshTrackedStatus(), 2_000);
    }
  } catch {
    window.setTimeout(() => void refreshTrackedStatus(), 2_000);
  }
}

function renderOperation(reply: CaptureStatusReply): void {
  if (elements === undefined || reply.mode !== 'tracked') return;
  const operation = reply.operation;
  elements.operationPanel.hidden = false;
  elements.operationProgress.value = localizedOperationMessage(operation);
  elements.retry.hidden = !retryableOperation(operation);
  elements.openReader.hidden = operation?.readerLink === undefined;
  if (operation?.readerLink !== undefined) elements.openReader.href = operation.readerLink;
}

function startTracking(reply: { readonly captureId: string; readonly mode: 'quick' | 'tracked' }): void {
  if (reply.mode !== 'tracked') return;
  renderOperation({ captureId: reply.captureId, mode: reply.mode, protocolVersion: 1, queueStatus: 'queued', type: 'capture.status' });
  void refreshTrackedStatus();
}
