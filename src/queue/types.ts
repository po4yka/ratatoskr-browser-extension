import type { CaptureDraft } from '../capture/draft';

export type QueueStatus = 'accepted' | 'queued' | 'retry-wait' | 'submitting' | 'terminal-failure';

export interface QueueItem {
  readonly attemptCount: number;
  readonly id: string;
  readonly idempotencyKey: string;
  readonly nextRetryAt?: number;
  readonly status: QueueStatus;
  readonly terminalReason?: 'policy' | 'retention-expired' | 'retry-exhausted' | 'validation';
}

export interface StoredQueueItem extends QueueItem {
  readonly attemptId?: string;
  readonly createdAt: number;
  readonly draft: CaptureDraft;
  readonly leaseExpiresAt?: number;
}

export interface QueueSnapshot {
  readonly items: readonly StoredQueueItem[];
}

export interface QueueStore {
  load(): Promise<unknown>;
  save(snapshot: QueueSnapshot): Promise<void>;
}

export interface QueueAlarm {
  schedule(at: number | undefined): void;
}

export interface QueueLimits {
  readonly maxAttempts: number;
  readonly maxItems: number;
  readonly maxPayloadBytes: number;
  readonly maxRetentionMs: number;
}

export type SubmitOutcome =
  | { readonly type: 'accepted' }
  | { readonly type: 'retryable'; readonly retryAfterMs?: number }
  | { readonly reason: 'policy' | 'validation'; readonly type: 'terminal' };

export interface SubmitRequest {
  readonly draft: CaptureDraft;
  readonly id: string;
  readonly idempotencyKey: string;
}

export type SubmitCapture = (request: SubmitRequest) => Promise<SubmitOutcome>;
