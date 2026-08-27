import type { QueueItem, StoredQueueItem } from './types';

export function presentQueueItem(item: StoredQueueItem): QueueItem {
  return {
    attemptCount: item.attemptCount,
    id: item.id,
    idempotencyKey: item.idempotencyKey,
    ...(item.mode === undefined ? {} : { mode: item.mode }),
    ...(item.nextRetryAt === undefined ? {} : { nextRetryAt: item.nextRetryAt }),
    ...(item.operationId === undefined ? {} : { operationId: item.operationId }),
    status: item.status,
    ...(item.terminalReason === undefined ? {} : { terminalReason: item.terminalReason }),
  };
}

export function replaceQueueItem(items: readonly StoredQueueItem[], replacement: StoredQueueItem): readonly StoredQueueItem[] {
  return items.map((item) => item.id === replacement.id ? replacement : item);
}
