import { describe, expect, it } from 'vitest';

type CaptureEntryPoint = 'popup' | 'page-menu' | 'link-menu' | 'selection-menu';
type CaptureKind = 'page' | 'link' | 'selection';

interface CaptureDraft {
  readonly captureKind: CaptureKind;
  readonly entryPoint: CaptureEntryPoint;
  readonly sourcePageUrl: string;
  readonly title: string;
  readonly url: string;
  readonly selectionText?: string;
}

interface DraftState {
  readonly draft?: CaptureDraft;
  readonly message?: string;
  readonly status: 'ready' | 'staged' | 'submitted' | 'error';
}

interface DraftApi {
  createDraft(input: unknown): CaptureDraft;
  createReadyState(draft: CaptureDraft): DraftState;
  markDraftError(message: string): DraftState;
  markDraftSubmitted(state: DraftState): DraftState;
  stageDraft(state: DraftState): DraftState;
}

const sampleTab = {
  title: 'Example article',
  url: 'https://example.test/articles/ratatoskr',
};

async function loadDraftApi(): Promise<DraftApi> {
  return (await import(new URL('../src/capture/draft.ts', import.meta.url).href)) as DraftApi;
}

describe('capture drafts', () => {
  it('constructs popup, page-menu, link-menu, and selection-menu drafts', async () => {
    const { createDraft } = await loadDraftApi();

    expect(createDraft({ entryPoint: 'popup', tab: sampleTab })).toEqual({
      captureKind: 'page',
      entryPoint: 'popup',
      sourcePageUrl: sampleTab.url,
      title: sampleTab.title,
      url: sampleTab.url,
    });
    expect(createDraft({ entryPoint: 'page-menu', tab: sampleTab })).toEqual({
      captureKind: 'page',
      entryPoint: 'page-menu',
      sourcePageUrl: sampleTab.url,
      title: sampleTab.title,
      url: sampleTab.url,
    });
    expect(
      createDraft({
        entryPoint: 'link-menu',
        linkUrl: 'https://other.example.test/reference',
        tab: sampleTab,
      }),
    ).toEqual({
      captureKind: 'link',
      entryPoint: 'link-menu',
      sourcePageUrl: sampleTab.url,
      title: sampleTab.title,
      url: 'https://other.example.test/reference',
    });
    expect(
      createDraft({
        entryPoint: 'selection-menu',
        selectionText: 'A user-selected quotation.',
        tab: sampleTab,
      }),
    ).toEqual({
      captureKind: 'selection',
      entryPoint: 'selection-menu',
      selectionText: 'A user-selected quotation.',
      sourcePageUrl: sampleTab.url,
      title: sampleTab.title,
      url: sampleTab.url,
    });
  });

  it('transitions a staged draft through ready, staged, submitted, and error', async () => {
    const { createDraft, createReadyState, markDraftError, markDraftSubmitted, stageDraft } = await loadDraftApi();
    const ready = createReadyState(createDraft({ entryPoint: 'popup', tab: sampleTab }));

    expect(ready.status).toBe('ready');
    const staged = stageDraft(ready);
    expect(staged.status).toBe('staged');
    expect(markDraftSubmitted(staged).status).toBe('submitted');
    expect(markDraftError('The active page cannot be captured.')).toEqual({
      message: 'The active page cannot be captured.',
      status: 'error',
    });
  });
});
