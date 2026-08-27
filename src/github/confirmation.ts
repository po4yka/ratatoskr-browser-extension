import type { GitHubRepositoryPreview, GitHubRepositoryTarget, RepositoryActionMode } from './preview';

export interface GitHubActionIntent {
  readonly accountRef?: string;
  readonly confirmationEvidenceRef: string;
  readonly idempotencyKey: string;
  readonly mode: RepositoryActionMode;
  readonly target: GitHubRepositoryTarget;
}

export interface ConfirmationSelection {
  readonly mode: 'track' | 'star';
  readonly preview: GitHubRepositoryPreview;
  readonly prompt: {
    readonly accountRef?: string;
    readonly effect: string;
    readonly repositoryFullName: string;
  };
  readonly status: 'confirmation-required';
}

export type GitHubActionSelection =
  | ConfirmationSelection
  | { readonly intent: GitHubActionIntent; readonly status: 'ready' }
  | { readonly status: 'unavailable' };

export interface GitHubActionFlow {
  cancel(selection: unknown): void;
  confirm(selection: unknown, currentPreview: GitHubRepositoryPreview): GitHubActionIntent | undefined;
  select(preview: GitHubRepositoryPreview, mode: RepositoryActionMode): GitHubActionSelection;
}

interface ActionIdentityFactory {
  readonly createConfirmationEvidenceRef: () => string;
  readonly createIdempotencyKey: () => string;
}

export function createGithubActionFlow(factory: ActionIdentityFactory): GitHubActionFlow {
  return new OneShotGitHubActionFlow(factory);
}

class OneShotGitHubActionFlow implements GitHubActionFlow {
  private readonly pending = new Set<ConfirmationSelection>();

  constructor(private readonly factory: ActionIdentityFactory) {}

  select(preview: GitHubRepositoryPreview, mode: RepositoryActionMode): GitHubActionSelection {
    if (!preview.availableActions.includes(mode) || (mode === 'star' && preview.accountRef === undefined)) {
      return { status: 'unavailable' };
    }
    if (mode === 'metadata') {
      return { intent: this.intent(preview, mode), status: 'ready' };
    }
    const selection: ConfirmationSelection = {
      mode,
      preview,
      prompt: {
        ...(mode === 'star' ? { accountRef: preview.accountRef } : {}),
        effect: mode === 'star'
          ? 'Star this repository on GitHub. This is an external write.'
          : 'Request backup tracking in Ratatoskr.',
        repositoryFullName: preview.target.repositoryFullName,
      },
      status: 'confirmation-required',
    };
    this.pending.add(selection);
    return selection;
  }

  cancel(selection: unknown): void {
    if (isConfirmation(selection)) this.pending.delete(selection);
  }

  confirm(selection: unknown, currentPreview: GitHubRepositoryPreview): GitHubActionIntent | undefined {
    if (!isConfirmation(selection) || !this.pending.has(selection) || !matches(selection, currentPreview)) {
      return undefined;
    }
    this.pending.delete(selection);
    return this.intent(currentPreview, selection.mode);
  }

  private intent(preview: GitHubRepositoryPreview, mode: RepositoryActionMode): GitHubActionIntent {
    return {
      ...(mode === 'star' ? { accountRef: preview.accountRef } : {}),
      confirmationEvidenceRef: this.factory.createConfirmationEvidenceRef(),
      idempotencyKey: this.factory.createIdempotencyKey(),
      mode,
      target: preview.target,
    };
  }
}

function matches(selection: ConfirmationSelection, preview: GitHubRepositoryPreview): boolean {
  return preview.availableActions.includes(selection.mode)
    && preview.target.canonicalUrl === selection.preview.target.canonicalUrl
    && preview.target.githubRepositoryNumericId === selection.preview.target.githubRepositoryNumericId
    && preview.target.repositoryFullName === selection.preview.target.repositoryFullName
    && (selection.mode !== 'star' || preview.accountRef === selection.preview.accountRef);
}

function isConfirmation(value: unknown): value is ConfirmationSelection {
  return typeof value === 'object' && value !== null
    && (value as { readonly status?: unknown }).status === 'confirmation-required';
}
