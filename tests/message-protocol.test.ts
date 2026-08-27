import { describe, expect, it } from 'vitest';

interface CaptureDraft {
  readonly captureKind: 'page';
  readonly entryPoint: 'popup';
  readonly sourcePageUrl: string;
  readonly title: string;
  readonly url: string;
}

interface ProtocolApi {
  createContentContextMessage(context: { readonly title: string; readonly url: string }): unknown;
  createPopupStageMessage(draft: CaptureDraft): unknown;
  handleWorkerMessage(
    message: unknown,
    context: { readonly extensionId: string; readonly sender: { readonly id?: string; readonly tab?: { readonly id?: number } } },
  ): unknown;
}

interface QueueProtocolApi {
  createQueueInspectionMessage(): unknown;
  handleQueueInspectionMessage(
    message: unknown,
    handler: {
      readonly context: { readonly extensionId: string; readonly sender: { readonly id?: string; readonly tab?: { readonly id?: number } } };
      readonly queue: { readonly items: () => Promise<readonly QueuedItem[]> };
    },
  ): Promise<unknown>;
}

interface QueueSummary {
  readonly attemptCount: number;
  readonly id: string;
  readonly nextRetryAt?: number;
  readonly status: 'accepted' | 'queued' | 'retry-wait' | 'submitting' | 'terminal-failure';
  readonly terminalReason?: 'policy' | 'retention-expired' | 'retry-exhausted' | 'validation';
}

interface QueuedItem extends QueueSummary {
  readonly idempotencyKey: string;
}

async function loadProtocolApi(): Promise<ProtocolApi> {
  return (await import(new URL('../src/protocol/messages.ts', import.meta.url).href)) as ProtocolApi;
}

async function loadQueueProtocolApi(): Promise<QueueProtocolApi> {
  return (await import(new URL('../src/protocol/queue-inspection.ts', import.meta.url).href)) as QueueProtocolApi;
}

const draft: CaptureDraft = {
  captureKind: 'page',
  entryPoint: 'popup',
  sourcePageUrl: 'https://example.test/source',
  title: 'Example page',
  url: 'https://example.test/source',
};

describe('extension runtime message protocol', () => {
  it('round-trips known popup and content-script messages through the worker', async () => {
    const { createContentContextMessage, createPopupStageMessage, handleWorkerMessage } = await loadProtocolApi();

    expect(handleWorkerMessage(createPopupStageMessage(draft), { extensionId: 'extension-id', sender: { id: 'extension-id' } })).toEqual({
      protocolVersion: 1,
      type: 'capture-draft.staged',
    });
    expect(
      handleWorkerMessage(
        createContentContextMessage({ title: 'Example page', url: 'https://example.test/source' }),
        { extensionId: 'extension-id', sender: { id: 'extension-id', tab: { id: 7 } } },
      ),
    ).toEqual({
      protocolVersion: 1,
      type: 'content-context.accepted',
    });
  });

  it('rejects unknown versions, message discriminants, malformed payloads, and unexpected senders', async () => {
    const { handleWorkerMessage } = await loadProtocolApi();

    expect(handleWorkerMessage({ protocolVersion: 2, type: 'popup.stage-draft' }, { extensionId: 'extension-id', sender: { id: 'extension-id' } })).toEqual({
      code: 'unsupported-protocol-version',
      protocolVersion: 1,
      type: 'protocol.error',
    });
    expect(handleWorkerMessage({ protocolVersion: 1, type: 'unknown.message' }, { extensionId: 'extension-id', sender: { id: 'extension-id' } })).toEqual({
      code: 'unknown-message',
      protocolVersion: 1,
      type: 'protocol.error',
    });
    expect(handleWorkerMessage({ protocolVersion: 1, type: 'popup.stage-draft' }, { extensionId: 'extension-id', sender: { id: 'extension-id' } })).toEqual({
      code: 'invalid-message',
      protocolVersion: 1,
      type: 'protocol.error',
    });
    expect(
      handleWorkerMessage(
        { context: { title: 'Example page', url: 'https://example.test/source' }, protocolVersion: 1, type: 'content-context' },
        { extensionId: 'extension-id', sender: { id: 'other-extension', tab: { id: 7 } } },
      ),
    ).toEqual({ code: 'unexpected-sender', protocolVersion: 1, type: 'protocol.error' });
  });

  it('returns a safe queue summary to an extension page', async () => {
    const { createQueueInspectionMessage, handleQueueInspectionMessage } = await loadQueueProtocolApi();
    const queue = {
      items: async (): Promise<readonly QueuedItem[]> => [{
        attemptCount: 2,
        id: 'capture-1',
        idempotencyKey: 'private-idempotency-key',
        nextRetryAt: 5_000,
        status: 'retry-wait',
      }],
    };

    await expect(
      handleQueueInspectionMessage(
        createQueueInspectionMessage(),
        { context: { extensionId: 'extension-id', sender: { id: 'extension-id' } }, queue },
      ),
    ).resolves.toEqual({
      items: [{ attemptCount: 2, id: 'capture-1', nextRetryAt: 5_000, status: 'retry-wait' }],
      protocolVersion: 1,
      type: 'queue.inspected',
    });
  });
});
