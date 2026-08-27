import { classifyGithubRepository } from '../capture/draft';
import { isGithubActionIntent } from '../github/action-request';
import { isRepositoryActionResult, type RepositoryActionResult } from '../github/action-result';
import type { GitHubActionIntent } from '../github/confirmation';
import { isGithubRepositoryPreview, type GitHubRepositoryPreview } from '../github/preview';
import { PROTOCOL_VERSION, type ProtocolError, type RuntimeSender } from './messages';
import { hasOnlyKeys, isRecord } from './validation';

export interface GitHubPreviewMessage {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly repositoryUrl: string;
  readonly type: 'github.repository.preview';
}

export interface GitHubActionMessage {
  readonly intent: GitHubActionIntent;
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly type: 'github.repository.action';
}

export type GitHubPreviewReply =
  | { readonly preview: GitHubRepositoryPreview; readonly protocolVersion: typeof PROTOCOL_VERSION; readonly status: 'available'; readonly type: 'github.repository.previewed' }
  | { readonly protocolVersion: typeof PROTOCOL_VERSION; readonly status: 'unavailable'; readonly type: 'github.repository.previewed' };

export interface GitHubActionReply {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly result: RepositoryActionResult;
  readonly type: 'github.repository.action-completed';
}

type GitHubIncomingMessage = GitHubPreviewMessage | GitHubActionMessage;

interface GitHubHandler {
  readonly accessToken: () => Promise<string>;
  readonly client: {
    action(request: { readonly accessToken: string; readonly intent: GitHubActionIntent }): Promise<RepositoryActionResult>;
    preview(request: { readonly accessToken: string; readonly repositoryUrl: string }): Promise<{ readonly preview: GitHubRepositoryPreview; readonly status: 'available' } | { readonly status: 'unavailable' }>;
  };
  readonly context: { readonly extensionId: string; readonly sender: RuntimeSender };
}

export function createGithubPreviewMessage(repositoryUrl: string): GitHubPreviewMessage {
  return { protocolVersion: PROTOCOL_VERSION, repositoryUrl, type: 'github.repository.preview' };
}

export function createGithubActionMessage(intent: GitHubActionIntent): GitHubActionMessage {
  return { intent, protocolVersion: PROTOCOL_VERSION, type: 'github.repository.action' };
}

export function isGithubMessageCandidate(value: unknown): boolean {
  return isRecord(value) && (value.type === 'github.repository.preview' || value.type === 'github.repository.action');
}

export async function handleGithubMessage(raw: unknown, handler: GitHubHandler): Promise<GitHubPreviewReply | GitHubActionReply | ProtocolError> {
  const message = decodeIncoming(raw);
  if (message === undefined) return protocolError('invalid-message');
  if (handler.context.sender.id !== handler.context.extensionId || handler.context.sender.tab !== undefined) {
    return protocolError('unexpected-sender');
  }
  const accessToken = await handler.accessToken();
  if (message.type === 'github.repository.preview') {
    const state = await handler.client.preview({ accessToken, repositoryUrl: message.repositoryUrl });
    return state.status === 'available'
      ? { preview: state.preview, protocolVersion: PROTOCOL_VERSION, status: 'available', type: 'github.repository.previewed' }
      : { protocolVersion: PROTOCOL_VERSION, status: 'unavailable', type: 'github.repository.previewed' };
  }
  const result = await handler.client.action({ accessToken, intent: message.intent });
  return isRepositoryActionResult(result)
    ? { protocolVersion: PROTOCOL_VERSION, result, type: 'github.repository.action-completed' }
    : protocolError('invalid-message');
}

export function decodeGithubPreviewReply(value: unknown): GitHubPreviewReply | ProtocolError {
  if (isProtocolError(value)) return value;
  return isGithubPreviewReply(value) ? value : protocolError('invalid-message');
}

export function decodeGithubActionReply(value: unknown): GitHubActionReply | ProtocolError {
  if (isProtocolError(value)) return value;
  return isGithubActionReply(value) ? value : protocolError('invalid-message');
}

function decodeIncoming(value: unknown): GitHubIncomingMessage | undefined {
  if (!isRecord(value) || value.protocolVersion !== PROTOCOL_VERSION) return undefined;
  if (isGithubPreviewMessage(value)) return value;
  if (isGithubActionMessage(value)) return value;
  return undefined;
}

function isGithubPreviewReply(value: unknown): value is GitHubPreviewReply {
  if (!isRecord(value) || value.protocolVersion !== PROTOCOL_VERSION || value.type !== 'github.repository.previewed') return false;
  if (value.status === 'unavailable') return hasOnlyKeys(value, ['protocolVersion', 'status', 'type']);
  return value.status === 'available'
    && hasOnlyKeys(value, ['preview', 'protocolVersion', 'status', 'type'])
    && isGithubRepositoryPreview(value.preview);
}

function isGithubActionReply(value: unknown): value is GitHubActionReply {
  if (!isRecord(value)) return false;
  return [
    hasOnlyKeys(value, ['protocolVersion', 'result', 'type']),
    value.protocolVersion === PROTOCOL_VERSION,
    value.type === 'github.repository.action-completed',
    isRepositoryActionResult(value.result),
  ].every(Boolean);
}

function isGithubPreviewMessage(value: Record<string, unknown>): value is Record<string, unknown> & GitHubPreviewMessage {
  return hasOnlyKeys(value, ['protocolVersion', 'repositoryUrl', 'type'])
    && value.type === 'github.repository.preview'
    && typeof value.repositoryUrl === 'string'
    && classifyGithubRepository(value.repositoryUrl)?.previewUrl === value.repositoryUrl;
}

function isGithubActionMessage(value: Record<string, unknown>): value is Record<string, unknown> & GitHubActionMessage {
  return hasOnlyKeys(value, ['intent', 'protocolVersion', 'type'])
    && value.type === 'github.repository.action'
    && isGithubActionIntent(value.intent);
}

function isProtocolError(value: unknown): value is ProtocolError {
  return isRecord(value) && hasOnlyKeys(value, ['code', 'protocolVersion', 'type'])
    && value.protocolVersion === PROTOCOL_VERSION && value.type === 'protocol.error'
    && ['github-unavailable', 'invalid-message', 'unexpected-sender'].includes(String(value.code));
}

function protocolError(code: ProtocolError['code']): ProtocolError {
  return { code, protocolVersion: PROTOCOL_VERSION, type: 'protocol.error' };
}
