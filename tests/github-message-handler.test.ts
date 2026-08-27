import { describe, expect, it } from 'vitest';

interface GitHubProtocolApi {
  createGithubActionMessage?(intent: object): unknown;
  createGithubPreviewMessage?(repositoryUrl: string): unknown;
  handleGithubMessage?(raw: unknown, handler: {
    readonly accessToken: () => Promise<string>;
    readonly client: {
      action(request: unknown): Promise<unknown>;
      preview(request: unknown): Promise<unknown>;
    };
    readonly context: { readonly extensionId: string; readonly sender: { readonly id?: string; readonly tab?: { readonly id?: number } } };
  }): Promise<unknown>;
}

async function loadApi(): Promise<GitHubProtocolApi> {
  return import(new URL('../src/protocol/github.ts', import.meta.url).href).catch(() => ({})) as Promise<GitHubProtocolApi>;
}

const intent = {
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

describe('GitHub worker message handler', () => {
  it('accepts closed preview and confirmed action messages only from an extension page', async () => {
    const { createGithubActionMessage, createGithubPreviewMessage, handleGithubMessage } = await loadApi();
    expect(createGithubPreviewMessage).toBeTypeOf('function');
    expect(createGithubActionMessage).toBeTypeOf('function');
    expect(handleGithubMessage).toBeTypeOf('function');
    const calls: unknown[] = [];
    const handler = {
      accessToken: async () => 'device-token',
      client: {
        action: async (request: unknown) => {
          calls.push(request);
          return {
            aggregate: 'partial',
            desiredBackup: { reason: 'dependency_unavailable', status: 'failed' },
            metadata: { status: 'succeeded' },
            providerStar: { status: 'succeeded' },
          };
        },
        preview: async (request: unknown) => {
          calls.push(request);
          return { status: 'unavailable' };
        },
      },
      context: { extensionId: 'extension-id', sender: { id: 'extension-id' } },
    };

    await expect(handleGithubMessage?.(createGithubPreviewMessage?.('https://github.com/owner/repository'), handler))
      .resolves.toEqual({ protocolVersion: 1, status: 'unavailable', type: 'github.repository.previewed' });
    await expect(handleGithubMessage?.(createGithubActionMessage?.(intent), handler)).resolves.toMatchObject({
      result: { aggregate: 'partial' },
      type: 'github.repository.action-completed',
    });
    expect(calls).toEqual([
      { accessToken: 'device-token', repositoryUrl: 'https://github.com/owner/repository' },
      { accessToken: 'device-token', intent },
    ]);
  });

  it('fails closed for a page sender and malformed confirmation evidence', async () => {
    const { createGithubActionMessage, createGithubPreviewMessage, handleGithubMessage } = await loadApi();
    expect(handleGithubMessage).toBeTypeOf('function');
    let calls = 0;
    const client = {
      action: async () => { calls += 1; return {}; },
      preview: async () => { calls += 1; return {}; },
    };

    await expect(handleGithubMessage?.(
      createGithubPreviewMessage?.('https://github.com/owner/repository'),
      { accessToken: async () => 'device-token', client, context: { extensionId: 'extension-id', sender: { id: 'extension-id', tab: { id: 7 } } } },
    )).resolves.toEqual({ code: 'unexpected-sender', protocolVersion: 1, type: 'protocol.error' });
    await expect(handleGithubMessage?.(
      createGithubActionMessage?.({ ...intent, confirmationEvidenceRef: '' }),
      { accessToken: async () => 'device-token', client, context: { extensionId: 'extension-id', sender: { id: 'extension-id' } } },
    )).resolves.toEqual({ code: 'invalid-message', protocolVersion: 1, type: 'protocol.error' });
    expect(calls).toBe(0);
  });

  it('does not allow a recognized repository draft into generic capture submission', async () => {
    const { handleArticleSubmissionMessage } = await import(new URL('../src/protocol/article-submission.ts', import.meta.url).href);
    let enqueues = 0;
    const reply = await handleArticleSubmissionMessage({
      draft: {
        captureKind: 'page',
        entryPoint: 'popup',
        github: { previewUrl: 'https://github.com/owner/repository' },
        sourcePageUrl: 'https://github.com/owner/repository',
        title: 'owner/repository',
        url: 'https://github.com/owner/repository',
      },
      mode: 'tracked',
      protocolVersion: 1,
      type: 'popup.submit-draft',
    }, {
      context: { extensionId: 'extension-id', sender: { id: 'extension-id' } },
      queue: { enqueue: async () => { enqueues += 1; return { id: 'capture-1', status: 'queued' as const }; } },
    });

    expect(reply).toEqual({ code: 'invalid-message', protocolVersion: 1, type: 'protocol.error' });
    expect(enqueues).toBe(0);
  });
});
