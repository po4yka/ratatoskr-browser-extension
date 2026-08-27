import { registerCaptureContextMenus } from './context-menu';
import { createChromeCredentialStore } from '../auth/credential-store';
import { createAuthorizedQueueSubmitter, createCredentialBoundary } from '../auth/authorization';
import { createPlatformIdentityClient } from '../auth/platform-identity';
import { createOperationTracker, readerDeepLink } from '../capture/operation-tracker';
import { ChromeOperationTrackerStore } from '../capture/operation-storage';
import { createPlatformCaptureClient, PlatformCaptureError } from '../capture/platform-client';
import { ChromeQueueAlarm, registerQueueAlarm } from '../queue/alarm';
import { createQueue } from '../queue/queue';
import { ChromeStorageQueueStore } from '../queue/storage';
import type { SubmitOutcome, SubmitRequest } from '../queue/types';
import { isArticleSubmissionCandidate, handleArticleSubmissionMessage } from '../protocol/article-submission';
import { isCaptureStatusCandidate, handleCaptureStatusMessage, type CaptureOperationStatus, type CaptureStatusReply } from '../protocol/capture-status';
import { isQueueInspectionCandidate, handleQueueInspectionMessage } from '../protocol/queue-inspection';
import { handleWorkerMessage } from '../protocol/messages';
import { isPopupStageDraftMessage } from '../protocol/validation';
import { createGithubRuntime } from './github-runtime';
import { browserContextMenus } from './browser-context-menus';

const credentialStore = createChromeCredentialStore();
void credentialStore.initialize();
const authorization = createCredentialBoundary({ now: () => Date.now(), refresh: (token, endpoint) => createPlatformIdentityClient({ endpoint, fetch }).refresh(token), store: credentialStore });
const tracker = createOperationTracker({
  client: { readOperation: async ({ operationId }) => (await captureClient()).readOperation({ accessToken: await authorization.accessToken(), operationId }) },
  store: new ChromeOperationTrackerStore(),
});
const githubRuntime = createGithubRuntime({
  accessToken: () => authorization.accessToken(),
  endpoint: () => authorization.endpoint(),
  fetcher: fetch,
});

const queue = createQueue({
  alarm: new ChromeQueueAlarm(),
  createAttemptId: () => crypto.randomUUID(),
  createCaptureId: () => crypto.randomUUID(),
  createIdempotencyKey: () => crypto.randomUUID(),
  now: () => Date.now(),
  random: () => Math.random(),
  store: new ChromeStorageQueueStore(),
  submit: createAuthorizedQueueSubmitter({ authorization, submit: submitCapture }),
});

registerQueueAlarm(() => queue.processDue());
void queue.processDue();
void recoverTrackedOperations();

chrome.runtime.onMessage.addListener((...args: RuntimeMessageArgs) => handleRuntimeMessage(args));

function handleRuntimeMessage(args: RuntimeMessageArgs): boolean {
  const [message, sender, sendResponse] = args;
  const context = { extensionId: chrome.runtime.id, sender };
  if (isPairingRequest(message, context)) {
    void pair(message).then(sendResponse).catch(() => sendResponse({ protocolVersion: 1, status: 'pairing-failed', type: 'pairing.status' }));
    return true;
  }
  if (isQueueInspectionCandidate(message)) {
    void handleQueueInspectionMessage(message, { context, queue }).then(sendResponse);
    return true;
  }
  if (isArticleSubmissionCandidate(message)) {
    void handleArticleSubmissionMessage(message, { context, queue }).then((reply) => {
      sendResponse(reply);
      void processQueueAndRecover();
    }).catch(() => sendResponse(queueUnavailable()));
    return true;
  }
  if (isCaptureStatusCandidate(message)) {
    void handleCaptureStatusMessage(message, { context, readStatus: readCaptureStatus }).then(sendResponse).catch(() => sendResponse(queueUnavailable()));
    return true;
  }
  if (githubRuntime.handles(message)) {
    void githubRuntime.handle(message, context).then(sendResponse).catch(() => sendResponse(githubUnavailable()));
    return true;
  }
  return respondToWorkerMessage({ context, message, sendResponse });
}

function respondToWorkerMessage(options: { readonly context: { readonly extensionId: string; readonly sender: chrome.runtime.MessageSender }; readonly message: unknown; readonly sendResponse: (response?: unknown) => void }): boolean {
  const { context, message, sendResponse } = options;
  const reply = handleWorkerMessage(message, context);
  if (reply.type === 'capture-draft.staged' && isPopupStageDraftMessage(message)) {
    if (message.draft.github !== undefined) {
      sendResponse(reply);
      return false;
    }
    void queue.enqueue(message.draft).then(() => {
      sendResponse(reply);
      void processQueueAndRecover();
    }).catch(() => sendResponse(queueUnavailable()));
    return true;
  }
  sendResponse(reply);
  return false;
}

