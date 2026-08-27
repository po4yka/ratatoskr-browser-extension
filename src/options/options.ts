import { createQueueInspectionMessage, decodeQueueInspectionReply } from '../protocol/queue-inspection';
import { queueItemText } from './queue-view';

const queueList = document.querySelector<HTMLUListElement>('[data-role="queue-list"]');
const status = document.querySelector<HTMLElement>('[data-role="status"]');

void loadQueue();
const pairingForm = document.querySelector<HTMLFormElement>('[data-role="pairing-form"]');
pairingForm?.addEventListener('submit', (event) => { event.preventDefault(); void pair(); });

async function pair(): Promise<void> {
  const endpoint = document.querySelector<HTMLInputElement>('[data-role="pairing-endpoint"]')?.value ?? '';
  const code = document.querySelector<HTMLInputElement>('[data-role="pairing-code"]')?.value ?? '';
  try {
    const origin = new URL(endpoint).origin;
    if (new URL(endpoint).protocol !== 'https:' || !await chrome.permissions.request({ origins: [`${origin}/*`] })) throw new Error();
    await chrome.runtime.sendMessage({ code, endpoint, protocolVersion: 1, type: 'pairing.submit' });
    showStatus('Pairing request sent.');
  } catch { showStatus('Pairing requires an approved HTTPS endpoint and code.'); }
}

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
