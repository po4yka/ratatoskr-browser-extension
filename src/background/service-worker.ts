import { registerCaptureContextMenus, type ContextMenusApi, type MenuClickInfo } from './context-menu';
import { createChromeCredentialStore } from '../auth/credential-store';
import { createAuthorizedQueueSubmitter, createCredentialBoundary } from '../auth/authorization';
import { createPlatformIdentityClient } from '../auth/platform-identity';
import { ChromeQueueAlarm, registerQueueAlarm } from '../queue/alarm';
import { createQueue } from '../queue/queue';
import { ChromeStorageQueueStore } from '../queue/storage';
import { isQueueInspectionCandidate, handleQueueInspectionMessage } from '../protocol/queue-inspection';
import { handleWorkerMessage } from '../protocol/messages';
import { isPopupStageDraftMessage } from '../protocol/validation';

const credentialStore = createChromeCredentialStore();
void credentialStore.initialize();
const authorization = createCredentialBoundary({ now: () => Date.now(), refresh: (token, endpoint) => createPlatformIdentityClient({ endpoint, fetch }).refresh(token), store: credentialStore });

const queue = createQueue({
  alarm: new ChromeQueueAlarm(),
  createAttemptId: () => crypto.randomUUID(),
  createCaptureId: () => crypto.randomUUID(),
  createIdempotencyKey: () => crypto.randomUUID(),
  now: () => Date.now(),
  random: () => Math.random(),
  store: new ChromeStorageQueueStore(),
  submit: createAuthorizedQueueSubmitter({ authorization, submit: async () => ({ retryAfterMs: 300_000, type: 'retryable' }) }),
});

registerQueueAlarm(() => queue.processDue());
void queue.processDue();

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
  const reply = handleWorkerMessage(message, context);
  if (reply.type === 'capture-draft.staged' && isPopupStageDraftMessage(message)) {
    void queue.enqueue(message.draft).then(() => sendResponse(reply)).catch(() => sendResponse(queueUnavailable()));
    return true;
  }
  sendResponse(reply);
  return false;
}

async function pair(message: { readonly code: string; readonly endpoint: string }): Promise<{ readonly deviceId: string; readonly protocolVersion: 1; readonly status: 'paired'; readonly type: 'pairing.status' }> {
  const paired = await createPlatformIdentityClient({ endpoint: message.endpoint, fetch }).pair(message.code);
  await credentialStore.save({ ...paired, endpoint: message.endpoint });
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
      if (state.status === 'staged') {
        void queue.enqueue(state.draft);
      }
    });
  });
});

function queueUnavailable(): { readonly code: 'queue-unavailable'; readonly protocolVersion: 1; readonly type: 'protocol.error' } {
  return { code: 'queue-unavailable', protocolVersion: 1, type: 'protocol.error' };
}

function browserContextMenus(): ContextMenusApi {
  return {
    create: (definition) => {
      chrome.contextMenus.create({
        contexts: [...definition.contexts] as [chrome.contextMenus.ContextType, ...chrome.contextMenus.ContextType[]],
        id: definition.id,
        title: definition.title,
      });
    },
    onClicked: {
      addListener: (listener) => {
        chrome.contextMenus.onClicked.addListener((info, tab) => {
          listener(menuClickInfo(info), tabContext(tab));
        });
      },
    },
  };
}

function menuClickInfo(info: chrome.contextMenus.OnClickData): MenuClickInfo {
  return {
    menuItemId: String(info.menuItemId),
    ...(info.linkUrl === undefined ? {} : { linkUrl: info.linkUrl }),
    ...(info.selectionText === undefined ? {} : { selectionText: info.selectionText }),
  };
}

function tabContext(tab: chrome.tabs.Tab | undefined): { readonly title?: string; readonly url?: string } {
  return {
    ...(tab?.title === undefined ? {} : { title: tab.title }),
    ...(tab?.url === undefined ? {} : { url: tab.url }),
  };
}
