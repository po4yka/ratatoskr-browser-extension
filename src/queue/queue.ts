import type { CaptureDraft } from '../capture/draft';
import { assertCanEnqueue, expiredItem, settledItem, terminalItem } from './retention';
import { SerialQueueOperations } from './serial';
import type { QueueAlarm, QueueItem, QueueLimits, QueueSnapshot, QueueStore, StoredQueueItem, SubmitCapture, SubmitOutcome } from './types';

const maximumRetryDelayMs = 60_000;
const baseRetryDelayMs = 1_000;
const submissionLeaseMs = 1_000;

const defaultLimits: QueueLimits = {
  maxAttempts: 8,
  maxItems: 100,
  maxPayloadBytes: 32_768,
  maxRetentionMs: 30 * 24 * 60 * 60 * 1_000,
};

export interface QueueOptions {
  readonly alarm?: QueueAlarm;
  readonly createAttemptId: () => string;
  readonly createCaptureId: () => string;
  readonly createIdempotencyKey: () => string;
  readonly now: () => number;
  readonly random: () => number;
  readonly limits?: QueueLimits;
  readonly store: QueueStore;
  readonly submit: SubmitCapture;
}

export { QueueCapacityError } from './retention';
export type { QueueLimits } from './types';

export interface DurableQueue {
  enqueue(draft: CaptureDraft): Promise<QueueItem>;
  items(): Promise<readonly QueueItem[]>;
  processDue(): Promise<void>;
}

export function createQueue(options: QueueOptions): DurableQueue {
  return new StorageBackedQueue(options);
}

class StorageBackedQueue implements DurableQueue {
  private readonly operations = new SerialQueueOperations();

  constructor(private readonly options: QueueOptions) {}

  enqueue(draft: CaptureDraft): Promise<QueueItem> {
    return this.operations.run(() => this.enqueuePersisted(draft));
  }

  items(): Promise<readonly QueueItem[]> {
    return this.operations.run(() => this.readItems());
  }

  async processDue(): Promise<void> {
    const claim = await this.operations.run(() => this.claimDueAfterExpiry());
    if (claim === undefined) {
      return;
    }
    const outcome = await this.options.submit({ draft: claim.draft, id: claim.id, idempotencyKey: claim.idempotencyKey });
    await this.operations.run(() => this.complete({ attemptId: claim.attemptId, id: claim.id, outcome }));
  }

  private async enqueuePersisted(draft: CaptureDraft): Promise<QueueItem> {
    const snapshot = await readSnapshot(this.options.store);
    assertCanEnqueue({ draft, limits: this.limits, snapshot });
    const item: StoredQueueItem = {
      attemptCount: 0,
      createdAt: this.options.now(),
      draft,
      id: this.options.createCaptureId(),
      idempotencyKey: this.options.createIdempotencyKey(),
      status: 'queued',
    };
    await this.save({ items: [...snapshot.items, item] });
    return present(item);
  }

  private async readItems(): Promise<readonly QueueItem[]> {
    const snapshot = await readSnapshot(this.options.store);
    return snapshot.items.map(present);
  }

  private async claimDueAfterExpiry(): Promise<StoredQueueItem | undefined> {
    await this.expireRetainedItems();
    return this.claimDue();
  }

  private async claimDue(): Promise<StoredQueueItem | undefined> {
    const snapshot = await readSnapshot(this.options.store);
    const now = this.options.now();
    const item = snapshot.items.find((candidate) => isDue(candidate, now));
    if (item === undefined) {
      return undefined;
    }
    const claimed: StoredQueueItem = {
      ...item,
      attemptId: this.options.createAttemptId(),
      leaseExpiresAt: now + submissionLeaseMs,
      status: 'submitting',
    };
    await this.save({ items: replace(snapshot.items, claimed) });
    return claimed;
  }

  private async complete(completion: QueueCompletion): Promise<void> {
    const snapshot = await readSnapshot(this.options.store);
    const item = snapshot.items.find((candidate) => candidate.id === completion.id);
    if (item === undefined || item.status !== 'submitting' || item.attemptId !== completion.attemptId) {
      return;
    }
    await this.save({ items: replace(snapshot.items, completedItem(item, {
      limits: this.limits,
      now: this.options.now(),
      outcome: completion.outcome,
      random: this.options.random,
    })) });
  }

