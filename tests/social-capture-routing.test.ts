import { describe, expect, it } from 'vitest';

type SocialProvider = 'x' | 'instagram' | 'threads';

interface RoutingApi {
  classifySocialCapture?(url: string): { readonly provider: SocialProvider } | undefined;
  createDraft?(input: unknown): { readonly social?: { readonly provider: SocialProvider }; readonly url: string };
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
      { expected: 'threads', url: 'https://threads.net/@ratatoskr/post/Cx1AbcDefGh' },
      { expected: 'threads', url: 'https://www.threads.com/@ratatoskr/post/Cx1AbcDefGh' },
      { expected: 'threads', url: 'https://threads.com/@ratatoskr/post/Cx1AbcDefGh' },
      { expected: 'x', url: 'https://www.x.com/ratatoskr/status/1' },
      { expected: 'x', url: 'https://mobile.x.com/ratatoskr/status/1' },
      { expected: 'x', url: 'https://twitter.com/ratatoskr/status/1' },
      { expected: 'x', url: 'https://www.twitter.com/ratatoskr/status/1' },
      { expected: 'x', url: 'https://mobile.twitter.com/ratatoskr/status/1' },
      { url: 'https://example.test/articles/social-capture' },
      { url: 'https://x.com/ratatoskr' },
      { url: 'https://instagram.com/ratatoskr/' },
      { url: 'https://threads.net/@ratatoskr' },
      { url: 'https://threads.com/@ratatoskr' },
      { url: 'https://threads.com.evil.example/@ratatoskr/post/Cx1AbcDefGh' },
      { url: 'https://nottwitter.com/ratatoskr/status/1' },
      { url: 'https://twitter.com.evil.example/ratatoskr/status/1' },
      { url: 'http://x.com/ratatoskr/status/1' },
      { url: 'http://twitter.com/ratatoskr/status/1' },
      { url: 'http://threads.com/@ratatoskr/post/Cx1AbcDefGh' },
      { url: 'https://x.com.evil.test/ratatoskr/status/1234567890123456789' },
      { url: 'https://x.com/ratatoskr/lists/123' },
    ];

    for (const row of rows) {
      expect(classifySocialCapture?.(row.url)?.provider, row.url).toBe(row.expected);
    }
  });
});

const xHosts = ['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'];
const instagramHosts = ['instagram.com', 'www.instagram.com'];
const threadsHosts = ['threads.net', 'www.threads.net', 'threads.com', 'www.threads.com'];

const handle15 = 'a'.repeat(15);
const handle30 = 'h'.repeat(30);
const code64 = 'c'.repeat(64);
const code128 = 'p'.repeat(128);

interface GrammarCase {
  readonly name: string;
  readonly path: string;
  readonly provider: SocialProvider;
  readonly accepted: boolean;
}

// The expected list is the R3-15 grammar table written out as data, not derived from the
// implementation: X 1..19 digits, handle 1..15; Instagram p|reel|reels|tv with an optional
// username segment and a 1..64 shortcode; Threads handle 1..30, post code 1..128.
const grammarCases: readonly GrammarCase[] = [
  { name: 'x_accepts_a_19_digit_status_id', path: '/ratatoskr/status/1234567890123456789', provider: 'x', accepted: true },
  { name: 'x_refuses_20_digits', path: '/ratatoskr/status/12345678901234567890', provider: 'x', accepted: false },
  { name: 'x_accepts_a_15_character_handle', path: `/${handle15}/status/1`, provider: 'x', accepted: true },
  { name: 'x_refuses_a_16_character_handle', path: `/${handle15}a/status/1`, provider: 'x', accepted: false },
  { name: 'x_refuses_an_empty_status_id', path: '/ratatoskr/status/', provider: 'x', accepted: false },
  { name: 'instagram_accepts_p', path: '/p/Cr8QwZqO2wG/', provider: 'instagram', accepted: true },
  { name: 'instagram_accepts_reel', path: '/reel/Cr8QwZqO2wG', provider: 'instagram', accepted: true },
  { name: 'instagram_accepts_reels', path: '/reels/Cr8QwZqO2wG/', provider: 'instagram', accepted: true },
  { name: 'instagram_accepts_tv', path: '/tv/Cr8QwZqO2wG/', provider: 'instagram', accepted: true },
  { name: 'instagram_accepts_a_username_prefixed_path', path: '/ratatoskr/p/Cr8QwZqO2wG/', provider: 'instagram', accepted: true },
  { name: 'instagram_accepts_a_username_prefixed_reel', path: '/ratatoskr/reel/Cr8QwZqO2wG/', provider: 'instagram', accepted: true },
  { name: 'instagram_accepts_a_64_character_shortcode', path: `/p/${code64}/`, provider: 'instagram', accepted: true },
  { name: 'instagram_refuses_a_65_character_shortcode', path: `/p/${code64}c/`, provider: 'instagram', accepted: false },
  { name: 'instagram_refuses_an_empty_shortcode', path: '/p//', provider: 'instagram', accepted: false },
  { name: 'instagram_refuses_a_profile', path: '/ratatoskr/', provider: 'instagram', accepted: false },
  { name: 'threads_accepts_a_30_character_handle', path: `/@${handle30}/post/Cx1AbcDefGh`, provider: 'threads', accepted: true },
  { name: 'threads_refuses_a_31_character_handle', path: `/@${handle30}h/post/Cx1AbcDefGh`, provider: 'threads', accepted: false },
  { name: 'threads_accepts_a_128_character_post_code', path: `/@ratatoskr/post/${code128}`, provider: 'threads', accepted: true },
  { name: 'threads_refuses_a_129_character_post_code', path: `/@ratatoskr/post/${code128}p`, provider: 'threads', accepted: false },
  { name: 'threads_refuses_an_empty_code', path: '/@ratatoskr/post/', provider: 'threads', accepted: false },
];

const hostsByProvider: Readonly<Record<SocialProvider, readonly string[]>> = {
  instagram: instagramHosts,
  threads: threadsHosts,
  x: xHosts,
};

describe('social capture permalink grammar (R3-15)', () => {
  for (const grammarCase of grammarCases) {
    for (const host of hostsByProvider[grammarCase.provider]) {
      const url = `https://${host}${grammarCase.path}`;

      it(`${grammarCase.name} on ${host}`, async () => {
        const { classifySocialCapture } = await loadApi();
        expect(classifySocialCapture?.(url)?.provider, url).toBe(grammarCase.accepted ? grammarCase.provider : undefined);
      });

      it(`${grammarCase.accepted ? 'the_draft_carries_the_social_member_with_the_provider' : 'the_draft_is_a_plain_url_capture'}: ${grammarCase.name} on ${host}`, async () => {
        const { createDraft } = await loadApi();
        const draft = createDraft?.({ entryPoint: 'link-menu', linkUrl: url, tab: { title: 'Feed', url: 'https://example.test/feed' } });
        expect(draft?.url, url).toBe(url);
        if (grammarCase.accepted) {
          expect(draft?.social?.provider, url).toBe(grammarCase.provider);
        } else {
          expect(draft, url).not.toHaveProperty('social');
        }
      });
    }
  }
});
