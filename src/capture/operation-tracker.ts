import type { OperationSnapshot } from './platform-client';

export interface OperationTracker {
  items(): Promise<readonly TrackedOperation[]>;
  poll(): Promise<void>;
  recover(items: readonly AcceptedQueueItem[]): Promise<void>;
}

export interface AcceptedQueueItem {
  readonly id: string;
  readonly mode?: 'quick' | 'tracked';
  readonly operationId?: string;
  readonly status: 'accepted';
}

export interface TrackedOperation {
  readonly captureId: string;
  readonly snapshot: OperationSnapshot;
}

export interface OperationTrackerStore {
  load(): Promise<unknown>;
  save(items: readonly TrackedOperation[]): Promise<void>;
}

interface OperationReader {
  readOperation(request: { readonly operationId: string }): Promise<OperationSnapshot>;
}

export function createOperationTracker(options: { readonly client: OperationReader; readonly store: OperationTrackerStore }): OperationTracker {
  return new PersistedOperationTracker(options);
}

export function readerDeepLink(endpoint: string, snapshot: OperationSnapshot): string | undefined {
  const document = snapshot.status === 'succeeded'
    ? snapshot.results.find((result) => result.resultKind === 'content.document' && documentId(result.target) !== undefined)
    : undefined;
  const id = document === undefined ? undefined : documentId(document.target);
  return id === undefined ? undefined : new URL(`/documents/${id}`, endpoint).toString();
}

export function canRetry(snapshot: OperationSnapshot): boolean {
  return snapshot.retryable && isTerminal(snapshot.status) && snapshot.status !== 'succeeded';
}

class PersistedOperationTracker implements OperationTracker {
  constructor(private readonly options: { readonly client: OperationReader; readonly store: OperationTrackerStore }) {}

  async recover(queueItems: readonly AcceptedQueueItem[]): Promise<void> {
    const current = await this.items();
    const additions = queueItems.flatMap((item) => item.mode === 'tracked' && item.operationId !== undefined && !hasCapture(current, item.id)
      ? [{ captureId: item.id, snapshot: acceptedSnapshot(item.operationId) }]
      : []);
    if (additions.length > 0) {
      await this.options.store.save([...current, ...additions]);
    }
  }

  async poll(): Promise<void> {
    const current = await this.items();
    const next = await Promise.all(current.map(async (item) => isTerminal(item.snapshot.status)
      ? item
      : applyIfNewer(item, await this.options.client.readOperation({ operationId: item.snapshot.operationId }))));
    await this.options.store.save(next);
  }

  async items(): Promise<readonly TrackedOperation[]> {
    const value = await this.options.store.load();
    return isTrackedOperations(value) ? value : [];
  }
}

function applyIfNewer(current: TrackedOperation, candidate: OperationSnapshot): TrackedOperation {
  return candidate.statusChangedAt > current.snapshot.statusChangedAt ? { ...current, snapshot: candidate } : current;
}

function acceptedSnapshot(operationId: string): OperationSnapshot {
  return { operationId, results: [], retryable: false, status: 'accepted', statusChangedAt: '', warnings: [] };
}

function hasCapture(items: readonly TrackedOperation[], captureId: string): boolean {
  return items.some((item) => item.captureId === captureId);
}

function documentId(target: string): string | undefined {
  const id = target.startsWith('document:') ? target.slice('document:'.length) : '';
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id) ? id : undefined;
}

function isTerminal(status: OperationSnapshot['status']): boolean {
  return status === 'succeeded' || status === 'partially_succeeded' || status === 'failed' || status === 'cancelled';
}

function isTrackedOperations(value: unknown): value is readonly TrackedOperation[] {
  return Array.isArray(value) && value.every(isTrackedOperation);
}

function isTrackedOperation(value: unknown): value is TrackedOperation {
  return isRecord(value) && typeof value.captureId === 'string' && isSnapshot(value.snapshot);
}

function isSnapshot(value: unknown): value is OperationSnapshot {
  return isRecord(value) && typeof value.operationId === 'string' && isStatus(value.status)
    && typeof value.retryable === 'boolean' && typeof value.statusChangedAt === 'string'
    && Array.isArray(value.results) && Array.isArray(value.warnings);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is OperationSnapshot['status'] {
  return value === 'accepted' || value === 'queued' || value === 'running' || value === 'succeeded'
    || value === 'partially_succeeded' || value === 'failed' || value === 'cancelled';
}
