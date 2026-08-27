import type { OperationTrackerStore, TrackedOperation } from './operation-tracker';

const storageKey = 'trackedCaptureOperations';

export class ChromeOperationTrackerStore implements OperationTrackerStore {
  async load(): Promise<unknown> {
    const stored = await chrome.storage.local.get(storageKey);
    return stored[storageKey];
  }

  async save(items: readonly TrackedOperation[]): Promise<void> {
    await chrome.storage.local.set({ [storageKey]: items });
  }
}
