import { describe, expect, it } from 'vitest';

interface OptionsStateApi {
  createPreferenceStore(storage: MemoryStorage): {
    load(): Promise<{ readonly defaultCaptureMode: 'quick' | 'tracked' }>;
    save(value: { readonly defaultCaptureMode: 'quick' | 'tracked' }): Promise<void>;
  };
  initialCaptureMode(preference: { readonly defaultCaptureMode: 'quick' | 'tracked' }): {
    readonly mode: 'quick' | 'tracked';
    readonly submitted: false;
  };
  projectOptionsState(input: unknown): unknown;
}

interface OptionsProtocolApi {
  handleOptionsControlMessage(message: unknown, handler: unknown): Promise<unknown>;
}

interface MemoryStorage {
  get(): Promise<unknown>;
  set(value: unknown): Promise<void>;
}

async function loadApi(): Promise<OptionsStateApi> {
  return (await import(new URL('../src/options/state.ts', import.meta.url).href)) as OptionsStateApi;
}

async function loadProtocol(): Promise<OptionsProtocolApi> {
  return (await import(new URL('../src/protocol/options-control.ts', import.meta.url).href)) as OptionsProtocolApi;
}

describe('options state', () => {
  it('uses the saved default mode without automatic submission', async () => {
    const { createPreferenceStore, initialCaptureMode } = await loadApi();
    let stored: unknown = { defaultCaptureMode: 'tracked' };
    const preferences = createPreferenceStore({
      get: async () => stored,
      set: async (value) => { stored = value; },
    });

    const loaded = await preferences.load();
    expect(initialCaptureMode(loaded)).toEqual({ mode: 'tracked', submitted: false });
    await preferences.save({ defaultCaptureMode: 'quick' });
    expect(stored).toEqual({ defaultCaptureMode: 'quick' });
  });

  it('projects only safe queue and paired-device fields', async () => {
    const { projectOptionsState } = await loadApi();
    const projected = projectOptionsState({
      credential: {
        accessToken: 'access-secret', deviceId: 'device-public', deviceSecret: 'root-secret',
        endpoint: 'https://ratatoskr.example', expiresAt: 1, refreshToken: 'refresh-secret',
      },
      preference: { defaultCaptureMode: 'quick' },
      queue: [{
        attemptCount: 2,
        draft: { note: 'private note', selectionText: 'private selection', title: 'private title', url: 'https://private.example/path?token=x' },
        id: 'capture-1', idempotencyKey: 'idempotency-secret', mode: 'tracked', status: 'retry-wait', terminalReason: 'validation',
      }],
    });

    expect(projected).toEqual({
      defaultCaptureMode: 'quick',
      device: { deviceId: 'device-public', endpoint: 'https://ratatoskr.example', status: 'paired' },
      queue: [{ attemptCount: 2, id: 'capture-1', mode: 'tracked', status: 'retry-wait', terminalReason: 'validation' }],
    });
    expect(JSON.stringify(projected)).not.toMatch(/secret|private|token=x/);
  });

  it('rejects destructive messages outside the exact options page', async () => {
    const { handleOptionsControlMessage } = await loadProtocol();
    const revoke = async () => ({ status: 'revoked' as const });
    const base = {
      clearAll: async () => ({ status: 'cleared' as const }), diagnostics: async () => ({}),
      optionsPageUrl: 'chrome-extension://extension-id/options/index.html', popupPageUrl: 'chrome-extension://extension-id/popup/index.html',
      readPreference: async () => ({ defaultCaptureMode: 'quick' as const }), readState: async () => ({}), revoke, savePreference: async () => undefined,
    };
    const reply = await handleOptionsControlMessage(
      { protocolVersion: 1, type: 'options.device.revoke' },
      { ...base, context: { extensionId: 'extension-id', sender: { id: 'extension-id', url: base.popupPageUrl } } },
    );
    expect(reply).toEqual({ code: 'unexpected-sender', protocolVersion: 1, type: 'protocol.error' });
  });
});
