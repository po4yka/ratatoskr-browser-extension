import {
  createDraft,
  createReadyState,
  markDraftError,
  stageDraft,
  type CaptureDraftInput,
  type DraftState,
  type TabContext,
} from '../capture/draft';

export interface MenuDefinition {
  readonly contexts: readonly string[];
  readonly id: string;
  readonly title: string;
}

export interface MenuClickInfo {
  readonly linkUrl?: string;
  readonly menuItemId: string;
  readonly selectionText?: string;
}

export interface ContextMenusApi {
  create(definition: MenuDefinition): void;
  onClicked: {
    addListener(listener: (info: MenuClickInfo, tab: TabContext) => void): void;
  };
}

const captureMenus: readonly MenuDefinition[] = [
  { contexts: ['page'], id: 'capture-page', title: 'Save page to Ratatoskr' },
  { contexts: ['link'], id: 'capture-link', title: 'Save link to Ratatoskr' },
  { contexts: ['selection'], id: 'capture-selection', title: 'Save selected text to Ratatoskr' },
];

export function registerCaptureContextMenus(
  api: ContextMenusApi,
  onStaged: (state: DraftState) => void,
): void {
  for (const menu of captureMenus) {
    api.create(menu);
  }
  api.onClicked.addListener((info, tab) => {
    const input = draftInputForMenu(info, tab);
    if (input === undefined) {
      return;
    }
    try {
      onStaged(stageDraft(createReadyState(createDraft(input))));
    } catch (error) {
      onStaged(markDraftError(errorMessage(error)));
    }
  });
}

function draftInputForMenu(info: MenuClickInfo, tab: TabContext): CaptureDraftInput | undefined {
  switch (info.menuItemId) {
    case 'capture-page':
      return { entryPoint: 'page-menu', tab };
    case 'capture-link':
      return { entryPoint: 'link-menu', linkUrl: info.linkUrl ?? '', tab };
    case 'capture-selection':
      return { entryPoint: 'selection-menu', selectionText: info.selectionText ?? '', tab };
    default:
      return undefined;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The capture draft could not be staged.';
}
