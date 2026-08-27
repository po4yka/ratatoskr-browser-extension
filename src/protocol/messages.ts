import type { CaptureDraft } from '../capture/draft';
import { hasOnlyKeys, isContentContextMessage, isPopupStageDraftMessage, isProtocolError, isRecord, type UnknownRecord } from './validation';

export const PROTOCOL_VERSION = 1 as const;

export interface ContentContext {
  readonly selectionText?: string;
  readonly title: string;
  readonly url: string;
}

export interface PopupStageDraftMessage {
  readonly draft: CaptureDraft;
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: 'popup.stage-draft';
}

export interface ContentContextMessage {
  readonly context: ContentContext;
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: 'content-context';
}

export type WorkerIncomingMessage = PopupStageDraftMessage | ContentContextMessage;

export interface ContentContextRequest {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: 'content-context.request';
}

export interface CaptureDraftStaged {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: 'capture-draft.staged';
}

export interface ContentContextAccepted {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: 'content-context.accepted';
}

export type ProtocolErrorCode = 'invalid-message' | 'queue-unavailable' | 'unexpected-sender' | 'unknown-message' | 'unsupported-protocol-version';

export interface ProtocolError {
  readonly code: ProtocolErrorCode;
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: 'protocol.error';
}

export type WorkerReply = CaptureDraftStaged | ContentContextAccepted | ProtocolError;
export type ContentScriptReply = ContentContextMessage | ProtocolError;

export interface RuntimeSender {
  readonly id?: string | undefined;
  readonly tab?: { readonly id?: number | undefined } | undefined;
}

export function createPopupStageMessage(draft: CaptureDraft): PopupStageDraftMessage {
  return { draft, protocolVersion: PROTOCOL_VERSION, type: 'popup.stage-draft' };
}

export function createContentContextMessage(context: ContentContext): ContentContextMessage {
  return { context, protocolVersion: PROTOCOL_VERSION, type: 'content-context' };
}

export function createContentContextRequest(): ContentContextRequest {
  return { protocolVersion: PROTOCOL_VERSION, type: 'content-context.request' };
}

export function handleWorkerMessage(rawMessage: unknown, context: WorkerMessageContext): WorkerReply {
  const decoded = decodeWorkerIncomingMessage(rawMessage);
  if (!decoded.ok) {
    return protocolError(decoded.code);
  }

  if (!isExpectedSender(decoded.value, context)) {
    return protocolError('unexpected-sender');
  }

  switch (decoded.value.type) {
    case 'content-context':
      return { protocolVersion: PROTOCOL_VERSION, type: 'content-context.accepted' };
    case 'popup.stage-draft':
      return { protocolVersion: PROTOCOL_VERSION, type: 'capture-draft.staged' };
    default:
      return assertNever(decoded.value);
  }
}

export function decodeContentScriptRequest(rawMessage: unknown): ContentContextRequest | ProtocolError {
  const header = decodeHeader(rawMessage);
  if (!header.ok) {
    return protocolError(header.code);
  }
  if (header.value.type !== 'content-context.request' || !hasOnlyKeys(header.value.record, ['protocolVersion', 'type'])) {
    return protocolError(header.value.type === 'content-context.request' ? 'invalid-message' : 'unknown-message');
  }
  return { protocolVersion: PROTOCOL_VERSION, type: 'content-context.request' };
}

export function decodePopupReply(rawMessage: unknown): CaptureDraftStaged | ProtocolError {
  const reply = decodeWorkerReply(rawMessage);
  if (!reply.ok) {
    return protocolError(reply.code);
  }
  switch (reply.value.type) {
    case 'capture-draft.staged':
    case 'protocol.error':
      return reply.value;
    case 'content-context.accepted':
      return protocolError('invalid-message');
    default:
      return assertNever(reply.value);
  }
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled protocol message: ${JSON.stringify(value)}`);
}

function decodeWorkerIncomingMessage(rawMessage: unknown): DecodeResult<WorkerIncomingMessage> {
  const header = decodeHeader(rawMessage);
  if (!header.ok) {
    return header;
  }

  switch (header.value.type) {
    case 'content-context':
      return isContentContextMessage(header.value.record) ? success(header.value.record) : failure('invalid-message');
    case 'popup.stage-draft':
      return isPopupStageDraftMessage(header.value.record) ? success(header.value.record) : failure('invalid-message');
    default:
      return failure('unknown-message');
  }
}

function decodeWorkerReply(rawMessage: unknown): DecodeResult<WorkerReply> {
  const header = decodeHeader(rawMessage);
  if (!header.ok) {
    return header;
  }

  switch (header.value.type) {
    case 'capture-draft.staged':
      return hasOnlyKeys(header.value.record, ['protocolVersion', 'type'])
        ? success({ protocolVersion: PROTOCOL_VERSION, type: 'capture-draft.staged' })
        : failure('invalid-message');
    case 'content-context.accepted':
      return hasOnlyKeys(header.value.record, ['protocolVersion', 'type'])
        ? success({ protocolVersion: PROTOCOL_VERSION, type: 'content-context.accepted' })
        : failure('invalid-message');
    case 'protocol.error':
      return isProtocolError(header.value.record) ? success(header.value.record) : failure('invalid-message');
    default:
      return failure('unknown-message');
  }
}

function decodeHeader(rawMessage: unknown): DecodeResult<{ readonly record: UnknownRecord; readonly type: string }> {
  if (!isRecord(rawMessage) || !('protocolVersion' in rawMessage) || !('type' in rawMessage)) {
    return failure('invalid-message');
  }
  if (rawMessage.protocolVersion !== PROTOCOL_VERSION) {
    return failure('unsupported-protocol-version');
  }
  if (typeof rawMessage.type !== 'string') {
    return failure('invalid-message');
  }
  return success({ record: rawMessage, type: rawMessage.type });
}

function isExpectedSender(message: WorkerIncomingMessage, context: WorkerMessageContext): boolean {
  if (context.sender.id !== context.extensionId) {
    return false;
  }
  return message.type === 'content-context'
    ? context.sender.tab?.id !== undefined
    : context.sender.tab === undefined;
}

function protocolError(code: ProtocolErrorCode): ProtocolError {
  return { code, protocolVersion: PROTOCOL_VERSION, type: 'protocol.error' };
}

type DecodeResult<T> = { readonly ok: true; readonly value: T } | { readonly code: ProtocolErrorCode; readonly ok: false };

export interface WorkerMessageContext {
  readonly extensionId: string;
  readonly sender: RuntimeSender;
}

function success<T>(value: T): DecodeResult<T> {
  return { ok: true, value };
}

function failure(code: ProtocolErrorCode): DecodeResult<never> {
  return { code, ok: false };
}
