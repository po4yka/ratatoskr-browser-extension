import type { DeviceCredentialRecord, DeviceCredentialStore } from './pairing';

const credentialKey = 'ratatoskrDeviceCredentials';

export interface CredentialStorage {
  clear(): Promise<void>;
  get(): Promise<unknown>;
  restrictToTrustedContexts(): Promise<void>;
  set(value: DeviceCredentialRecord): Promise<void>;
}

export interface CredentialStore extends DeviceCredentialStore {
  initialize(): Promise<void>;
}

export function createCredentialStore(storage: CredentialStorage): CredentialStore {
  return {
    clear: () => storage.clear(),
    initialize: () => storage.restrictToTrustedContexts(),
    load: () => storage.get(),
    save: (record) => storage.set(record),
  };
}

export function createChromeCredentialStore(): CredentialStore {
  return createCredentialStore({
    clear: async () => chrome.storage.local.remove(credentialKey),
    get: async () => (await chrome.storage.local.get(credentialKey))[credentialKey],
    restrictToTrustedContexts: async () => {
      if (typeof chrome.storage.local.setAccessLevel === 'function') {
        await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
      }
    },
    set: async (record) => chrome.storage.local.set({ [credentialKey]: record }),
  });
}
