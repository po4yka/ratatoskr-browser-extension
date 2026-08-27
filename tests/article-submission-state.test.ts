import { describe, expect, it } from 'vitest';

interface SubmissionStateApi {
  acceptTrackedSave(state: SubmissionState, operationId: string): SubmissionState;
  applyOperationSnapshot(state: SubmissionState, snapshot: { readonly operationId: string; readonly progressPercent?: number; readonly stage?: string; readonly status: 'accepted' | 'queued' | 'running' | 'succeeded' }): SubmissionState;
  queueSave(captureId: string, mode: 'quick' | 'tracked'): SubmissionState;
}

type SubmissionState =
  | { readonly captureId: string; readonly mode: 'quick'; readonly status: 'queued' }
  | { readonly captureId: string; readonly mode: 'tracked'; readonly operationId?: string; readonly progressPercent?: number; readonly stage?: string; readonly status: 'queued' | 'tracking' | 'succeeded' };

async function loadApi(): Promise<SubmissionStateApi> {
  return (await import(new URL('../src/capture/submission-state.ts', import.meta.url).href)) as SubmissionStateApi;
}

describe('article submission state', () => {
  it('quick save becomes queued without waiting', async () => {
    const { queueSave } = await loadApi();

    expect(queueSave('capture-1', 'quick')).toEqual({ captureId: 'capture-1', mode: 'quick', status: 'queued' });
  });

  it('tracked save presents acceptance and progress', async () => {
    const { acceptTrackedSave, applyOperationSnapshot, queueSave } = await loadApi();
    const accepted = acceptTrackedSave(queueSave('capture-2', 'tracked'), 'operation-2');

    expect(accepted).toEqual({ captureId: 'capture-2', mode: 'tracked', operationId: 'operation-2', status: 'tracking' });
    expect(applyOperationSnapshot(accepted, { operationId: 'operation-2', progressPercent: 50, stage: 'analyzing', status: 'running' }))
      .toEqual({ captureId: 'capture-2', mode: 'tracked', operationId: 'operation-2', progressPercent: 50, stage: 'analyzing', status: 'tracking' });
  });
});
