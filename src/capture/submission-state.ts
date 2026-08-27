import type { OperationStatus } from './platform-client';

export type SaveMode = 'quick' | 'tracked';

export type SubmissionState =
  | { readonly captureId: string; readonly mode: 'quick'; readonly status: 'queued' }
  | TrackedSubmissionState;

interface TrackedSubmissionState {
  readonly captureId: string;
  readonly mode: 'tracked';
  readonly operationId?: string;
  readonly progressPercent?: number;
  readonly stage?: string;
  readonly status: 'queued' | 'tracking' | 'succeeded';
}

export function queueSave(captureId: string, mode: SaveMode): SubmissionState {
  return mode === 'quick'
    ? { captureId, mode, status: 'queued' }
    : { captureId, mode, status: 'queued' };
}

export function acceptTrackedSave(state: SubmissionState, operationId: string): SubmissionState {
  return state.mode !== 'tracked'
    ? state
    : { ...state, operationId, status: 'tracking' };
}

export function applyOperationSnapshot(
  state: SubmissionState,
  snapshot: { readonly operationId: string; readonly progressPercent?: number; readonly stage?: string; readonly status: OperationStatus },
): SubmissionState {
  if (state.mode !== 'tracked' || state.operationId !== snapshot.operationId) {
    return state;
  }
  return {
    ...state,
    ...(snapshot.progressPercent === undefined ? {} : { progressPercent: snapshot.progressPercent }),
    ...(snapshot.stage === undefined ? {} : { stage: snapshot.stage }),
    status: snapshot.status === 'succeeded' ? 'succeeded' : 'tracking',
  };
}
