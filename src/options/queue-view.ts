import type { QueueSummary } from '../protocol/queue-inspection';

export function queueItemText(item: QueueSummary): string {
  const retry = item.nextRetryAt === undefined ? '' : `; retry at ${new Date(item.nextRetryAt).toISOString()}`;
  const terminal = item.terminalReason === undefined ? '' : `; ${item.terminalReason} failure`;
  return `Capture ${item.id}: ${item.status}; attempt ${item.attemptCount}${retry}${terminal}`;
}
