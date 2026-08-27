import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface ActionIntent {
  readonly accountRef: string;
  readonly confirmationEvidenceRef: string;
  readonly idempotencyKey: string;
  readonly mode: 'star';
  readonly target: {
    readonly canonicalUrl: string;
    readonly githubRepositoryNumericId: number;
    readonly repositoryFullName: string;
  };
}

interface Client {
  action?(request: { readonly accessToken: string; readonly intent: ActionIntent }): Promise<unknown>;
}

interface ActionApi {
  createGithubRepositoryClient(options: { readonly endpoint: string; readonly fetch: typeof fetch }): Client;
  projectGithubActionResult?(result: unknown): unknown;
}

async function loadApi(): Promise<ActionApi> {
  return (await import(new URL('../src/capture/platform-client.ts', import.meta.url).href)) as ActionApi;
}

// Canonical source: ratatoskr-contracts/fixtures/github/repository-action-result/valid/partial.json
const partialFixture: unknown = JSON.parse(readFileSync(new URL('./fixtures/github-repository-action-partial.json', import.meta.url), 'utf8'));

const intent: ActionIntent = {
  accountRef: 'github-account:018f0000-0000-7000-8000-000000000604',
  confirmationEvidenceRef: 'browser-extension-confirmation:confirm-star-1',
  idempotencyKey: 'browser-extension-github-action:star-1',
  mode: 'star',
  target: {
    canonicalUrl: 'https://github.com/owner/repository',
    githubRepositoryNumericId: 42,
    repositoryFullName: 'owner/repository',
  },
};

describe('GitHub action outcomes', () => {
  it('submits the exact confirmed contract request', async () => {
    const { createGithubRepositoryClient } = await loadApi();
    const requests: Request[] = [];
    const client = createGithubRepositoryClient({
      endpoint: 'https://ratatoskr.example',
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(JSON.stringify(partialFixture), { status: 200 });
      },
    });
    expect(client.action).toBeTypeOf('function');

    await expect(client.action?.({ accessToken: 'device-token', intent })).resolves.toMatchObject({ aggregate: 'partial' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('https://ratatoskr.example/v1/gh/repositories/actions');
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer device-token');
    expect(await requests[0]?.clone().json()).toEqual({
      account_ref: intent.accountRef,
      confirmation_evidence_ref: intent.confirmationEvidenceRef,
      idempotency_key: intent.idempotencyKey,
      mode: 'star',
      target: {
        canonical_url: intent.target.canonicalUrl,
        github_repository_numeric_id: intent.target.githubRepositoryNumericId,
        repository_full_name: intent.target.repositoryFullName,
      },
    });
    expect(await requests[0]?.text()).not.toContain('device-token');
  });

  it('preserves a partial star and backup result', async () => {
    const { createGithubRepositoryClient, projectGithubActionResult } = await loadApi();
    expect(projectGithubActionResult).toBeTypeOf('function');
    const client = createGithubRepositoryClient({
      endpoint: 'https://ratatoskr.example',
      fetch: async () => new Response(JSON.stringify(partialFixture), { status: 200 }),
    });
    const result = await client.action?.({ accessToken: 'device-token', intent });

    expect(result).toEqual({
      aggregate: 'partial',
      desiredBackup: { reason: 'dependency_unavailable', status: 'failed' },
      metadata: { status: 'succeeded' },
      providerStar: { status: 'succeeded' },
    });
    expect(projectGithubActionResult?.(result)).toEqual({
      aggregate: 'partial',
      rows: [
        { component: 'metadata', status: 'succeeded' },
        { component: 'provider_star', status: 'succeeded' },
        { component: 'desired_backup', reason: 'dependency_unavailable', status: 'failed' },
      ],
    });

    const invalidClient = createGithubRepositoryClient({
      endpoint: 'https://ratatoskr.example',
      fetch: async () => new Response(JSON.stringify({ ...(partialFixture as object), aggregate: 'succeeded' }), { status: 200 }),
    });
    await expect(invalidClient.action?.({ accessToken: 'device-token', intent })).rejects.toThrow('invalid');
  });
});
