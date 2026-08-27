import { registerCaptureContextMenus, type ContextMenusApi, type MenuClickInfo } from './context-menu';
import { ChromeQueueAlarm, registerQueueAlarm } from '../queue/alarm';
import { createQueue } from '../queue/queue';
import { ChromeStorageQueueStore } from '../queue/storage';
import { isQueueInspectionCandidate, handleQueueInspectionMessage } from '../protocol/queue-inspection';
import { handleWorkerMessage } from '../protocol/messages';
import { isPopupStageDraftMessage } from '../protocol/validation';

const queue = createQueue({
  alarm: new ChromeQueueAlarm(),
  createAttemptId: () => crypto.randomUUID(),
  createCaptureId: () => crypto.randomUUID(),
  createIdempotencyKey: () => crypto.randomUUID(),
  now: () => Date.now(),
  random: () => Math.random(),
  store: new ChromeStorageQueueStore(),
  submit: async () => ({ retryAfterMs: 300_000, type: 'retryable' }),
});

registerQueueAlarm(() => queue.processDue());
void queue.processDue();

chrome.runtime.onMessage.addListener((...args: RuntimeMessageArgs) => handleRuntimeMessage(args));

function handleRuntimeMessage(args: RuntimeMessageArgs): boolean {
  const [message, sender, sendResponse] = args;
  const context = { extensionId: chrome.runtime.id, sender };
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
