export type CaptureEntryPoint = 'popup' | 'page-menu' | 'link-menu' | 'selection-menu';
export type CaptureKind = 'page' | 'link' | 'selection';

export interface TabContext {
  readonly title?: string;
  readonly url?: string;
}

interface PageDraftInput {
  readonly entryPoint: 'popup' | 'page-menu';
  readonly tab: TabContext;
}

interface LinkDraftInput {
  readonly entryPoint: 'link-menu';
  readonly linkUrl: string;
  readonly tab: TabContext;
}

interface SelectionDraftInput {
  readonly entryPoint: 'selection-menu';
  readonly selectionText: string;
  readonly tab: TabContext;
}

export type CaptureDraftInput = PageDraftInput | LinkDraftInput | SelectionDraftInput;

export interface CaptureDraft {
  readonly captureKind: CaptureKind;
  readonly entryPoint: CaptureEntryPoint;
  readonly sourcePageUrl: string;
  readonly title: string;
  readonly url: string;
  readonly selectionText?: string;
}

export type DraftState =
  | { readonly draft: CaptureDraft; readonly status: 'ready' | 'staged' | 'submitted' }
  | { readonly message: string; readonly status: 'error' };

export class CaptureDraftError extends Error {}

export function createDraft(input: CaptureDraftInput): CaptureDraft {
  const sourcePageUrl = requireHttpUrl(input.tab.url, 'The active page cannot be captured.');
  const title = input.tab.title?.trim() || 'Untitled page';

  if (input.entryPoint === 'link-menu') {
    return {
      captureKind: 'link',
      entryPoint: input.entryPoint,
      sourcePageUrl,
      title,
      url: requireHttpUrl(input.linkUrl, 'The selected link cannot be captured.'),
    };
  }

  if (input.entryPoint === 'selection-menu') {
    const selectionText = input.selectionText.trim();
    if (selectionText === '') {
      throw new CaptureDraftError('Select text before saving it to Ratatoskr.');
    }
    return {
      captureKind: 'selection',
      entryPoint: input.entryPoint,
      selectionText,
      sourcePageUrl,
      title,
      url: sourcePageUrl,
    };
  }

  return {
    captureKind: 'page',
    entryPoint: input.entryPoint,
    sourcePageUrl,
    title,
    url: sourcePageUrl,
  };
}

export function createReadyState(draft: CaptureDraft): DraftState {
  return { draft, status: 'ready' };
}

export function stageDraft(state: DraftState): DraftState {
  return state.status === 'ready'
    ? { draft: state.draft, status: 'staged' }
    : markDraftError('Only a ready draft can be staged.');
}

export function markDraftSubmitted(state: DraftState): DraftState {
  return state.status === 'staged'
    ? { draft: state.draft, status: 'submitted' }
    : markDraftError('Only a staged draft can be marked as submitted.');
}

export function markDraftError(message: string): DraftState {
  return { message, status: 'error' };
}

function requireHttpUrl(value: string | undefined, message: string): string {
  if (value === undefined) {
    throw new CaptureDraftError(message);
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new CaptureDraftError(message);
    }
    return value;
  } catch {
    throw new CaptureDraftError(message);
  }
}
