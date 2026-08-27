import { describe, expect, it, vi } from 'vitest';

interface FlowApi {
  createDoubleConfirmationFlow(options: {
    readonly dispatch: () => Promise<void>;
    readonly openFinal: () => void;
    readonly openReview: () => void;
  }): {
    begin(invoker: { focus(): void }): void;
    cancel(): void;
    confirmFinal(): Promise<void>;
    confirmReview(): void;
  };
}

async function loadApi(): Promise<FlowApi> {
  return (await import(new URL('../src/options/destructive-confirmation.ts', import.meta.url).href)) as FlowApi;
}

describe('destructive confirmations', () => {
  it.each(['revoke', 'clear-all'])('dispatches %s only after two confirmations', async () => {
    const { createDoubleConfirmationFlow } = await loadApi();
    const dispatch = vi.fn(async () => undefined);
    const openReview = vi.fn();
    const openFinal = vi.fn();
    const flow = createDoubleConfirmationFlow({ dispatch, openFinal, openReview });

    flow.begin({ focus: vi.fn() });
    expect(openReview).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
    flow.confirmReview();
    expect(openFinal).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
    await flow.confirmFinal();
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it('cancel restores focus without dispatch', async () => {
    const { createDoubleConfirmationFlow } = await loadApi();
    const focus = vi.fn();
    const dispatch = vi.fn(async () => undefined);
    const flow = createDoubleConfirmationFlow({ dispatch, openFinal: vi.fn(), openReview: vi.fn() });

    flow.begin({ focus });
    flow.cancel();
    expect(focus).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
