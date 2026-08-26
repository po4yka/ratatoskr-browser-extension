import { describe, expect, it } from 'vitest';

interface DraftState {
  readonly draft?: { readonly entryPoint: string; readonly url: string };
  readonly status: 'ready' | 'staged' | 'submitted' | 'error';
}

interface MenuDefinition {
  readonly contexts: readonly string[];
  readonly id: string;
  readonly title: string;
}

interface ContextMenusApi {
  create(definition: MenuDefinition): void;
  onClicked: {
    addListener(listener: (info: MenuClickInfo, tab: TabContext) => void): void;
  };
}

interface MenuClickInfo {
  readonly linkUrl?: string;
  readonly menuItemId: string;
  readonly selectionText?: string;
}

interface TabContext {
  readonly title?: string;
  readonly url?: string;
}

interface ContextMenuApi {
  registerCaptureContextMenus(api: ContextMenusApi, onStaged: (state: DraftState) => void): void;
}

async function loadContextMenuApi(): Promise<ContextMenuApi> {
  return (await import(new URL('../src/background/context-menu.ts', import.meta.url).href)) as ContextMenuApi;
}

describe('capture context menus', () => {
  it('registers page, link, and selection commands that stage shared drafts', async () => {
    const created: MenuDefinition[] = [];
    const staged: DraftState[] = [];
    let clickListener: ((info: MenuClickInfo, tab: TabContext) => void) | undefined;
    const api: ContextMenusApi = {
      create: (definition) => created.push(definition),
      onClicked: { addListener: (listener) => (clickListener = listener) },
    };
    const { registerCaptureContextMenus } = await loadContextMenuApi();

    registerCaptureContextMenus(api, (state) => staged.push(state));

    expect(created).toEqual([
      { contexts: ['page'], id: 'capture-page', title: 'Save page to Ratatoskr' },
      { contexts: ['link'], id: 'capture-link', title: 'Save link to Ratatoskr' },
      { contexts: ['selection'], id: 'capture-selection', title: 'Save selected text to Ratatoskr' },
    ]);
    const tab = { title: 'Example article', url: 'https://example.test/articles/ratatoskr' };
    clickListener?.({ menuItemId: 'capture-page' }, tab);
    clickListener?.({ linkUrl: 'https://other.example.test/reference', menuItemId: 'capture-link' }, tab);
    clickListener?.({ menuItemId: 'capture-selection', selectionText: 'A selected quotation.', }, tab);

    expect(staged).toMatchObject([
      { draft: { entryPoint: 'page-menu', url: tab.url }, status: 'staged' },
      { draft: { entryPoint: 'link-menu', url: 'https://other.example.test/reference' }, status: 'staged' },
      { draft: { entryPoint: 'selection-menu', url: tab.url }, status: 'staged' },
    ]);
  });
});
