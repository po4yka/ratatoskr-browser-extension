export type OperationStatus = 'accepted' | 'queued' | 'running' | 'succeeded' | 'partially_succeeded' | 'failed' | 'cancelled';

export interface OperationSnapshot {
  readonly operationId: string;
  readonly progressPercent?: number;
  readonly results: readonly OperationResult[];
  readonly retryable: boolean;
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
    init: { body: JSON.stringify({ url: request.url }), headers: { 'idempotency-key': request.idempotencyKey }, method: 'POST' },
    path: '/v1/captures',
  });
  const body: unknown = await response.json();
  if (response.status !== 202 || !isAccepted(body)) {
    throw failure(response.status);
  }
  return { operationId: body.operation_id };
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
  return {
    operationId: value.operation_id as string,
    ...(isNumber(value.progress_percent) ? { progressPercent: value.progress_percent } : {}),
    results: results(value.results),
    retryable: value.retryable as boolean,
    ...(isString(value.stage) ? { stage: value.stage } : {}),
    status: value.status as OperationStatus,
    statusChangedAt: value.status_changed_at as string,
    warnings: warnings(value.warnings),
  };
}

function results(value: unknown): readonly OperationResult[] {
  return Array.isArray(value) ? value.flatMap((entry) => isRecord(entry) && isString(entry.result_kind) && isString(entry.target) ? [{ resultKind: entry.result_kind, target: entry.target }] : []) : [];
}

function warnings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.flatMap((warning) => isString(warning) ? [warning] : isRecord(warning) && isString(warning.code) ? [warning.code] : []) : [];
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
