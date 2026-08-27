import { describe, expect, it } from 'vitest';

type Mode = 'metadata' | 'track' | 'star';

interface Preview {
  readonly accountRef?: string;
  readonly availableActions: readonly Mode[];
  readonly stargazerCount: number;
  readonly target: {
    readonly canonicalUrl: string;
    readonly githubRepositoryNumericId: number;
    readonly repositoryFullName: string;
  };
}

interface ActionFlow {
  cancel(selection: unknown): void;
  confirm(selection: unknown, currentPreview: Preview): unknown;
  select(preview: Preview, mode: Mode): unknown;
}

interface ConfirmationApi {
  createGithubActionFlow?(options: {
    readonly createConfirmationEvidenceRef: () => string;
    readonly createIdempotencyKey: () => string;
  }): ActionFlow;
}

async function loadApi(): Promise<ConfirmationApi> {
  return (await import(new URL('../src/capture/platform-client.ts', import.meta.url).href)) as ConfirmationApi;
}

const preview: Preview = {
  accountRef: 'github-account:018f0000-0000-7000-8000-000000000604',
  availableActions: ['metadata', 'track', 'star'],
  stargazerCount: 123,
  target: {
    canonicalUrl: 'https://github.com/owner/repository',
    githubRepositoryNumericId: 42,
    repositoryFullName: 'owner/repository',
  },
};

describe('GitHub action confirmation', () => {
  it('cancellation emits no track action', async () => {
    const { createGithubActionFlow } = await loadApi();
    expect(createGithubActionFlow).toBeTypeOf('function');
    let evidenceCalls = 0;
    const flow = createGithubActionFlow?.({
      createConfirmationEvidenceRef: () => `browser-extension-confirmation:${++evidenceCalls}`,
      createIdempotencyKey: () => 'github-action:track-1',
    });
    const selection = flow?.select(preview, 'track');

    expect(selection).toMatchObject({
      mode: 'track',
      prompt: { effect: 'Request backup tracking in Ratatoskr.', repositoryFullName: 'owner/repository' },
      status: 'confirmation-required',
    });
    flow?.cancel(selection);
    expect(flow?.confirm(selection, preview)).toBeUndefined();
    expect(evidenceCalls).toBe(0);
  });

  it('star confirmation is target and account bound', async () => {
    const { createGithubActionFlow } = await loadApi();
    expect(createGithubActionFlow).toBeTypeOf('function');
    const flow = createGithubActionFlow?.({
      createConfirmationEvidenceRef: () => 'browser-extension-confirmation:confirm-star-1',
      createIdempotencyKey: () => 'github-action:star-1',
    });
    const selection = flow?.select(preview, 'star');

    expect(selection).toMatchObject({
      mode: 'star',
      prompt: {
        accountRef: preview.accountRef,
        effect: 'Star this repository on GitHub. This is an external write.',
        repositoryFullName: 'owner/repository',
      },
      status: 'confirmation-required',
    });
    expect(flow?.confirm(selection, { ...preview, target: { ...preview.target, githubRepositoryNumericId: 43 } })).toBeUndefined();
    expect(flow?.confirm(selection, preview)).toEqual({
      accountRef: preview.accountRef,
      confirmationEvidenceRef: 'browser-extension-confirmation:confirm-star-1',
      idempotencyKey: 'github-action:star-1',
      mode: 'star',
      target: preview.target,
    });
    expect(flow?.confirm(selection, preview)).toBeUndefined();
  });

  it('unadvertised star cannot be confirmed', async () => {
    const { createGithubActionFlow } = await loadApi();
    expect(createGithubActionFlow).toBeTypeOf('function');
    const flow = createGithubActionFlow?.({
      createConfirmationEvidenceRef: () => 'browser-extension-confirmation:unexpected',
      createIdempotencyKey: () => 'github-action:unexpected',
    });

    expect(flow?.select({
      availableActions: ['metadata', 'track'],
      stargazerCount: preview.stargazerCount,
      target: preview.target,
    }, 'star'))
      .toEqual({ status: 'unavailable' });
  });
});
