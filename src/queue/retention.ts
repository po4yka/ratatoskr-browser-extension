import type { CaptureDraft } from '../capture/draft';
import type { QueueItem, QueueLimits, QueueSnapshot, StoredQueueItem } from './types';

export class QueueCapacityError extends Error {}

export function assertCanEnqueue(context: { readonly draft: CaptureDraft; readonly limits: QueueLimits; readonly snapshot: QueueSnapshot }): void {
  if (context.snapshot.items.length >= context.limits.maxItems) {
    throw new QueueCapacityError('The local capture queue is full.');
  }
  if (draftSize(context.draft) > context.limits.maxPayloadBytes) {
    throw new QueueCapacityError('The capture is too large for the local queue.');
  }
}

export function expiredItem(item: StoredQueueItem, context: { readonly limits: QueueLimits; readonly now: number }): StoredQueueItem {
  return context.now - item.createdAt >= context.limits.maxRetentionMs && isRetained(item)
    ? terminalItem(settledItem(item), 'retention-expired')
    : item;
}

export function terminalItem(
  item: Omit<StoredQueueItem, 'attemptId' | 'leaseExpiresAt' | 'nextRetryAt' | 'terminalReason'>,
  terminalReason: NonNullable<QueueItem['terminalReason']>,
): StoredQueueItem {
  return { ...item, status: 'terminal-failure', terminalReason };
}

export function settledItem(item: StoredQueueItem): Omit<StoredQueueItem, 'attemptId' | 'leaseExpiresAt' | 'nextRetryAt' | 'terminalReason'> {
  return {
    attemptCount: item.attemptCount,
    createdAt: item.createdAt,
    draft: item.draft,
    id: item.id,
    idempotencyKey: item.idempotencyKey,
    status: item.status,
  };
}

function draftSize(draft: CaptureDraft): number {
  return new TextEncoder().encode(JSON.stringify(draft)).byteLength;
}

function isRetained(item: StoredQueueItem): boolean {
  return item.status !== 'accepted' && item.status !== 'terminal-failure';
}
