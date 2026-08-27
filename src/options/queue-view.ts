interface QueueSummary {
  readonly attemptCount: number;
  readonly id: string;
  readonly mode?: 'quick' | 'tracked';
  readonly nextRetryAt?: number;
  readonly status: string;
  readonly terminalReason?: string;
}

export function queueItemText(item: QueueSummary, translate?: (values: readonly string[]) => string): string {
  const retry = item.nextRetryAt === undefined ? '' : `; retry at ${new Date(item.nextRetryAt).toISOString()}`;
  const terminal = item.terminalReason === undefined ? '' : `; ${item.terminalReason} failure`;
  if (translate !== undefined) {
    return translate([item.id, item.status, item.mode ?? 'quick', String(item.attemptCount), retry, terminal]);
  }
  return `Capture ${item.id}: ${item.status}; attempt ${item.attemptCount}${retry}${terminal}`;
}
