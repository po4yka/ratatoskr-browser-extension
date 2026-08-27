import { classifyGithubRepository, classifySocialCapture, type CaptureDraft } from '../capture/draft';
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
  if (!isRecord(value) || !hasAllowedKeys(value, ['captureKind', 'entryPoint', 'github', 'selectionText', 'social', 'sourcePageUrl', 'title', 'url'])) {
    return false;
  }
  return hasValidDraftKind(value) && hasValidDraftStrings(value) && hasValidDraftGithub(value) && hasValidDraftSocial(value);
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
    && isOneOf(value.code, ['credential-access-denied', 'github-unavailable', 'invalid-message', 'queue-unavailable', 'unexpected-sender', 'unknown-message', 'unsupported-protocol-version']);
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

function hasValidDraftSocial(value: UnknownRecord): boolean {
  if (value.social === undefined) return true;
  if (!isRecord(value.social)
    || !hasOnlyKeys(value.social, ['acquisition', 'capturedAt', 'provider', 'savedAuthority'])) {
    return false;
  }
  const route = classifySocialCapture(value.url as string);
  return route?.provider === value.social.provider
    && value.social.acquisition === 'browser_extension'
    && value.social.savedAuthority === 'explicit_user_capture'
    && isCanonicalTimestamp(value.social.capturedAt);
}

function hasValidDraftGithub(value: UnknownRecord): boolean {
  const route = classifyGithubRepository(value.url as string);
  if (route === undefined) return value.github === undefined;
  return isRecord(value.github)
    && hasOnlyKeys(value.github, ['previewUrl'])
    && value.github.previewUrl === route.previewUrl;
}

function isCanonicalTimestamp(value: unknown): boolean {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)
    && !/\.0+Z$/.test(value);
}

function isOneOf(value: unknown, values: readonly string[]): value is string {
  return typeof value === 'string' && values.includes(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
