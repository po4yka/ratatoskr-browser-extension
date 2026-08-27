import { describe, expect, it } from 'vitest';

interface GitHubRepositoryIntent {
  readonly previewUrl: string;
}

interface Draft {
  readonly github?: GitHubRepositoryIntent;
  readonly url: string;
}

interface RoutingApi {
  classifyGithubRepository?(url: string): GitHubRepositoryIntent | undefined;
  createDraft(input: {
    readonly entryPoint: 'popup';
    readonly tab: { readonly title: string; readonly url: string };
  }): Draft;
}

async function loadApi(): Promise<RoutingApi> {
  return (await import(new URL('../src/capture/draft.ts', import.meta.url).href)) as RoutingApi;
}

describe('GitHub repository routing', () => {
  it('classifies only canonical GitHub repository roots', async () => {
    const { classifyGithubRepository, createDraft } = await loadApi();
    expect(classifyGithubRepository).toBeTypeOf('function');

    const rows: readonly { readonly previewUrl?: string; readonly url: string }[] = [
      { previewUrl: 'https://github.com/ratatoskr/browser-extension', url: 'https://github.com/ratatoskr/browser-extension' },
      { previewUrl: 'https://github.com/ratatoskr/browser-extension', url: 'https://github.com/ratatoskr/browser-extension/' },
      { url: 'http://github.com/ratatoskr/browser-extension' },
      { url: 'https://www.github.com/ratatoskr/browser-extension' },
      { url: 'https://github.com/ratatoskr/browser-extension/issues' },
      { url: 'https://github.com/ratatoskr/browser-extension?tab=readme' },
      { url: 'https://github.com/ratatoskr/browser-extension#readme' },
      { url: 'https://github.com.evil.test/ratatoskr/browser-extension' },
      { url: 'https://user@github.com/ratatoskr/browser-extension' },
      { url: 'https://github.com:8443/ratatoskr/browser-extension' },
    ];

    for (const row of rows) {
      expect(classifyGithubRepository?.(row.url)?.previewUrl, row.url).toBe(row.previewUrl);
    }

    const originalUrl = 'https://github.com/ratatoskr/browser-extension/';
    expect(createDraft({ entryPoint: 'popup', tab: { title: 'Repository', url: originalUrl } })).toMatchObject({
      github: { previewUrl: 'https://github.com/ratatoskr/browser-extension' },
      url: originalUrl,
    });
  });
});
