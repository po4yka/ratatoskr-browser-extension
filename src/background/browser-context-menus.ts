import type { ContextMenusApi, MenuClickInfo } from './context-menu';

export function browserContextMenus(): ContextMenusApi {
  return {
    create: (definition) => {
      chrome.contextMenus.create({
        contexts: [...definition.contexts] as [chrome.contextMenus.ContextType, ...chrome.contextMenus.ContextType[]],
        id: definition.id,
        title: definition.title,
      });
    },
    onClicked: {
      addListener: (listener) => {
        chrome.contextMenus.onClicked.addListener((info, tab) => {
          listener(menuClickInfo(info), tabContext(tab));
        });
      },
    },
  };
}

function menuClickInfo(info: chrome.contextMenus.OnClickData): MenuClickInfo {
  return {
    menuItemId: String(info.menuItemId),
    ...(info.linkUrl === undefined ? {} : { linkUrl: info.linkUrl }),
    ...(info.selectionText === undefined ? {} : { selectionText: info.selectionText }),
  };
}

function tabContext(tab: chrome.tabs.Tab | undefined): { readonly title?: string; readonly url?: string } {
  return {
    ...(tab?.title === undefined ? {} : { title: tab.title }),
    ...(tab?.url === undefined ? {} : { url: tab.url }),
  };
}
