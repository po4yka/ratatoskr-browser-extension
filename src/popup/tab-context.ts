import type { TabContext } from '../capture/draft';

export function tabContext(tab: chrome.tabs.Tab | undefined): TabContext {
  return {
    ...(tab?.title === undefined ? {} : { title: tab.title }),
    ...(tab?.url === undefined ? {} : { url: tab.url }),
  };
}

export function activeTabErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The active page cannot be captured.';
}
