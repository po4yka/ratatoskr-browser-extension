import { describe, expect, it } from 'vitest';

interface OperationPanelApi {
  operationMessage(operation: SocialOperation): string;
  operationIsTerminal(status: SocialOperation['status']): boolean;
}

interface CaptureClientApi {
  createPlatformCaptureClient(options: { readonly endpoint: string; readonly fetch: typeof fetch }): {
    readOperation(request: { readonly accessToken: string; readonly operationId: string }): Promise<SocialSnapshot>;
  };
}

interface SocialSnapshot {
  readonly socialOutcome?: SocialOperation['socialOutcome'];
}

interface SocialOperation {
  readonly retryable: boolean;
  readonly socialOutcome:
    | { readonly kind: 'unavailable'; readonly reason: 'deleted' | 'unavailable' }
    | { readonly kind: 'partial'; readonly linkedArticle: 'extraction_failed'; readonly preservedPost: true };
  readonly status: 'failed' | 'partially_succeeded';
}

async function loadApi(): Promise<OperationPanelApi> {
  return (await import(new URL('../src/popup/operation-panel.ts', import.meta.url).href)) as OperationPanelApi;
}

async function loadCaptureClientApi(): Promise<CaptureClientApi> {
  return (await import(new URL('../src/capture/platform-client.ts', import.meta.url).href)) as CaptureClientApi;
}

describe('social operation outcomes', () => {
  it('accepts only the closed social outcome codes from a Platform snapshot', async () => {
    const { createPlatformCaptureClient } = await loadCaptureClientApi();
    const client = createPlatformCaptureClient({
      endpoint: 'https://ratatoskr.example',
      fetch: async () => new Response(JSON.stringify({
        operation_id: 'operation-social-1',
        results: [{ result_kind: 'social.post', target: 'social_source:post-1' }],
        retryable: false,
        status: 'partially_succeeded',
        status_changed_at: '2026-08-27T10:00:00Z',
        warnings: [{ code: 'social.linked_article.extraction_failed' }],
      }), { status: 200 }),
    });

    await expect(client.readOperation({ accessToken: 'device-token', operationId: 'operation-social-1' }))
      .resolves.toMatchObject({
        socialOutcome: {
          kind: 'partial',
          linkedArticle: 'extraction_failed',
          preservedPost: true,
        },
      });
  });

  it('renders deleted and unavailable social sources without false completion', async () => {
    const { operationIsTerminal, operationMessage } = await loadApi();
    const deleted: SocialOperation = {
      retryable: false,
      socialOutcome: { kind: 'unavailable', reason: 'deleted' },
      status: 'failed',
    };

    expect(operationIsTerminal(deleted.status)).toBe(true);
    expect(operationMessage(deleted)).toBe('unavailable — source deleted — retry is unavailable');
  });

  it('renders a preserved post and failed linked article as partial', async () => {
    const { operationIsTerminal, operationMessage } = await loadApi();
    const partial: SocialOperation = {
      retryable: true,
      socialOutcome: {
        kind: 'partial',
        linkedArticle: 'extraction_failed',
        preservedPost: true,
      },
      status: 'partially_succeeded',
    };

    expect(operationIsTerminal(partial.status)).toBe(true);
    expect(operationMessage(partial)).toBe('partial — social post preserved; linked article extraction failed');
  });
});
