import type { QueueSnapshot, QueueStore } from './types';

const storageKey = 'durableCaptureQueue';

export class ChromeStorageQueueStore implements QueueStore {
  async load(): Promise<unknown> {
    const stored = await chrome.storage.local.get(storageKey);
    return stored[storageKey];
  }

  async save(snapshot: QueueSnapshot): Promise<void> {
    await chrome.storage.local.set({ [storageKey]: snapshot });
  }
}
