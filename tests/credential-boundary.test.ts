import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface CredentialStoreApi {
  createCredentialStore(storage: {
    clear(): Promise<void>;
    get(): Promise<unknown>;
    restrictToTrustedContexts(): Promise<void>;
    set(value: unknown): Promise<void>;
  }): {
    initialize(): Promise<void>;
    load(): Promise<unknown>;
    save(value: unknown): Promise<void>;
  };
}

async function loadCredentialStoreApi(): Promise<CredentialStoreApi> {
  return (await import(new URL('../src/auth/credential-store.ts', import.meta.url).href)) as CredentialStoreApi;
}

describe('device credential boundary', () => {
  it('uses trusted non-sync extension storage and keeps credential storage out of content scripts', async () => {
    const { createCredentialStore } = await loadCredentialStoreApi();
    const calls: string[] = [];
    let stored: unknown;
    const store = createCredentialStore({
      clear: async () => { stored = undefined; },
      get: async () => stored,
      restrictToTrustedContexts: async () => { calls.push('trusted-contexts'); },
      set: async (value) => { stored = value; },
    });

    await store.initialize();
    await store.save({ accessToken: 'access-secret', refreshToken: 'refresh-secret' });

    expect(calls).toEqual(['trusted-contexts']);
    await expect(store.load()).resolves.toEqual({ accessToken: 'access-secret', refreshToken: 'refresh-secret' });
    const contentSource = readFileSync(new URL('../src/content/message-handler.ts', import.meta.url), 'utf8');
    const workerSource = readFileSync(new URL('../src/background/service-worker.ts', import.meta.url), 'utf8');
    expect(contentSource).not.toMatch(/auth\/|credential|chrome\.storage/);
    expect(workerSource).toContain("createChromeCredentialStore");
    expect(workerSource).toContain('credentialStore.initialize()');
  });

  it('rejects a content-script credential request without a credential read', async () => {
    const { handleWorkerMessage } = await import(new URL('../src/protocol/messages.ts', import.meta.url).href);

    expect(
      handleWorkerMessage(
        { protocolVersion: 1, type: 'device.credentials.read' },
        { extensionId: 'extension-id', sender: { id: 'extension-id', tab: { id: 7 } } },
      ),
    ).toEqual({ code: 'credential-access-denied', protocolVersion: 1, type: 'protocol.error' });
  });
});
