import { describe, expect, it } from 'vitest';

type SocialProvider = 'x' | 'instagram' | 'threads';

interface RoutingApi {
  classifySocialCapture?(url: string): { readonly provider: SocialProvider } | undefined;
}

async function loadApi(): Promise<RoutingApi> {
  return (await import(new URL('../src/capture/draft.ts', import.meta.url).href)) as RoutingApi;
}

describe('social capture routing', () => {
  it('classifies only supported public post permalinks', async () => {
    const { classifySocialCapture } = await loadApi();
    expect(classifySocialCapture).toBeTypeOf('function');

    const rows: readonly { readonly expected?: SocialProvider; readonly url: string }[] = [
      { expected: 'x', url: 'https://x.com/ratatoskr/status/1234567890123456789' },
      { expected: 'instagram', url: 'https://www.instagram.com/p/Cr8QwZqO2wG/' },
      { expected: 'threads', url: 'https://www.threads.net/@ratatoskr/post/Cx1AbcDefGh' },
      { url: 'https://example.test/articles/social-capture' },
      { url: 'https://x.com/ratatoskr' },
      { url: 'https://instagram.com/ratatoskr/' },
      { url: 'https://threads.net/@ratatoskr' },
      { url: 'https://x.com.evil.test/ratatoskr/status/1234567890123456789' },
      { url: 'https://x.com/ratatoskr/lists/123' },
    ];

    for (const row of rows) {
      expect(classifySocialCapture?.(row.url)?.provider, row.url).toBe(row.expected);
    }
  });
});