  private async save(snapshot: QueueSnapshot): Promise<void> {
    await this.options.store.save(snapshot);
    this.options.alarm?.schedule(nextWakeAt(snapshot.items, this.options.now()));
  }

  private get limits(): QueueLimits {
    return this.options.limits ?? defaultLimits;
  }

  private async expireRetainedItems(): Promise<void> {
    const snapshot = await readSnapshot(this.options.store);
    const items = snapshot.items.map((item) => expiredItem(item, { limits: this.limits, now: this.options.now() }));
    if (items.some((item, index) => item !== snapshot.items[index])) {
      await this.save({ items });
    }
  }
}

async function readSnapshot(store: QueueStore): Promise<QueueSnapshot> {
  const value = await store.load();
  return hasSnapshot(value) ? value : { items: [] };
}

function hasSnapshot(value: unknown): value is QueueSnapshot {
  return typeof value === 'object' && value !== null && 'items' in value && Array.isArray(value.items);
}

function isDue(item: StoredQueueItem, now: number): boolean {
  return item.status === 'queued'
    || (item.status === 'retry-wait' && (item.nextRetryAt ?? now) <= now)
    || (item.status === 'submitting' && (item.leaseExpiresAt ?? now) <= now);
}

interface QueueCompletion {
  readonly attemptId: string | undefined;
  readonly id: string;
  readonly outcome: SubmitOutcome;
}

interface CompletionContext {
  readonly limits: QueueLimits;
  readonly now: number;
  readonly outcome: SubmitOutcome;
  readonly random: () => number;
}

function completedItem(item: StoredQueueItem, context: CompletionContext): StoredQueueItem {
  const settled = settledItem(item);
  if (context.outcome.type === 'accepted') {
    return { ...settled, attemptCount: item.attemptCount + 1, status: 'accepted' };
  }
  if (context.outcome.type === 'terminal') {
    return { ...settled, attemptCount: item.attemptCount + 1, status: 'terminal-failure', terminalReason: context.outcome.reason };
  }
  if (item.attemptCount + 1 >= context.limits.maxAttempts) {
    return terminalItem(settled, 'retry-exhausted');
  }
  return {
    ...settled,
    attemptCount: item.attemptCount + 1,
    nextRetryAt: context.now + retryDelay(context.outcome, { attemptCount: item.attemptCount + 1, random: context.random }),
    status: 'retry-wait',
  };
}


function retryDelay(
  outcome: Extract<SubmitOutcome, { readonly type: 'retryable' }>,
  context: { readonly attemptCount: number; readonly random: () => number },
): number {
  if (isValidRetryAfter(outcome.retryAfterMs)) {
    return outcome.retryAfterMs;
  }
  const exponential = baseRetryDelayMs * 2 ** Math.min(context.attemptCount - 1, 6);
  return Math.round(Math.min(exponential * jitter(context.random()), maximumRetryDelayMs));
}

function isValidRetryAfter(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function jitter(value: number): number {
  return 0.75 + Math.min(Math.max(value, 0), 1) * 0.5;
}

function nextWakeAt(items: readonly StoredQueueItem[], now: number): number | undefined {
  const eligible = items.filter((item) => item.status === 'queued' || item.status === 'retry-wait' || item.status === 'submitting');
  return eligible.reduce<number | undefined>((next, item) => earliest(next, retryTime(item, now)), undefined);
}

function retryTime(item: StoredQueueItem, now: number): number {
  return item.status === 'submitting' ? item.leaseExpiresAt ?? now : item.nextRetryAt ?? now;
}

function earliest(left: number | undefined, right: number): number {
  return left === undefined || right < left ? right : left;
}

function present(item: StoredQueueItem): QueueItem {
  return {
    attemptCount: item.attemptCount,
    id: item.id,
    idempotencyKey: item.idempotencyKey,
    ...(item.nextRetryAt === undefined ? {} : { nextRetryAt: item.nextRetryAt }),
    status: item.status,
    ...(item.terminalReason === undefined ? {} : { terminalReason: item.terminalReason }),
  };
}

function replace(items: readonly StoredQueueItem[], replacement: StoredQueueItem): readonly StoredQueueItem[] {
  return items.map((item) => item.id === replacement.id ? replacement : item);
}
