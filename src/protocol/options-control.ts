import type { Diagnostics } from '../options/diagnostics';
import type { CaptureMode, CapturePreferences, SafeOptionsState } from '../options/state';
import { PROTOCOL_VERSION, type ProtocolError, type RuntimeSender } from './messages';
import { hasOnlyKeys, isRecord } from './validation';

type OptionsRequest =
  | { readonly protocolVersion: 1; readonly type: 'options.state.read' }
  | { readonly defaultCaptureMode: CaptureMode; readonly protocolVersion: 1; readonly type: 'options.preference.set' }
  | { readonly protocolVersion: 1; readonly type: 'options.device.revoke' }
  | { readonly protocolVersion: 1; readonly type: 'options.data.clear' }
  | { readonly includeUrls: boolean; readonly protocolVersion: 1; readonly type: 'options.diagnostics.export' }
  | { readonly protocolVersion: 1; readonly type: 'popup.preference.read' };

export type OptionsReply =
  | { readonly protocolVersion: 1; readonly state: SafeOptionsState; readonly type: 'options.state' }
  | { readonly preference: CapturePreferences; readonly protocolVersion: 1; readonly type: 'capture.preference' }
  | { readonly protocolVersion: 1; readonly status: 'saved'; readonly type: 'options.preference.result' }
  | { readonly protocolVersion: 1; readonly status: 'failed' | 'revoked' | 'unpaired'; readonly type: 'options.revoke.result' }
  | { readonly failedStep?: string; readonly protocolVersion: 1; readonly status: 'blocked' | 'cleared' | 'incomplete'; readonly type: 'options.clear.result' }
  | { readonly diagnostics: Diagnostics; readonly protocolVersion: 1; readonly type: 'options.diagnostics' }
  | ProtocolError;

export interface OptionsControlHandler {
  readonly clearAll: () => Promise<{ readonly failedStep?: string; readonly status: 'blocked' | 'cleared' | 'incomplete' }>;
  readonly context: { readonly extensionId: string; readonly sender: RuntimeSender };
  readonly diagnostics: (includeUrls: boolean) => Promise<Diagnostics>;
  readonly optionsPageUrl: string;
  readonly popupPageUrl: string;
  readonly readPreference: () => Promise<CapturePreferences>;
  readonly readState: () => Promise<SafeOptionsState>;
  readonly revoke: () => Promise<{ readonly status: 'failed' | 'revoked' | 'unpaired' }>;
  readonly savePreference: (value: CapturePreferences) => Promise<void>;
}

export function isOptionsControlCandidate(value: unknown): boolean {
  return isRecord(value) && typeof value.type === 'string'
    && (value.type.startsWith('options.') || value.type === 'popup.preference.read');
}

export async function handleOptionsControlMessage(raw: unknown, handler: OptionsControlHandler): Promise<OptionsReply> {
  const request = decodeRequest(raw);
  if (request === undefined) return protocolError('invalid-message');
  if (!trustedSender(request, handler)) return protocolError('unexpected-sender');
  return executeRequest(request, handler);
}

async function executeRequest(request: OptionsRequest, handler: OptionsControlHandler): Promise<OptionsReply> {
  switch (request.type) {
    case 'options.state.read':
      return { protocolVersion: PROTOCOL_VERSION, state: await handler.readState(), type: 'options.state' };
    case 'popup.preference.read':
      return { preference: await handler.readPreference(), protocolVersion: PROTOCOL_VERSION, type: 'capture.preference' };
    case 'options.preference.set':
      await handler.savePreference({ defaultCaptureMode: request.defaultCaptureMode });
      return { protocolVersion: PROTOCOL_VERSION, status: 'saved', type: 'options.preference.result' };
    case 'options.device.revoke':
      return { protocolVersion: PROTOCOL_VERSION, ...(await handler.revoke()), type: 'options.revoke.result' };
    case 'options.data.clear':
      return { protocolVersion: PROTOCOL_VERSION, ...(await handler.clearAll()), type: 'options.clear.result' };
    case 'options.diagnostics.export':
      return { diagnostics: await handler.diagnostics(request.includeUrls), protocolVersion: PROTOCOL_VERSION, type: 'options.diagnostics' };
  }
}

export function decodeOptionsReply(value: unknown): OptionsReply {
  return isRecord(value) && value.protocolVersion === PROTOCOL_VERSION && typeof value.type === 'string'
    ? value as unknown as OptionsReply
    : protocolError('invalid-message');
}

export const optionsMessages = {
  clear: (): OptionsRequest => ({ protocolVersion: PROTOCOL_VERSION, type: 'options.data.clear' }),
  diagnostics: (includeUrls: boolean): OptionsRequest => ({ includeUrls, protocolVersion: PROTOCOL_VERSION, type: 'options.diagnostics.export' }),
  preference: (defaultCaptureMode: CaptureMode): OptionsRequest => ({ defaultCaptureMode, protocolVersion: PROTOCOL_VERSION, type: 'options.preference.set' }),
  readPreference: (): OptionsRequest => ({ protocolVersion: PROTOCOL_VERSION, type: 'popup.preference.read' }),
  revoke: (): OptionsRequest => ({ protocolVersion: PROTOCOL_VERSION, type: 'options.device.revoke' }),
  state: (): OptionsRequest => ({ protocolVersion: PROTOCOL_VERSION, type: 'options.state.read' }),
};

function trustedSender(request: OptionsRequest, handler: OptionsControlHandler): boolean {
  if (handler.context.sender.id !== handler.context.extensionId || handler.context.sender.tab !== undefined) return false;
  const expected = request.type === 'popup.preference.read' ? handler.popupPageUrl : handler.optionsPageUrl;
  return handler.context.sender.url === expected;
}

function decodeRequest(value: unknown): OptionsRequest | undefined {
  if (!isRecord(value) || value.protocolVersion !== PROTOCOL_VERSION || typeof value.type !== 'string') return undefined;
  if (value.type === 'options.preference.set') return decodePreference(value);
  if (value.type === 'options.diagnostics.export') return decodeDiagnostics(value);
  const types = ['options.state.read', 'options.device.revoke', 'options.data.clear', 'popup.preference.read'];
  return types.includes(value.type) && hasOnlyKeys(value, ['protocolVersion', 'type']) ? value as unknown as OptionsRequest : undefined;
}

function decodePreference(value: Record<string, unknown>): OptionsRequest | undefined {
  return hasOnlyKeys(value, ['defaultCaptureMode', 'protocolVersion', 'type']) && (value.defaultCaptureMode === 'quick' || value.defaultCaptureMode === 'tracked')
    ? value as unknown as OptionsRequest : undefined;
}

function decodeDiagnostics(value: Record<string, unknown>): OptionsRequest | undefined {
  return hasOnlyKeys(value, ['includeUrls', 'protocolVersion', 'type']) && typeof value.includeUrls === 'boolean'
    ? value as unknown as OptionsRequest : undefined;
}

function protocolError(code: ProtocolError['code']): ProtocolError {
  return { code, protocolVersion: PROTOCOL_VERSION, type: 'protocol.error' };
}
