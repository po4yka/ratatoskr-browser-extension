import type { CaptureDraft, DraftState } from '../capture/draft';

export function saveableDraft(current: DraftState | undefined): CaptureDraft | undefined {
  return current === undefined || current.status === 'error' || (current.status !== 'staged' && current.status !== 'queued')
    ? undefined
    : current.draft;
}
