export type RepositoryActionAggregate = 'succeeded' | 'partial' | 'failed';
export type RepositoryActionStatus = 'succeeded' | 'already_applied' | 'accepted' | 'refused' | 'failed' | 'skipped';
export type RepositoryActionReason = 'not_authorized' | 'account_required' | 'account_selection_required' | 'scope_missing'
  | 'target_changed' | 'dependency_unavailable' | 'provider_unavailable' | 'outcome_unknown'
  | 'catalog_persistence_failed' | 'policy_publication_failed' | 'not_applicable' | 'prerequisite_failed';

export type RepositoryComponentOutcome =
  | { readonly status: 'succeeded' | 'already_applied' | 'accepted' }
  | { readonly reason: RepositoryActionReason; readonly status: 'refused' | 'failed' | 'skipped' };

export interface RepositoryActionResult {
  readonly aggregate: RepositoryActionAggregate;
  readonly desiredBackup: RepositoryComponentOutcome;
  readonly metadata: RepositoryComponentOutcome;
  readonly providerStar: RepositoryComponentOutcome;
}

export interface RepositoryActionPresentation {
  readonly aggregate: RepositoryActionAggregate;
  readonly rows: readonly {
    readonly component: 'metadata' | 'provider_star' | 'desired_backup';
    readonly reason?: RepositoryActionReason;
    readonly status: RepositoryActionStatus;
  }[];
}

export function repositoryActionResult(value: unknown): RepositoryActionResult | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ['aggregate', 'desired_backup', 'metadata', 'provider_star'])
    || !isAggregate(value.aggregate)) return undefined;
  const metadata = component(value.metadata, 'metadata');
  const providerStar = component(value.provider_star, 'provider_star');
  const desiredBackup = component(value.desired_backup, 'desired_backup');
  if (metadata === undefined || providerStar === undefined || desiredBackup === undefined) return undefined;
  const result = { aggregate: value.aggregate, desiredBackup, metadata, providerStar };
  return deriveAggregate(result) === result.aggregate ? result : undefined;
}

export function isRepositoryActionResult(value: unknown): value is RepositoryActionResult {
  if (!isRecord(value) || !hasOnlyKeys(value, ['aggregate', 'desiredBackup', 'metadata', 'providerStar'])
    || !isAggregate(value.aggregate)) return false;
  const metadata = component(value.metadata, 'metadata');
  const providerStar = component(value.providerStar, 'provider_star');
  const desiredBackup = component(value.desiredBackup, 'desired_backup');
  return metadata !== undefined && providerStar !== undefined && desiredBackup !== undefined
    && deriveAggregate({ desiredBackup, metadata, providerStar }) === value.aggregate;
}

export function projectGithubActionResult(result: RepositoryActionResult): RepositoryActionPresentation {
  return {
    aggregate: result.aggregate,
    rows: [
      row('metadata', result.metadata),
      row('provider_star', result.providerStar),
      row('desired_backup', result.desiredBackup),
    ],
  };
}

function component(value: unknown, kind: 'metadata' | 'provider_star' | 'desired_backup'): RepositoryComponentOutcome | undefined {
  if (!isRecord(value) || typeof value.status !== 'string') return undefined;
  const positive = kind === 'desired_backup' ? ['accepted', 'already_applied'] : ['succeeded', 'already_applied'];
  if (positive.includes(value.status) && hasOnlyKeys(value, ['status'])) {
    return { status: value.status as 'succeeded' | 'already_applied' | 'accepted' };
  }
  if (!isNegativeComponent(value)) return undefined;
  return {
    reason: value.reason as RepositoryActionReason,
    status: value.status as 'refused' | 'failed' | 'skipped',
  };
}

function isNegativeComponent(value: Record<string, unknown>): boolean {
  return typeof value.status === 'string'
    && ['refused', 'failed', 'skipped'].includes(value.status)
    && hasOnlyKeys(value, ['reason', 'status'])
    && reasonMatches(value.status, value.reason);
}

function reasonMatches(status: string, reason: unknown): boolean {
  const reasons: Record<string, readonly string[]> = {
    failed: ['dependency_unavailable', 'provider_unavailable', 'outcome_unknown', 'catalog_persistence_failed', 'policy_publication_failed'],
    refused: ['not_authorized', 'account_required', 'account_selection_required', 'scope_missing', 'target_changed'],
    skipped: ['not_applicable', 'prerequisite_failed'],
  };
  return typeof reason === 'string' && reasons[status]?.includes(reason) === true;
}

function deriveAggregate(result: Omit<RepositoryActionResult, 'aggregate'>): RepositoryActionAggregate {
  const statuses = [result.metadata.status, result.providerStar.status, result.desiredBackup.status];
  const positive = statuses.some((status) => ['succeeded', 'already_applied', 'accepted'].includes(status));
  const negative = statuses.some((status) => status === 'refused' || status === 'failed');
  return positive ? negative ? 'partial' : 'succeeded' : 'failed';
}

function row(componentName: 'metadata' | 'provider_star' | 'desired_backup', outcome: RepositoryComponentOutcome) {
  return { component: componentName, ...('reason' in outcome ? { reason: outcome.reason } : {}), status: outcome.status };
}

function isAggregate(value: unknown): value is RepositoryActionAggregate {
  return value === 'succeeded' || value === 'partial' || value === 'failed';
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => allowed.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
