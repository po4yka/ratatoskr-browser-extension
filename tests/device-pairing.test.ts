import { describe, expect, it } from 'vitest';

type PairingOutcome = 'approved' | 'expired' | 'origin-mismatch' | 'pending' | 'rejected';

interface CredentialStore {
  clear(): Promise<void>;
  load(): Promise<unknown>;
  save(record: unknown): Promise<void>;
}

interface PairingApi {
  createPairingController(options: { readonly identity: unknown; readonly now: () => number; readonly store: CredentialStore }): {
    begin(endpoint: string): Promise<{ readonly approvalUrl: string; readonly challengeId: string; readonly status: 'awaiting-approval' }>;
    complete(challengeId: string): Promise<unknown>;
  };
  createPlatformIdentityFixture(outcome: PairingOutcome): unknown;
}

interface AuthorizationApi {
  createAuthorizedSubmitter(options: {
    readonly authorization: { readonly accessToken: () => Promise<string> };
    readonly submit: (request: { readonly accessToken: string; readonly idempotencyKey: string }) => Promise<unknown>;
  }): (request: { readonly idempotencyKey: string }) => Promise<unknown>;
  createAuthorizedQueueSubmitter(options: {
    readonly authorization: { readonly accessToken: () => Promise<string> };
    readonly submit: (request: { readonly accessToken: string; readonly idempotencyKey: string }) => Promise<unknown>;
  }): (request: { readonly idempotencyKey: string }) => Promise<unknown>;
  createCredentialBoundary(options: {
    readonly now: () => number;
    readonly refresh: (refreshToken: string) => Promise<{ readonly accessToken: string; readonly expiresAt: number; readonly refreshToken: string }>;
    readonly store: CredentialStore;
  }): { readonly accessToken: () => Promise<string>; readonly connectionState: () => Promise<'logged-out' | 'paired'> };
  DeviceRevokedError: new () => Error;
}

class MemoryCredentialStore implements CredentialStore {
  value: unknown;

  async clear(): Promise<void> {
    this.value = undefined;
  }

  async load(): Promise<unknown> {
    return this.value;
  }

  async save(record: unknown): Promise<void> {
    this.value = record;
  }
}

async function loadPairingApi(): Promise<PairingApi> {
  return (await import(new URL('../src/auth/pairing.ts', import.meta.url).href)) as PairingApi;
}

async function loadAuthorizationApi(): Promise<AuthorizationApi> {
  return (await import(new URL('../src/auth/authorization.ts', import.meta.url).href)) as AuthorizationApi;
}

describe('Platform device pairing', () => {
  it('pairs only an approved same-origin challenge and keeps all other challenge states unpaired', async () => {
    const { createPairingController, createPlatformIdentityFixture } = await loadPairingApi();
    const cases: readonly { readonly outcome: PairingOutcome; readonly result: unknown }[] = [
      { outcome: 'approved', result: { deviceId: 'device-1', endpoint: 'https://platform.example', status: 'paired' } },
      { outcome: 'pending', result: { status: 'awaiting-approval' } },
      { outcome: 'rejected', result: { status: 'pairing-rejected' } },
      { outcome: 'expired', result: { status: 'pairing-expired' } },
      { outcome: 'origin-mismatch', result: { status: 'pairing-origin-mismatch' } },
    ];

    for (const testCase of cases) {
      const store = new MemoryCredentialStore();
      const controller = createPairingController({ identity: createPlatformIdentityFixture(testCase.outcome), now: () => 1_000, store });
      const challenge = await controller.begin('https://platform.example');

      expect(challenge).toEqual({
        approvalUrl: `https://platform.example/approve/${challenge.challengeId}`,
        challengeId: challenge.challengeId,
        status: 'awaiting-approval',
      });
      await expect(controller.complete(challenge.challengeId)).resolves.toEqual(testCase.result);
      await expect(store.load()).resolves.toEqual(testCase.outcome === 'approved' ? expect.anything() : undefined);
    }
  });

  it('refresh is single-flight for concurrent queue submissions', async () => {
    const { createAuthorizedSubmitter, createCredentialBoundary } = await loadAuthorizationApi();
    const store = new MemoryCredentialStore();
    await store.save({
      accessToken: 'expired-access',
      deviceId: 'device-1',
      deviceSecret: 'device-secret',
      endpoint: 'https://platform.example',
      expiresAt: 1_000,
      refreshToken: 'refresh-1',
    });
    let completeRefresh: ((value: { readonly accessToken: string; readonly expiresAt: number; readonly refreshToken: string }) => void) | undefined;
    const refreshed = new Promise<{ readonly accessToken: string; readonly expiresAt: number; readonly refreshToken: string }>((resolve) => {
      completeRefresh = resolve;
    });
    let markRefreshStarted: () => void = () => { throw new Error('Refresh did not start.'); };
    const refreshStarted = new Promise<void>((resolve) => { markRefreshStarted = resolve; });
    let refreshes = 0;
    const authorization = createCredentialBoundary({
      now: () => 1_000,
      refresh: async () => {
        refreshes += 1;
        markRefreshStarted();
        return refreshed;
      },
      store,
    });
    const observedTokens: string[] = [];
    const submit = createAuthorizedSubmitter({
      authorization,
      submit: async ({ accessToken }) => {
        observedTokens.push(accessToken);
        return { type: 'accepted' };
      },
    });

    const first = submit({ idempotencyKey: 'capture-1' });
    const second = submit({ idempotencyKey: 'capture-2' });
    await refreshStarted;
    expect(refreshes).toBe(1);
    completeRefresh?.({ accessToken: 'fresh-access', expiresAt: 61_000, refreshToken: 'refresh-2' });
    await Promise.all([first, second]);

    expect(observedTokens).toEqual(['fresh-access', 'fresh-access']);
  });

  it('revoked device clears credentials and terminates delivery', async () => {
    const { DeviceRevokedError, createAuthorizedQueueSubmitter, createCredentialBoundary } = await loadAuthorizationApi();
    const store = new MemoryCredentialStore();
    await store.save({
      accessToken: 'expired-access',
      deviceId: 'device-1',
      deviceSecret: 'device-secret',
      endpoint: 'https://platform.example',
      expiresAt: 1_000,
      refreshToken: 'refresh-1',
    });
    const authorization = createCredentialBoundary({
      now: () => 1_000,
      refresh: async () => { throw new DeviceRevokedError(); },
      store,
    });
    const submit = createAuthorizedQueueSubmitter({ authorization, submit: async () => ({ type: 'accepted' }) });

    await expect(submit({ idempotencyKey: 'capture-1' })).resolves.toEqual({ reason: 'authentication-required', type: 'terminal' });
    await expect(store.load()).resolves.toBeUndefined();
    await expect(authorization.connectionState()).resolves.toBe('logged-out');
  });
});
