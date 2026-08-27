type ClearResult = { readonly failedStep?: string; readonly status: 'blocked' | 'cleared' | 'incomplete' };
type StorageArea = { readonly clear: () => Promise<void>; readonly name: 'local' | 'session' | 'sync' };

interface ClearDataOptions {
  readonly clearAlarm: () => Promise<void>;
  readonly grantedOrigins: () => Promise<readonly string[]>;
  readonly removeOrigins: (origins: readonly string[]) => Promise<void>;
  readonly resetVolatile: () => void;
  readonly revokeDevice: () => Promise<'failed' | 'revoked' | 'unpaired'>;
  readonly storageAreas: readonly StorageArea[];
}

export function createClearDataCoordinator(options: ClearDataOptions): { clearAll(): Promise<ClearResult> } {
  return { clearAll: async () => clearAll(options) };
}

async function clearAll(options: ClearDataOptions): Promise<ClearResult> {
  if (await options.revokeDevice() === 'failed') {
    return { status: 'blocked' };
  }
  for (const area of options.storageAreas) {
    const failure = await attempt(area.name, area.clear);
    if (failure !== undefined) return failure;
  }
  const alarmFailure = await attempt('alarm', options.clearAlarm);
  if (alarmFailure !== undefined) return alarmFailure;
  const permissionFailure = await clearOrigins(options);
  if (permissionFailure !== undefined) return permissionFailure;
  try {
    options.resetVolatile();
    return { status: 'cleared' };
  } catch {
    return { failedStep: 'volatile', status: 'incomplete' };
  }
}

async function clearOrigins(options: ClearDataOptions): Promise<ClearResult | undefined> {
  try {
    const origins = await options.grantedOrigins();
    if (origins.length > 0) await options.removeOrigins(origins);
    return undefined;
  } catch {
    return { failedStep: 'permissions', status: 'incomplete' };
  }
}

async function attempt(name: string, action: () => Promise<void>): Promise<ClearResult | undefined> {
  try {
    await action();
    return undefined;
  } catch {
    return { failedStep: name, status: 'incomplete' };
  }
}
