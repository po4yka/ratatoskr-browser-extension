import type { DeviceCredentialRecord, DeviceCredentialStore } from './pairing';

export type DeviceRevocationResult = 'already-unauthorized' | 'revoked';
export type DeviceRevocationStatus = { readonly status: 'failed' | 'revoked' | 'unpaired' };

export function createDeviceRevocationController(options: {
  readonly revoke: (credential: DeviceCredentialRecord) => Promise<DeviceRevocationResult>;
  readonly store: DeviceCredentialStore;
}): { revoke(): Promise<DeviceRevocationStatus> } {
  return {
    revoke: async () => {
      const stored = await options.store.load();
      if (!isCredential(stored)) {
        return { status: 'unpaired' };
      }
      try {
        await options.revoke(stored);
        await options.store.clear();
        return { status: 'revoked' };
      } catch {
        return isCredential(await options.store.load()) ? { status: 'failed' } : { status: 'revoked' };
      }
    },
  };
}

function isCredential(value: unknown): value is DeviceCredentialRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return [record.accessToken, record.deviceId, record.deviceSecret, record.endpoint, record.refreshToken]
    .every((field) => typeof field === 'string') && typeof record.expiresAt === 'number';
}
