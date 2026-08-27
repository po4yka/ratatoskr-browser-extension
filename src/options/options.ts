import { createQueueInspectionMessage, decodeQueueInspectionReply } from '../protocol/queue-inspection';
import { queueItemText } from './queue-view';

const queueList = document.querySelector<HTMLUListElement>('[data-role="queue-list"]');
const status = document.querySelector<HTMLElement>('[data-role="status"]');

void loadQueue();

async function loadQueue(): Promise<void> {
  try {
    const reply = decodeQueueInspectionReply(await chrome.runtime.sendMessage(createQueueInspectionMessage()));
    if (reply.type === 'protocol.error') {
      showStatus('Queue inspection is unavailable.');
      return;
    }
    renderQueue(reply.items);
    showStatus(reply.items.length === 0 ? 'No captures are queued.' : `${reply.items.length} capture(s) retained locally.`);
  } catch {
    showStatus('Queue inspection is unavailable.');
  }
}

function renderQueue(items: readonly Parameters<typeof queueItemText>[0][]): void {
  if (queueList === null) {
    return;
  }
  queueList.replaceChildren(...items.map(queueListItem));
}

function queueListItem(item: Parameters<typeof queueItemText>[0]): HTMLLIElement {
  const element = document.createElement('li');
  element.textContent = queueItemText(item);
  return element;
}

function showStatus(message: string): void {
  if (status !== null) {
    status.textContent = message;
  }
}
