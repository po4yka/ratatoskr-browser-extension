import { describe, expect, it } from 'vitest';

interface Credential {
  readonly accessToken: string;
  readonly deviceId: string;
  readonly deviceSecret: string;
  readonly endpoint: string;
  readonly expiresAt: number;
  readonly refreshToken: string;
}

interface RevocationApi {
  createDeviceRevocationController(options: {
    readonly revoke: (credential: Credential) => Promise<'already-unauthorized' | 'revoked'>;
    readonly store: MemoryCredentialStore;
  }): { revoke(): Promise<{ readonly status: 'failed' | 'revoked' | 'unpaired' }> };
  createPlatformIdentityClient(options: { readonly endpoint: string; readonly fetch: typeof fetch }): {
    revoke(request: { readonly accessToken: string; readonly deviceId: string }): Promise<'already-unauthorized' | 'revoked'>;
  };
}

interface MemoryCredentialStore {
  clear(): Promise<void>;
  load(): Promise<unknown>;
  save(value: Credential): Promise<void>;
}

const credential: Credential = {
  accessToken: 'access-secret', deviceId: 'device-1', deviceSecret: 'root-secret', endpoint: 'https://ratatoskr.example',
  expiresAt: 99_999, refreshToken: 'refresh-secret',
};

async function loadApi(): Promise<RevocationApi> {
  const [identity, revocation] = await Promise.all([
    import(new URL('../src/auth/platform-identity.ts', import.meta.url).href),
    import(new URL('../src/auth/revocation.ts', import.meta.url).href),
  ]);
  return { ...identity, ...revocation } as RevocationApi;
}

function memoryStore(): MemoryCredentialStore & { current(): unknown } {
  let stored: unknown = credential;
  return {
    clear: async () => { stored = undefined; }, current: () => stored, load: async () => stored,
    save: async (value) => { stored = value; },
  };
}

describe('device revocation', () => {
  it('revokes only the stored device at the paired origin', async () => {
    const { createPlatformIdentityClient } = await loadApi();
    let request: Request | undefined;
    const client = createPlatformIdentityClient({ endpoint: credential.endpoint, fetch: async (input, init) => {
      request = new Request(input, init);
      return new Response(null, { status: 204 });
    } });

    await expect(client.revoke({ accessToken: credential.accessToken, deviceId: credential.deviceId })).resolves.toBe('revoked');
    expect(request?.url).toBe('https://ratatoskr.example/v1/devices/device-1');
    expect(request?.method).toBe('DELETE');
    expect(request?.redirect).toBe('error');
    expect(request?.headers.get('authorization')).toBe('Bearer access-secret');
  });

  it('clears credentials only after confirmed or already-unauthorized revoke', async () => {
    const { createDeviceRevocationController } = await loadApi();
    for (const outcome of ['revoked', 'already-unauthorized'] as const) {
      const store = memoryStore();
      const controller = createDeviceRevocationController({ revoke: async () => outcome, store });
      await expect(controller.revoke()).resolves.toEqual({ status: 'revoked' });
      expect(store.current()).toBeUndefined();
    }
  });

  it('retains credentials after an unconfirmed failure', async () => {
    const { createDeviceRevocationController } = await loadApi();
    const store = memoryStore();
    const controller = createDeviceRevocationController({ revoke: async () => { throw new Error('offline'); }, store });
    await expect(controller.revoke()).resolves.toEqual({ status: 'failed' });
    expect(store.current()).toEqual(credential);
  });
});
