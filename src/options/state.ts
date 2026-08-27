export type CaptureMode = 'quick' | 'tracked';

export interface CapturePreferences {
  readonly defaultCaptureMode: CaptureMode;
}

export interface PreferenceStorage {
  get(): Promise<unknown>;
  set(value: CapturePreferences): Promise<void>;
}

export interface PreferenceStore {
  load(): Promise<CapturePreferences>;
  save(value: CapturePreferences): Promise<void>;
}

export interface SafeOptionsState {
  readonly defaultCaptureMode: CaptureMode;
  readonly device: { readonly deviceId: string; readonly endpoint: string; readonly status: 'paired' } | { readonly status: 'unpaired' };
  readonly queue: readonly SafeQueueItem[];
}

interface SafeQueueItem {
  readonly attemptCount: number;
  readonly id: string;
  readonly mode: CaptureMode;
  readonly nextRetryAt?: number;
  readonly status: string;
  readonly terminalReason?: string;
}

export function createPreferenceStore(storage: PreferenceStorage): PreferenceStore {
  return {
    load: async () => preference(await storage.get()),
    save: async (value) => storage.set(preference(value)),
  };
}

const preferenceKey = 'capturePreferences';

export function createChromePreferenceStore(): PreferenceStore {
  return createPreferenceStore({
    get: async () => (await chrome.storage.local.get(preferenceKey))[preferenceKey],
    set: async (value) => chrome.storage.local.set({ [preferenceKey]: value }),
  });
}

export function initialCaptureMode(value: CapturePreferences): { readonly mode: CaptureMode; readonly submitted: false } {
  return { mode: value.defaultCaptureMode, submitted: false };
}

export function projectOptionsState(input: unknown): SafeOptionsState {
  const record = isRecord(input) ? input : {};
  const queue = Array.isArray(record.queue) ? record.queue.flatMap(safeQueueItem) : [];
  return {
    defaultCaptureMode: preference(record.preference).defaultCaptureMode,
    device: safeDevice(record.credential),
    queue,
  };
}

function preference(value: unknown): CapturePreferences {
  return isRecord(value) && (value.defaultCaptureMode === 'quick' || value.defaultCaptureMode === 'tracked')
    ? { defaultCaptureMode: value.defaultCaptureMode }
    : { defaultCaptureMode: 'quick' };
}

function safeDevice(value: unknown): SafeOptionsState['device'] {
  return isRecord(value) && typeof value.deviceId === 'string' && typeof value.endpoint === 'string'
    ? { deviceId: value.deviceId, endpoint: value.endpoint, status: 'paired' }
    : { status: 'unpaired' };
}

function safeQueueItem(value: unknown): SafeQueueItem[] {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.attemptCount !== 'number' || typeof value.status !== 'string') {
    return [];
  }
  return [{
    attemptCount: value.attemptCount,
    id: value.id,
    mode: value.mode === 'tracked' ? 'tracked' : 'quick',
    ...(typeof value.nextRetryAt === 'number' ? { nextRetryAt: value.nextRetryAt } : {}),
    status: value.status,
    ...(typeof value.terminalReason === 'string' ? { terminalReason: value.terminalReason } : {}),
  }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
