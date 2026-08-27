import type { QueueItem } from '../queue/types';
import { PROTOCOL_VERSION, type ProtocolError, type RuntimeSender } from './messages';
import { hasOnlyKeys, isRecord } from './validation';

export interface QueueInspectionMessage {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: 'queue.inspect';
}

export type QueueSummary = Pick<QueueItem, 'attemptCount' | 'id' | 'nextRetryAt' | 'status' | 'terminalReason'>;

export interface QueueInspected {
  readonly items: readonly QueueSummary[];
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: 'queue.inspected';
}

export interface QueueReader {
  items(): Promise<readonly QueueItem[]>;
}

export interface QueueInspectionContext {
  readonly extensionId: string;
  readonly sender: RuntimeSender;
}

export interface QueueInspectionHandler {
  readonly context: QueueInspectionContext;
  readonly queue: QueueReader;
}

export function createQueueInspectionMessage(): QueueInspectionMessage {
  return { protocolVersion: PROTOCOL_VERSION, type: 'queue.inspect' };
}

export function isQueueInspectionCandidate(value: unknown): boolean {
  return isRecord(value) && value.type === 'queue.inspect';
}

export async function handleQueueInspectionMessage(
  rawMessage: unknown,
  handler: QueueInspectionHandler,
): Promise<QueueInspected | ProtocolError> {
  if (!isQueueInspectionMessage(rawMessage)) {
    return protocolError('invalid-message');
  }
  if (handler.context.sender.id !== handler.context.extensionId || handler.context.sender.tab !== undefined) {
    return protocolError('unexpected-sender');
  }
  const items = await handler.queue.items();
  return { items: items.map(queueSummary), protocolVersion: PROTOCOL_VERSION, type: 'queue.inspected' };
}

export function decodeQueueInspectionReply(rawMessage: unknown): QueueInspected | ProtocolError {
  if (isQueueInspected(rawMessage) || isProtocolError(rawMessage)) {
    return rawMessage;
  }
  return protocolError('invalid-message');
}

function isQueueInspectionMessage(value: unknown): value is QueueInspectionMessage {
  return isRecord(value)
    && hasOnlyKeys(value, ['protocolVersion', 'type'])
    && value.protocolVersion === PROTOCOL_VERSION
    && value.type === 'queue.inspect';
}

function isQueueInspected(value: unknown): value is QueueInspected {
  return isRecord(value)
    && hasOnlyKeys(value, ['items', 'protocolVersion', 'type'])
    && value.protocolVersion === PROTOCOL_VERSION
    && value.type === 'queue.inspected'
    && Array.isArray(value.items)
    && value.items.every(isQueueSummary);
}

function isQueueSummary(value: unknown): value is QueueSummary {
  return isRecord(value)
    && hasOnlyKeys(value, ['attemptCount', 'id', 'nextRetryAt', 'status', 'terminalReason'])
    && hasRequiredSummaryFields(value)
    && hasOptionalSummaryFields(value);
}

function isProtocolError(value: unknown): value is ProtocolError {
  return isRecord(value)
    && hasOnlyKeys(value, ['code', 'protocolVersion', 'type'])
    && value.protocolVersion === PROTOCOL_VERSION
    && value.type === 'protocol.error'
    && isProtocolErrorCode(value.code);
}

function hasRequiredSummaryFields(value: Record<string, unknown>): boolean {
  return typeof value.attemptCount === 'number' && typeof value.id === 'string' && isQueueStatus(value.status);
}

function hasOptionalSummaryFields(value: Record<string, unknown>): boolean {
  return (value.nextRetryAt === undefined || typeof value.nextRetryAt === 'number')
    && isTerminalReason(value.terminalReason);
}

function isTerminalReason(value: unknown): boolean {
  return value === undefined || value === 'policy' || value === 'retention-expired'
    || value === 'retry-exhausted' || value === 'validation';
}

function isProtocolErrorCode(value: unknown): boolean {
  return value === 'github-unavailable' || value === 'invalid-message' || value === 'queue-unavailable' || value === 'unexpected-sender'
    || value === 'unknown-message' || value === 'unsupported-protocol-version';
}

function isQueueStatus(value: unknown): value is QueueSummary['status'] {
  return value === 'accepted' || value === 'queued' || value === 'retry-wait' || value === 'submitting' || value === 'terminal-failure';
}

function queueSummary(item: QueueItem): QueueSummary {
  return {
    attemptCount: item.attemptCount,
    id: item.id,
    ...(item.nextRetryAt === undefined ? {} : { nextRetryAt: item.nextRetryAt }),
    status: item.status,
    ...(item.terminalReason === undefined ? {} : { terminalReason: item.terminalReason }),
  };
}

function protocolError(code: ProtocolError['code']): ProtocolError {
  return { code, protocolVersion: PROTOCOL_VERSION, type: 'protocol.error' };
}
