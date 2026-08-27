import { describe, expect, it } from 'vitest';

interface SubmissionProtocolApi {
  createPopupSubmitMessage(draft: Draft, mode: 'quick' | 'tracked'): unknown;
  handleArticleSubmissionMessage(raw: unknown, handler: Handler): Promise<unknown>;
}

interface Draft {
  readonly captureKind: 'page';
  readonly entryPoint: 'popup';
  readonly sourcePageUrl: string;
  readonly title: string;
  readonly url: string;
}

interface Handler {
  readonly context: { readonly extensionId: string; readonly sender: { readonly id: string; readonly tab?: undefined } };
  readonly queue: { enqueue(draft: Draft, mode: 'quick' | 'tracked'): Promise<{ readonly id: string; readonly mode?: 'quick' | 'tracked'; readonly status: 'queued' }> };
}

async function loadApi(): Promise<SubmissionProtocolApi> {
  return (await import(new URL('../src/protocol/article-submission.ts', import.meta.url).href)) as SubmissionProtocolApi;
}

const draft: Draft = {
  captureKind: 'page',
  entryPoint: 'popup',
  sourcePageUrl: 'https://example.test/article',
  title: 'Private title stays local',
  url: 'https://example.test/article',
};

describe('article submission protocol', () => {
  it('queues an explicit tracked save through a fake API harness without echoing draft content', async () => {
    const { createPopupSubmitMessage, handleArticleSubmissionMessage } = await loadApi();
    const calls: unknown[] = [];
    const reply = await handleArticleSubmissionMessage(createPopupSubmitMessage(draft, 'tracked'), {
      context: { extensionId: 'extension-1', sender: { id: 'extension-1' } },
      queue: {
        enqueue: async (received, mode) => {
          calls.push({ received, mode });
          return { id: 'capture-1', mode, status: 'queued' };
        },
      },
    });

    expect(calls).toEqual([{ received: draft, mode: 'tracked' }]);
    expect(reply).toEqual({ captureId: 'capture-1', mode: 'tracked', protocolVersion: 1, status: 'queued', type: 'capture.queued' });
    expect(JSON.stringify(reply)).not.toContain('Private title');
  });
});
