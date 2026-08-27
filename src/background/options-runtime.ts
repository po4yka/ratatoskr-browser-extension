import type { DeviceCredentialStore } from '../auth/pairing';
import { createCredentialBoundary } from '../auth/authorization';
import { createPlatformIdentityClient } from '../auth/platform-identity';
import { createDeviceRevocationController } from '../auth/revocation';
import type { TrackedOperation } from '../capture/operation-tracker';
import { queueAlarmName } from '../queue/alarm';
import type { QueueItem } from '../queue/types';
import { createClearDataCoordinator } from '../options/clear-data';
import { buildDiagnostics } from '../options/diagnostics';
import { createChromePreferenceStore, projectOptionsState } from '../options/state';
import { handleOptionsControlMessage, isOptionsControlCandidate } from '../protocol/options-control';
import type { RuntimeSender } from '../protocol/messages';

interface OptionsRuntimeInput {
  readonly credentialStore: DeviceCredentialStore;
  readonly fetcher: typeof fetch;
  readonly operations: () => Promise<readonly TrackedOperation[]>;
  readonly queue: () => Promise<readonly QueueItem[]>;
  readonly rawQueue: () => Promise<unknown>;
}

interface RuntimeContext {
  readonly extensionId: string;
  readonly sender: RuntimeSender;
}

export function createOptionsRuntime(input: OptionsRuntimeInput): {
  handle(message: unknown, context: RuntimeContext): Promise<unknown>;
  handles(message: unknown): boolean;
} {
  const preferences = createChromePreferenceStore();
  const authorization = createCredentialBoundary({
    now: () => Date.now(),
    refresh: (token, endpoint) => createPlatformIdentityClient({ endpoint, fetch: input.fetcher }).refresh(token),
    store: input.credentialStore,
  });
  const revocation = createDeviceRevocationController({
    revoke: async (credential) => createPlatformIdentityClient({ endpoint: credential.endpoint, fetch: input.fetcher })
      .revoke({ accessToken: await authorization.accessToken(), deviceId: credential.deviceId }),
    store: input.credentialStore,
  });
  const clearData = createClearDataCoordinator(clearDataOptions(async () => (await revocation.revoke()).status));
  return {
    handle: async (message, context) => handleOptionsControlMessage(message, {
      clearAll: clearData.clearAll,
      context,
      diagnostics: async (includeUrls) => diagnostics(input, includeUrls),
      optionsPageUrl: chrome.runtime.getURL('options/index.html'),
      popupPageUrl: chrome.runtime.getURL('popup/index.html'),
      readPreference: preferences.load,
      readState: async () => projectOptionsState({
        credential: await input.credentialStore.load(), preference: await preferences.load(), queue: await input.queue(),
      }),
      revoke: revocation.revoke,
      savePreference: preferences.save,
    }),
    handles: isOptionsControlCandidate,
  };
}

function clearDataOptions(revokeDevice: () => Promise<'failed' | 'revoked' | 'unpaired'>) {
  return {
    clearAlarm: async () => { await chrome.alarms.clear(queueAlarmName); },
    grantedOrigins: async () => (await chrome.permissions.getAll()).origins ?? [],
    removeOrigins: async (origins: readonly string[]) => {
      if (!await chrome.permissions.remove({ origins: [...origins] })) throw new Error('permissions-not-removed');
    },
    resetVolatile: () => undefined,
    revokeDevice,
    storageAreas: [
      { clear: async () => chrome.storage.local.clear(), name: 'local' as const },
      { clear: async () => chrome.storage.session.clear(), name: 'session' as const },
      { clear: async () => chrome.storage.sync.clear(), name: 'sync' as const },
    ],
  };
}

async function diagnostics(input: OptionsRuntimeInput, includeUrls: boolean) {
  const [credential, rawQueue, operations, origins] = await Promise.all([
    input.credentialStore.load(), input.rawQueue(), input.operations(), chrome.permissions.getAll(),
  ]);
  const safeCredential = publicCredential(credential);
  return buildDiagnostics({
    browser: browserIdentity(navigator.userAgent),
    ...(safeCredential === undefined ? {} : { endpoint: safeCredential.endpoint }),
    extensionVersion: chrome.runtime.getManifest().version,
    operations: operations.map((item) => ({ status: item.snapshot.status })),
    paired: safeCredential !== undefined,
    permissions: { endpointOrigin: safeCredential !== undefined && (origins.origins ?? []).includes(`${safeCredential.endpoint}/*`) },
    queue: diagnosticQueue(rawQueue),
  }, { includeUrls });
}

function diagnosticQueue(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value) || !Array.isArray(value.items)) return [];
  return value.items.flatMap((item) => isRecord(item) ? [{
    status: item.status,
    ...(isRecord(item.draft) && typeof item.draft.url === 'string' ? { url: item.draft.url } : {}),
  }] : []);
}

function publicCredential(value: unknown): { readonly endpoint: string } | undefined {
  return isRecord(value) && typeof value.endpoint === 'string' && typeof value.deviceId === 'string'
    ? { endpoint: value.endpoint } : undefined;
}

function browserIdentity(userAgent: string): { readonly family: string; readonly version: string } {
  const match = /(Firefox|Edg|Chrome)\/([0-9.]+)/.exec(userAgent);
  return { family: match?.[1] ?? 'unknown', version: match?.[2] ?? 'unknown' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
