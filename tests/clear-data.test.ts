import { describe, expect, it, vi } from 'vitest';

interface ClearDataApi {
  createClearDataCoordinator(options: ClearOptions): {
    clearAll(): Promise<{ readonly failedStep?: string; readonly status: 'blocked' | 'cleared' | 'incomplete' }>;
  };
}

interface ClearOptions {
  readonly clearAlarm: () => Promise<void>;
  readonly removeOrigins: (origins: readonly string[]) => Promise<void>;
  readonly resetVolatile: () => void;
  readonly revokeDevice: () => Promise<'failed' | 'revoked' | 'unpaired'>;
  readonly storageAreas: readonly { readonly clear: () => Promise<void>; readonly name: 'local' | 'session' | 'sync' }[];
  readonly grantedOrigins: () => Promise<readonly string[]>;
}

async function loadApi(): Promise<ClearDataApi> {
  return (await import(new URL('../src/options/clear-data.ts', import.meta.url).href)) as ClearDataApi;
}

function options(overrides: Partial<ClearOptions> = {}): ClearOptions & { readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    clearAlarm: async () => { calls.push('alarm'); },
    grantedOrigins: async () => ['https://ratatoskr.example/*'],
    removeOrigins: async (origins) => { calls.push(`origins:${origins.join(',')}`); },
    resetVolatile: () => { calls.push('volatile'); },
    revokeDevice: async () => { calls.push('revoke'); return 'revoked'; },
    storageAreas: (['local', 'session', 'sync'] as const).map((name) => ({ clear: async () => { calls.push(name); }, name })),
    ...overrides,
  };
}

describe('clear all data', () => {
  it('clear-all removes every extension-owned residue after revocation', async () => {
    const { createClearDataCoordinator } = await loadApi();
    const setup = options();
    await expect(createClearDataCoordinator(setup).clearAll()).resolves.toEqual({ status: 'cleared' });
    expect(setup.calls).toEqual(['revoke', 'local', 'session', 'sync', 'alarm', 'origins:https://ratatoskr.example/*', 'volatile']);
  });

  it('paired clear-all stops before erasure when revoke is unconfirmed', async () => {
    const { createClearDataCoordinator } = await loadApi();
    const setup = options({ revokeDevice: async () => 'failed' });
    await expect(createClearDataCoordinator(setup).clearAll()).resolves.toEqual({ status: 'blocked' });
    expect(setup.calls).toEqual([]);
  });

  it('partial cleanup never reports complete', async () => {
    const { createClearDataCoordinator } = await loadApi();
    const setup = options({ clearAlarm: vi.fn(async () => { throw new Error('alarm failed'); }) });
    await expect(createClearDataCoordinator(setup).clearAll()).resolves.toEqual({ failedStep: 'alarm', status: 'incomplete' });
    expect(setup.calls).toEqual(['revoke', 'local', 'session', 'sync']);
  });
});
