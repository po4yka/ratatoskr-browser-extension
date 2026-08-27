import type { DeliveryMode, QueueStatus } from '../queue/types';
import type { SocialOutcome } from '../capture/platform-client';
import { PROTOCOL_VERSION, type ProtocolError, type RuntimeSender } from './messages';
import { hasOnlyKeys, isRecord } from './validation';

export interface CaptureStatusMessage {
  readonly captureId: string;
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: 'capture.status';
}

export interface CaptureStatusReply {
  readonly captureId: string;
  readonly mode: DeliveryMode;
  readonly operation?: CaptureOperationStatus;
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly queueStatus: QueueStatus;
  readonly type: 'capture.status';
}

export interface CaptureOperationStatus {
  readonly progressPercent?: number;
  readonly readerLink?: string;
  readonly retryable: boolean;
  readonly socialOutcome?: SocialOutcome;
  readonly stage?: string;
  readonly status: 'accepted' | 'queued' | 'running' | 'succeeded' | 'partially_succeeded' | 'failed' | 'cancelled';
  readonly warningCount?: number;
}

export interface CaptureStatusHandler {
  readonly context: { readonly extensionId: string; readonly sender: RuntimeSender };
  readonly readStatus: (captureId: string) => Promise<CaptureStatusReply | undefined>;
}

export function createCaptureStatusMessage(captureId: string): CaptureStatusMessage {
  return { captureId, protocolVersion: PROTOCOL_VERSION, type: 'capture.status' };
}

export function isCaptureStatusCandidate(value: unknown): boolean {
  return isRecord(value) && value.type === 'capture.status';
}

export async function handleCaptureStatusMessage(raw: unknown, handler: CaptureStatusHandler): Promise<CaptureStatusReply | ProtocolError> {
  if (!isCaptureStatusMessage(raw)) {
    return protocolError('invalid-message');
  }
  if (handler.context.sender.id !== handler.context.extensionId || handler.context.sender.tab !== undefined) {
    return protocolError('unexpected-sender');
  }
  return (await handler.readStatus(raw.captureId)) ?? protocolError('unknown-message');
}

export function decodeCaptureStatusReply(raw: unknown): CaptureStatusReply | ProtocolError {
  return isCaptureStatusReply(raw) || isProtocolError(raw) ? raw : protocolError('invalid-message');
}

function isCaptureStatusMessage(value: unknown): value is CaptureStatusMessage {
  return isRecord(value) && hasOnlyKeys(value, ['captureId', 'protocolVersion', 'type'])
    && typeof value.captureId === 'string' && value.protocolVersion === PROTOCOL_VERSION && value.type === 'capture.status';
}

function isCaptureStatusReply(value: unknown): value is CaptureStatusReply {
  return isRecord(value) && hasStatusHeader(value) && (value.operation === undefined || isOperationStatus(value.operation));
}

function hasStatusHeader(value: Record<string, unknown>): boolean {
  return hasAllowedStatusKeys(value) && typeof value.captureId === 'string' && isMode(value.mode)
    && isQueueStatus(value.queueStatus) && value.protocolVersion === PROTOCOL_VERSION && value.type === 'capture.status';
}

function hasAllowedStatusKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => ['captureId', 'mode', 'operation', 'protocolVersion', 'queueStatus', 'type'].includes(key));
}

function isOperationStatus(value: unknown): value is CaptureOperationStatus {
  return isRecord(value) && hasOperationHeader(value) && hasOptionalOperationFields(value);
}

function hasOperationHeader(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => ['progressPercent', 'readerLink', 'retryable', 'socialOutcome', 'stage', 'status', 'warningCount'].includes(key))
    && typeof value.retryable === 'boolean' && isOperationState(value.status);
}

function hasOptionalOperationFields(value: Record<string, unknown>): boolean {
  return [
    optional(value.progressPercent, isNumber),
    optional(value.readerLink, isString),
    optional(value.stage, isString),
    optional(value.warningCount, isNumber),
    optional(value.socialOutcome, isSocialOutcome),
  ].every(Boolean);
}

function optional(value: unknown, validate: (candidate: unknown) => boolean): boolean {
  return value === undefined || validate(value);
}

function isNumber(value: unknown): boolean {
  return typeof value === 'number';
}

function isString(value: unknown): boolean {
  return typeof value === 'string';
}

function isSocialOutcome(value: unknown): value is SocialOutcome {
  return isRecord(value) && ((value.kind === 'unavailable'
    && (value.reason === 'deleted' || value.reason === 'unavailable'))
    || (value.kind === 'partial' && value.preservedPost === true && value.linkedArticle === 'extraction_failed'));
}

function isQueueStatus(value: unknown): value is QueueStatus {
  return value === 'accepted' || value === 'queued' || value === 'retry-wait' || value === 'submitting' || value === 'terminal-failure';
}

function isMode(value: unknown): value is DeliveryMode {
  return value === 'quick' || value === 'tracked';
}

function isOperationState(value: unknown): value is CaptureOperationStatus['status'] {
  return value === 'accepted' || value === 'queued' || value === 'running' || value === 'succeeded'
    || value === 'partially_succeeded' || value === 'failed' || value === 'cancelled';
}

function isProtocolError(value: unknown): value is ProtocolError {
  return isRecord(value) && hasOnlyKeys(value, ['code', 'protocolVersion', 'type'])
    && value.protocolVersion === PROTOCOL_VERSION && value.type === 'protocol.error'
    && ['credential-access-denied', 'github-unavailable', 'invalid-message', 'queue-unavailable', 'unexpected-sender', 'unknown-message', 'unsupported-protocol-version'].includes(String(value.code));
}

function protocolError(code: ProtocolError['code']): ProtocolError {
  return { code, protocolVersion: PROTOCOL_VERSION, type: 'protocol.error' };
}
