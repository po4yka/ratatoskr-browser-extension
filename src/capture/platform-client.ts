import { canonicalizeWireTimestamp } from '../protocol/wire-timestamp';
import type { SocialCaptureProvenance } from './draft';

export { createGithubRepositoryClient } from '../github/client';
export { createGithubActionFlow } from '../github/confirmation';
export { projectGithubActionResult } from '../github/action-result';

export type OperationStatus = 'accepted' | 'queued' | 'running' | 'succeeded' | 'partially_succeeded' | 'failed' | 'cancelled';

export type SocialOutcome =
  | { readonly kind: 'unavailable'; readonly reason: 'deleted' | 'unavailable' }
  | { readonly kind: 'partial'; readonly linkedArticle: 'extraction_failed'; readonly preservedPost: true };

export interface OperationSnapshot {
  readonly errors: readonly string[];
  readonly operationId: string;
  readonly progressPercent?: number;
  readonly results: readonly OperationResult[];
  readonly retryable: boolean;
  readonly socialOutcome?: SocialOutcome;
  readonly stage?: string;
  readonly status: OperationStatus;
  readonly statusChangedAt: string;
  readonly warnings: readonly string[];
}

export interface OperationResult {
  readonly resultKind: string;
  readonly target: string;
}

export interface PlatformCaptureClient {
  readOperation(request: AuthorizedOperationRequest): Promise<OperationSnapshot>;
  submit(request: CaptureSubmission): Promise<{ readonly operationId: string }>;
}

export interface CaptureSubmission {
  readonly accessToken: string;
  readonly idempotencyKey: string;
  readonly social?: SocialCaptureProvenance;
  readonly url: string;
}

export interface AuthorizedOperationRequest {
  readonly accessToken: string;
  readonly operationId: string;
}

export class PlatformCaptureError extends Error {
  constructor(readonly kind: 'authentication-required' | 'permanent' | 'retryable') {
    super('Platform capture request failed.');
  }
}

export function createPlatformCaptureClient(options: { readonly endpoint: string; readonly fetch: typeof fetch }): PlatformCaptureClient {
  return {
    readOperation: async (request) => readOperation(options, request),
    submit: async (request) => submit(options, request),
  };
}

async function submit(options: { readonly endpoint: string; readonly fetch: typeof fetch }, request: CaptureSubmission): Promise<{ readonly operationId: string }> {
  const response = await requestPlatform(options, {
    accessToken: request.accessToken,
    init: {
      body: JSON.stringify({ ...socialBody(request.social), url: request.url }),
      headers: { 'idempotency-key': request.idempotencyKey },
      method: 'POST',
    },
    path: '/v1/captures',
  });
  const body: unknown = await response.json();
  if (response.status !== 202 || !isAccepted(body)) {
    throw failure(response.status);
  }
  return { operationId: body.operation_id };
}

/**
 * The single wire edge for `captured_at`: a draft queued by an older build may hold a fraction with
 * trailing zeros, which Platform rejects permanently, so it is re-rendered canonically here.
 */
function socialBody(social: SocialCaptureProvenance | undefined): Record<string, unknown> {
  if (social === undefined) return {};
  const capturedAt = canonicalizeWireTimestamp(social.capturedAt);
  if (capturedAt === undefined) throw new PlatformCaptureError('permanent');
  return {
    social: {
      acquisition: social.acquisition,
      captured_at: capturedAt,
      provider: social.provider,
      saved_authority: social.savedAuthority,
    },
  };
}

async function readOperation(options: { readonly endpoint: string; readonly fetch: typeof fetch }, request: AuthorizedOperationRequest): Promise<OperationSnapshot> {
  const response = await requestPlatform(options, {
    accessToken: request.accessToken,
    init: { method: 'GET' },
    path: `/v1/operations/${encodeURIComponent(request.operationId)}`,
  });
  const body: unknown = await response.json();
  if (!response.ok || !isSnapshot(body)) {
    throw failure(response.status);
  }
  return toSnapshot(body);
}

function requestPlatform(options: { readonly endpoint: string; readonly fetch: typeof fetch }, request: { readonly accessToken: string; readonly init: RequestInit; readonly path: string }): Promise<Response> {
  return options.fetch(new URL(request.path, options.endpoint), {
    ...request.init,
    headers: { ...request.init.headers, authorization: `Bearer ${request.accessToken}`, 'content-type': 'application/json' },
    redirect: 'error',
  });
}

function isAccepted(value: unknown): value is { readonly operation_id: string; readonly status: 'accepted' } {
  return isRecord(value) && value.status === 'accepted' && isString(value.operation_id);
}

function isSnapshot(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && isString(value.operation_id) && isStatus(value.status) && isBoolean(value.retryable) && isString(value.status_changed_at);
}

function toSnapshot(value: Record<string, unknown>): OperationSnapshot {
  const snapshotErrors = errors(value.errors);
  const snapshotResults = results(value.results);
  const snapshotWarnings = warnings(value.warnings);
  return {
    errors: snapshotErrors,
    operationId: value.operation_id as string,
    ...(isNumber(value.progress_percent) ? { progressPercent: value.progress_percent } : {}),
    results: snapshotResults,
    retryable: value.retryable as boolean,
    ...socialOutcome({ errors: snapshotErrors, results: snapshotResults, status: value.status as OperationStatus, warnings: snapshotWarnings }),
    ...(isString(value.stage) ? { stage: value.stage } : {}),
    status: value.status as OperationStatus,
    statusChangedAt: value.status_changed_at as string,
    warnings: snapshotWarnings,
  };
}

function errors(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.flatMap((error) => isRecord(error) && isString(error.code) ? [error.code] : []) : [];
}

function results(value: unknown): readonly OperationResult[] {
  return Array.isArray(value) ? value.flatMap((entry) => isRecord(entry) && isString(entry.result_kind) && isString(entry.target) ? [{ resultKind: entry.result_kind, target: entry.target }] : []) : [];
}

function warnings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.flatMap((warning) => isString(warning) ? [warning] : isRecord(warning) && isString(warning.code) ? [warning.code] : []) : [];
}

function socialOutcome(snapshot: {
  readonly errors: readonly string[];
  readonly results: readonly OperationResult[];
  readonly status: OperationStatus;
  readonly warnings: readonly string[];
}): { readonly socialOutcome: SocialOutcome } | Record<never, never> {
  if (snapshot.status === 'failed') {
    if (snapshot.errors.includes('social.source.deleted')) {
      return { socialOutcome: { kind: 'unavailable', reason: 'deleted' } };
    }
    if (snapshot.errors.includes('social.source.unavailable')) {
      return { socialOutcome: { kind: 'unavailable', reason: 'unavailable' } };
    }
  }
  if (snapshot.status === 'partially_succeeded'
    && snapshot.results.some((result) => result.resultKind === 'social.post')
    && snapshot.warnings.includes('social.linked_article.extraction_failed')) {
    return {
      socialOutcome: {
        kind: 'partial',
        linkedArticle: 'extraction_failed',
        preservedPost: true,
      },
    };
  }
  return {};
}

function failure(status: number): PlatformCaptureError {
  return new PlatformCaptureError(status === 401 ? 'authentication-required' : status >= 500 || status === 429 ? 'retryable' : 'permanent');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isStatus(value: unknown): value is OperationStatus {
  return value === 'accepted' || value === 'queued' || value === 'running' || value === 'succeeded' || value === 'partially_succeeded' || value === 'failed' || value === 'cancelled';
}
