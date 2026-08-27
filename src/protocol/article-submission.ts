import type { CaptureDraft } from '../capture/draft';
import type { DeliveryMode, QueueItem } from '../queue/types';
import { PROTOCOL_VERSION, type ProtocolError, type RuntimeSender } from './messages';
import { hasOnlyKeys, isCaptureDraft, isRecord } from './validation';

export interface PopupSubmitMessage {
  readonly draft: CaptureDraft;
  readonly mode: DeliveryMode;
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: 'popup.submit-draft';
}

export interface CaptureQueued {
  readonly captureId: string;
  readonly mode: DeliveryMode;
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly status: 'queued';
  readonly type: 'capture.queued';
}

export interface SubmissionQueue {
  enqueue(draft: CaptureDraft, mode: DeliveryMode): Promise<QueueItem>;
}

export interface SubmissionHandler {
  readonly context: { readonly extensionId: string; readonly sender: RuntimeSender };
  readonly queue: SubmissionQueue;
}

export function createPopupSubmitMessage(draft: CaptureDraft, mode: DeliveryMode): PopupSubmitMessage {
  return { draft, mode, protocolVersion: PROTOCOL_VERSION, type: 'popup.submit-draft' };
}

export function isArticleSubmissionCandidate(value: unknown): boolean {
  return isRecord(value) && value.type === 'popup.submit-draft';
}

export async function handleArticleSubmissionMessage(raw: unknown, handler: SubmissionHandler): Promise<CaptureQueued | ProtocolError> {
  if (!isPopupSubmitMessage(raw)) {
    return protocolError('invalid-message');
  }
  if (handler.context.sender.id !== handler.context.extensionId || handler.context.sender.tab !== undefined) {
    return protocolError('unexpected-sender');
  }
  const item = await handler.queue.enqueue(raw.draft, raw.mode);
  return { captureId: item.id, mode: raw.mode, protocolVersion: PROTOCOL_VERSION, status: 'queued', type: 'capture.queued' };
}

export function decodeCaptureQueuedReply(raw: unknown): CaptureQueued | ProtocolError {
  return isCaptureQueued(raw) || isProtocolError(raw) ? raw : protocolError('invalid-message');
}

function isPopupSubmitMessage(value: unknown): value is PopupSubmitMessage {
  return isRecord(value) && hasOnlyKeys(value, ['draft', 'mode', 'protocolVersion', 'type'])
    && value.protocolVersion === PROTOCOL_VERSION && value.type === 'popup.submit-draft'
    && isCaptureDraft(value.draft) && value.draft.github === undefined
    && (value.mode === 'quick' || value.mode === 'tracked');
}

function isCaptureQueued(value: unknown): value is CaptureQueued {
  return isRecord(value) && hasOnlyKeys(value, ['captureId', 'mode', 'protocolVersion', 'status', 'type'])
    && value.protocolVersion === PROTOCOL_VERSION && typeof value.captureId === 'string'
    && (value.mode === 'quick' || value.mode === 'tracked') && value.status === 'queued' && value.type === 'capture.queued';
}

function isProtocolError(value: unknown): value is ProtocolError {
  return isRecord(value) && hasOnlyKeys(value, ['code', 'protocolVersion', 'type'])
    && value.protocolVersion === PROTOCOL_VERSION && value.type === 'protocol.error'
    && ['credential-access-denied', 'github-unavailable', 'invalid-message', 'queue-unavailable', 'unexpected-sender', 'unknown-message', 'unsupported-protocol-version'].includes(String(value.code));
}

function protocolError(code: ProtocolError['code']): ProtocolError {
  return { code, protocolVersion: PROTOCOL_VERSION, type: 'protocol.error' };
}
