import { classifyGithubRepository } from '../capture/draft';
import type { GitHubActionIntent } from './confirmation';

export function githubActionBody(value: unknown): object | undefined {
  const intent = actionIntent(value);
  if (intent === undefined) return undefined;
  return {
    ...(intent.mode === 'star' ? { account_ref: intent.accountRef } : {}),
    confirmation_evidence_ref: intent.confirmationEvidenceRef,
    idempotency_key: intent.idempotencyKey,
    mode: intent.mode,
    target: {
      canonical_url: intent.target.canonicalUrl,
      github_repository_numeric_id: intent.target.githubRepositoryNumericId,
      repository_full_name: intent.target.repositoryFullName,
    },
  };
}

export function isGithubActionIntent(value: unknown): value is GitHubActionIntent {
  return actionIntent(value) !== undefined;
}

function actionIntent(value: unknown): GitHubActionIntent | undefined {
  if (!isRecord(value) || !hasIntentKeys(value)) return undefined;
  if (!isMode(value.mode) || !hasIntentStrings(value)) return undefined;
  if (!isTarget(value.target) || !accountMatches(value.mode, value.accountRef)) return undefined;
  return value as unknown as GitHubActionIntent;
}

function hasIntentStrings(value: Record<string, unknown>): boolean {
  return typeof value.confirmationEvidenceRef === 'string'
    && isEvidenceRef(value.confirmationEvidenceRef)
    && typeof value.idempotencyKey === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._~:@+-]{0,127}$/.test(value.idempotencyKey);
}

function accountMatches(mode: GitHubActionIntent['mode'], value: unknown): boolean {
  return mode === 'star' ? isAccountRef(value) : value === undefined;
}

function hasIntentKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  const allowed = new Set(['accountRef', 'confirmationEvidenceRef', 'idempotencyKey', 'mode', 'target']);
  return keys.every((key) => allowed.has(key))
    && ['confirmationEvidenceRef', 'idempotencyKey', 'mode', 'target'].every((key) => key in value);
}

function isTarget(value: unknown): boolean {
  if (!isRecord(value) || !hasTargetKeys(value)) return false;
  return [
    typeof value.canonicalUrl === 'string' && classifyGithubRepository(value.canonicalUrl)?.previewUrl === value.canonicalUrl,
    typeof value.githubRepositoryNumericId === 'number' && Number.isSafeInteger(value.githubRepositoryNumericId) && value.githubRepositoryNumericId > 0,
    typeof value.repositoryFullName === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(value.repositoryFullName),
  ].every(Boolean);
}

function hasTargetKeys(value: Record<string, unknown>): boolean {
  const keys = ['canonicalUrl', 'githubRepositoryNumericId', 'repositoryFullName'];
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

function isMode(value: unknown): value is GitHubActionIntent['mode'] {
  return value === 'metadata' || value === 'track' || value === 'star';
}

function isAccountRef(value: unknown): value is string {
  return typeof value === 'string'
    && /^github-account:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
}

function isEvidenceRef(value: string): boolean {
  return value.length <= 161 && /^[a-z][a-z0-9_-]{0,31}:[A-Za-z0-9][A-Za-z0-9._~:@+-]{0,127}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
