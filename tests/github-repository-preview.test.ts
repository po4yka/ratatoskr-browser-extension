import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface GitHubClient {
  preview(request: { readonly accessToken: string; readonly repositoryUrl: string }): Promise<unknown>;
}

interface GitHubClientApi {
  createGithubRepositoryClient?(options: { readonly endpoint: string; readonly fetch: typeof fetch }): GitHubClient;
}

async function loadApi(): Promise<GitHubClientApi> {
  return (await import(new URL('../src/capture/platform-client.ts', import.meta.url).href)) as GitHubClientApi;
}

// Canonical source: ratatoskr-contracts/fixtures/github/repository-preview-response/valid/repository.json
const previewFixture: unknown = JSON.parse(readFileSync(new URL('./fixtures/github-repository-preview.json', import.meta.url), 'utf8'));

function capabilities(options: { readonly actions?: readonly string[]; readonly includeGithub?: boolean; readonly stale?: boolean } = {}): object {
  const includeGithub = options.includeGithub ?? true;
  return {
    api_version: '1.0',
    capabilities: ['content.submit'],
    minimum_client_versions: { mobile: '1.0', web: '1.0' },
    services: includeGithub ? [{
      document: {
        repository_actions: options.actions ?? ['metadata', 'track'],
        repository_preview: true,
      },
      observed_at: '2026-08-27T10:00:00Z',
      service: 'github',
      stale: options.stale ?? false,
      stale_since: options.stale === true ? '2026-08-27T10:01:00Z' : null,
    }] : [],
  };
}

describe('GitHub repository preview', () => {
  it('offers the contract preview only for a current GitHub capability', async () => {
    const { createGithubRepositoryClient } = await loadApi();
    expect(createGithubRepositoryClient).toBeTypeOf('function');
    const requests: Request[] = [];
    const client = createGithubRepositoryClient?.({
      endpoint: 'https://ratatoskr.example',
      fetch: async (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        return request.url.endsWith('/v1/capabilities')
          ? new Response(JSON.stringify(capabilities()), { status: 200 })
          : new Response(JSON.stringify(previewFixture), { status: 200 });
      },
    });

    await expect(client?.preview({ accessToken: 'device-token', repositoryUrl: 'https://github.com/owner/repository' })).resolves.toEqual({
      preview: {
        accountRef: 'github-account:018f0000-0000-7000-8000-000000000604',
        availableActions: ['metadata', 'track'],
        description: 'A small repository description.',
        primaryLanguage: 'Rust',
        stargazerCount: 123,
        target: {
          canonicalUrl: 'https://github.com/owner/repository',
          githubRepositoryNumericId: 42,
          repositoryFullName: 'owner/repository',
        },
      },
      status: 'available',
    });
    expect(requests.map((request) => request.url)).toEqual([
      'https://ratatoskr.example/v1/capabilities',
      'https://ratatoskr.example/v1/gh/repositories/preview',
    ]);
    expect(requests.every((request) => request.headers.get('authorization') === 'Bearer device-token')).toBe(true);
    expect(await requests[1]?.json()).toEqual({ repository_url: 'https://github.com/owner/repository' });
  });

  it('keeps a stale or absent GitHub service unavailable', async () => {
    const { createGithubRepositoryClient } = await loadApi();
    expect(createGithubRepositoryClient).toBeTypeOf('function');

    for (const document of [capabilities({ stale: true }), capabilities({ includeGithub: false })]) {
      let calls = 0;
      const client = createGithubRepositoryClient?.({
        endpoint: 'https://ratatoskr.example',
        fetch: async () => {
          calls += 1;
          return new Response(JSON.stringify(document), { status: 200 });
        },
      });
      await expect(client?.preview({ accessToken: 'device-token', repositoryUrl: 'https://github.com/owner/repository' }))
        .resolves.toEqual({ status: 'unavailable' });
      expect(calls).toBe(1);
    }
  });
});
