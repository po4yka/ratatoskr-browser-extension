import { describe, expect, it } from 'vitest';

interface QueueViewApi {
  queueItemText(item: QueueItem): string;
}

interface QueueItem {
  readonly attemptCount: number;
  readonly id: string;
  readonly nextRetryAt?: number;
  readonly status: 'accepted' | 'queued' | 'retry-wait' | 'submitting' | 'terminal-failure';
  readonly terminalReason?: 'policy' | 'validation';
}

async function loadQueueViewApi(): Promise<QueueViewApi> {
  return (await import(new URL('../src/options/queue-view.ts', import.meta.url).href)) as QueueViewApi;
}

describe('options queue inspection', () => {
  it('renders queue state without draft content', async () => {
    const { queueItemText } = await loadQueueViewApi();

    const rendered = queueItemText({
      attemptCount: 2,
      id: 'capture-1',
      nextRetryAt: 5_000,
      status: 'retry-wait',
    });

    expect(rendered).toContain('capture-1');
    expect(rendered).toContain('retry-wait');
    expect(rendered).toContain('attempt 2');
    expect(rendered).not.toContain('private selected text');
  });
});
