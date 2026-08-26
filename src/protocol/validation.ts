import type { CaptureDraft } from '../capture/draft';
import type { ContentContext, ContentContextMessage, PopupStageDraftMessage, ProtocolError } from './messages';

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasOnlyKeys(record: UnknownRecord, keys: readonly string[]): boolean {
  return Object.keys(record).length === keys.length && hasAllowedKeys(record, keys);
}

export function hasAllowedKeys(record: UnknownRecord, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

export function isCaptureDraft(value: unknown): value is CaptureDraft {
  if (!isRecord(value) || !hasAllowedKeys(value, ['captureKind', 'entryPoint', 'selectionText', 'sourcePageUrl', 'title', 'url'])) {
    return false;
  }
  return hasValidDraftKind(value) && hasValidDraftStrings(value);
}

export function isContentContext(value: unknown): value is ContentContext {
  return isRecord(value)
    && hasAllowedKeys(value, ['selectionText', 'title', 'url'])
    && isString(value.title)
    && isString(value.url)
    && (value.selectionText === undefined || isString(value.selectionText));
}

export function isPopupStageDraftMessage(value: unknown): value is PopupStageDraftMessage {
  return isRecord(value) && hasOnlyKeys(value, ['draft', 'protocolVersion', 'type']) && isCaptureDraft(value.draft);
}

export function isContentContextMessage(value: unknown): value is ContentContextMessage {
  return isRecord(value) && hasOnlyKeys(value, ['context', 'protocolVersion', 'type']) && isContentContext(value.context);
}

export function isProtocolError(value: unknown): value is ProtocolError {
  return isRecord(value)
    && hasOnlyKeys(value, ['code', 'protocolVersion', 'type'])
    && isOneOf(value.code, ['invalid-message', 'unexpected-sender', 'unknown-message', 'unsupported-protocol-version']);
}

function hasValidDraftKind(value: UnknownRecord): boolean {
  return isOneOf(value.captureKind, ['link', 'page', 'selection'])
    && isOneOf(value.entryPoint, ['link-menu', 'page-menu', 'popup', 'selection-menu']);
}

function hasValidDraftStrings(value: UnknownRecord): boolean {
  return isString(value.sourcePageUrl)
    && isString(value.title)
    && isString(value.url)
    && (value.selectionText === undefined || isString(value.selectionText));
}

function isOneOf(value: unknown, values: readonly string[]): value is string {
  return typeof value === 'string' && values.includes(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