function githubUnavailable(): { readonly code: 'github-unavailable'; readonly protocolVersion: 1; readonly type: 'protocol.error' } {
  return { code: 'github-unavailable', protocolVersion: 1, type: 'protocol.error' };
}

async function pair(message: { readonly code: string; readonly endpoint: string }): Promise<{ readonly deviceId: string; readonly protocolVersion: 1; readonly status: 'paired'; readonly type: 'pairing.status' }> {
  const paired = await createPlatformIdentityClient({ endpoint: message.endpoint, fetch }).pair(message.code);
  await credentialStore.save({ ...paired, endpoint: message.endpoint });
  void processQueueAndRecover();
  return { deviceId: paired.deviceId, protocolVersion: 1, status: 'paired', type: 'pairing.status' };
}

function isPairingRequest(message: unknown, context: { readonly extensionId: string; readonly sender: chrome.runtime.MessageSender }): message is { readonly code: string; readonly endpoint: string } {
  return typeof message === 'object' && message !== null
    && (message as Record<string, unknown>).type === 'pairing.submit'
    && (message as Record<string, unknown>).protocolVersion === 1
    && typeof (message as Record<string, unknown>).code === 'string'
    && typeof (message as Record<string, unknown>).endpoint === 'string'
    && context.sender.id === context.extensionId && context.sender.tab === undefined;
}

type RuntimeMessageArgs = [unknown, chrome.runtime.MessageSender, (response?: unknown) => void];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    registerCaptureContextMenus(browserContextMenus(), (state) => {
      if (state.status === 'staged' && state.draft.github === undefined) {
        void queue.enqueue(state.draft).then(() => processQueueAndRecover());
      }
    });
  });
});

function queueUnavailable(): { readonly code: 'queue-unavailable'; readonly protocolVersion: 1; readonly type: 'protocol.error' } {
  return { code: 'queue-unavailable', protocolVersion: 1, type: 'protocol.error' };
}

async function submitCapture(request: SubmitRequest & { readonly accessToken: string }): Promise<SubmitOutcome> {
  try {
    const accepted = await (await captureClient()).submit({
      ...request,
      ...(request.draft.social === undefined ? {} : { social: request.draft.social }),
      url: request.draft.url,
    });
    return { operationId: accepted.operationId, type: 'accepted' };
  } catch (error) {
    if (error instanceof PlatformCaptureError) {
      return error.kind === 'retryable' ? { type: 'retryable' } : { reason: error.kind === 'authentication-required' ? 'authentication-required' : 'validation', type: 'terminal' };
    }
    return { type: 'retryable' };
  }
}

async function captureClient() {
  return createPlatformCaptureClient({ endpoint: await authorization.endpoint(), fetch });
}

async function processQueueAndRecover(): Promise<void> {
  await queue.processDue();
  await recoverTrackedOperations();
}

async function recoverTrackedOperations(): Promise<void> {
  const items = await queue.items();
  await tracker.recover(items.filter((item): item is typeof item & { readonly status: 'accepted' } => item.status === 'accepted'));
  try {
    await tracker.poll();
  } catch {
    // A later popup status request or worker wake-up retries polling with the persisted operation ID.
  }
}

async function readCaptureStatus(captureId: string): Promise<CaptureStatusReply | undefined> {
  await processQueueAndRecover();
  const item = (await queue.items()).find((candidate) => candidate.id === captureId);
  if (item === undefined) {
    return undefined;
  }
  const tracked = (await tracker.items()).find((candidate) => candidate.captureId === captureId);
  const operation = tracked === undefined ? undefined : await operationStatus(tracked.snapshot);
  return {
    captureId,
    mode: item.mode ?? 'quick',
    ...(operation === undefined ? {} : { operation }),
    protocolVersion: 1,
    queueStatus: item.status,
    type: 'capture.status',
  };
}

async function operationStatus(snapshot: Awaited<ReturnType<typeof tracker.items>>[number]['snapshot']): Promise<CaptureOperationStatus> {
  const readerLink = readerDeepLink(await authorization.endpoint(), snapshot);
  return {
    ...(snapshot.progressPercent === undefined ? {} : { progressPercent: snapshot.progressPercent }),
    ...(readerLink === undefined ? {} : { readerLink }),
    retryable: snapshot.retryable,
    ...(snapshot.socialOutcome === undefined ? {} : { socialOutcome: snapshot.socialOutcome }),
    ...(snapshot.stage === undefined ? {} : { stage: snapshot.stage }),
    status: snapshot.status,
    ...(snapshot.warnings.length === 0 ? {} : { warningCount: snapshot.warnings.length }),
  };
}
