import { classifyGithubRepository } from '../capture/draft';

export type RepositoryActionMode = 'metadata' | 'track' | 'star';

export interface GitHubRepositoryTarget {
  readonly canonicalUrl: string;
  readonly githubRepositoryNumericId: number;
  readonly repositoryFullName: string;
}

export interface GitHubRepositoryPreview {
  readonly accountRef?: string;
  readonly availableActions: readonly RepositoryActionMode[];
  readonly description?: string;
  readonly primaryLanguage?: string;
  readonly stargazerCount: number;
  readonly target: GitHubRepositoryTarget;
}

export function githubCapabilities(value: unknown): readonly RepositoryActionMode[] | undefined {
  if (!isCapabilityRoot(value)) return undefined;
  const service = value.services.find((candidate) => isRecord(candidate) && candidate.service === 'github');
  if (!isCurrentGithubService(service) || !isGithubCapabilityDocument(service.document)) return undefined;
  return service.document.repository_actions;
}

export function repositoryPreview(value: unknown, capabilities: readonly RepositoryActionMode[]): GitHubRepositoryPreview | undefined {
  const preview = validatedWirePreview(value);
  if (preview === undefined) return undefined;
  const availableActions = preview.available_actions.filter((action) => capabilities.includes(action));
  return {
    ...(typeof preview.account_ref === 'string' ? { accountRef: preview.account_ref } : {}),
    availableActions,
    ...(typeof preview.description === 'string' ? { description: preview.description } : {}),
    ...(typeof preview.primary_language === 'string' ? { primaryLanguage: preview.primary_language } : {}),
    stargazerCount: preview.stargazer_count,
    target: {
      canonicalUrl: preview.target.canonical_url,
      githubRepositoryNumericId: preview.target.github_repository_numeric_id,
      repositoryFullName: preview.target.repository_full_name,
    },
  };
}

export function isGithubRepositoryPreview(value: unknown): value is GitHubRepositoryPreview {
  if (!isRecord(value) || !hasInternalPreviewKeys(value) || !isInternalTarget(value.target)) return false;
  return [
    isActionList(value.availableActions),
    isNonNegativeInteger(value.stargazerCount),
    isOptionalAccount(value.accountRef),
    isOptionalDescription(value.description),
    isOptionalLanguage(value.primaryLanguage),
  ].every(Boolean);
}

interface WirePreview {
  readonly account_ref?: unknown;
  readonly available_actions: RepositoryActionMode[];
  readonly description?: unknown;
  readonly primary_language?: unknown;
  readonly stargazer_count: number;
  readonly target: { readonly canonical_url: string; readonly github_repository_numeric_id: number; readonly repository_full_name: string };
}

function validatedWirePreview(value: unknown): WirePreview | undefined {
  if (!isRecord(value) || !hasAllowedOptionalKeys(value) || !isWireTarget(value.target)) return undefined;
  const valid = [
    isNonNegativeInteger(value.stargazer_count),
    isActionList(value.available_actions),
    isOptionalAccount(value.account_ref),
    isOptionalDescription(value.description),
    isOptionalLanguage(value.primary_language),
  ].every(Boolean);
  return valid ? value as unknown as WirePreview : undefined;
}

function isCapabilityRoot(value: unknown): value is Record<string, unknown> & { readonly services: unknown[] } {
  if (!isRecord(value)) return false;
  return [
    hasOnlyKeys(value, ['api_version', 'capabilities', 'minimum_client_versions', 'services']),
    value.api_version === '1.0',
    Array.isArray(value.services),
  ].every(Boolean);
}

function isCurrentGithubService(value: unknown): value is Record<string, unknown> & { readonly document: unknown } {
  if (!isRecord(value)) return false;
  return [
    hasOnlyKeys(value, ['document', 'observed_at', 'service', 'stale', 'stale_since']),
    value.service === 'github',
    value.stale === false,
    typeof value.observed_at === 'string',
  ].every(Boolean);
}

function isGithubCapabilityDocument(value: unknown): value is Record<string, unknown> & { readonly repository_actions: RepositoryActionMode[] } {
  if (!isRecord(value)) return false;
  return [
    hasOnlyKeys(value, ['repository_actions', 'repository_preview']),
    value.repository_preview === true,
    isActionList(value.repository_actions),
  ].every(Boolean);
}

function isWireTarget(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['canonical_url', 'github_repository_numeric_id', 'repository_full_name'])) return false;
  return [isCanonicalUrl(value.canonical_url), isPositiveInteger(value.github_repository_numeric_id), isFullName(value.repository_full_name)].every(Boolean);
}

function isInternalTarget(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['canonicalUrl', 'githubRepositoryNumericId', 'repositoryFullName'])) return false;
  return [isCanonicalUrl(value.canonicalUrl), isPositiveInteger(value.githubRepositoryNumericId), isFullName(value.repositoryFullName)].every(Boolean);
}

function hasInternalPreviewKeys(value: Record<string, unknown>): boolean {
  return hasOnlyAllowedKeys(value, ['accountRef', 'availableActions', 'description', 'primaryLanguage', 'stargazerCount', 'target'])
    && ['availableActions', 'stargazerCount', 'target'].every((key) => key in value);
}

function hasAllowedOptionalKeys(value: Record<string, unknown>): boolean {
  return hasOnlyAllowedKeys(value, ['account_ref', 'available_actions', 'description', 'primary_language', 'stargazer_count', 'target'])
    && ['available_actions', 'stargazer_count', 'target'].every((key) => key in value);
}

function isActionList(value: unknown): value is RepositoryActionMode[] {
  return Array.isArray(value) && value.length <= 3 && new Set(value).size === value.length
    && value.every((action) => action === 'metadata' || action === 'track' || action === 'star');
}

function isCanonicalUrl(value: unknown): value is string {
  return typeof value === 'string' && classifyGithubRepository(value)?.previewUrl === value;
}

function isFullName(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(value);
}

function isOptionalAccount(value: unknown): boolean {
  return value === undefined || value === null
    || (typeof value === 'string' && /^github-account:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value));
}

function isOptionalDescription(value: unknown): boolean {
  return value === undefined || value === null
    || (typeof value === 'string' && value.length <= 1_024 && [...value].every(isDisplayCharacter));
}

function isDisplayCharacter(value: string): boolean {
  const code = value.charCodeAt(0);
  return code >= 32 && code !== 127;
}

function isOptionalLanguage(value: unknown): boolean {
  return value === undefined || value === null
    || (typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9+.# -]{0,63}$/.test(value));
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && hasOnlyAllowedKeys(value, keys);
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
