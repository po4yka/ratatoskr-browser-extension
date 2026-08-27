export const messageIds = {
  commonCancel: 'commonCancel', commonNotProvided: 'commonNotProvided', commonUnavailable: 'commonUnavailable',
  diagnosticsError: 'diagnosticsError', diagnosticsReady: 'diagnosticsReady', extensionDescription: 'extensionDescription', extensionName: 'extensionName',
  githubActionResult: 'githubActionResult', githubActionUnavailable: 'githubActionUnavailable', githubChecking: 'githubChecking',
  githubResultRow: 'githubResultRow',
  githubPreviewAvailable: 'githubPreviewAvailable', githubSubmitting: 'githubSubmitting', githubUnavailable: 'githubUnavailable',
  operationGeneric: 'operationGeneric', operationPartialSocial: 'operationPartialSocial', operationRetryAvailable: 'operationRetryAvailable',
  operationRetryUnavailable: 'operationRetryUnavailable', operationSocialUnavailable: 'operationSocialUnavailable', operationWaiting: 'operationWaiting',
  optionsClearBlocked: 'optionsClearBlocked', optionsClearIncomplete: 'optionsClearIncomplete', optionsClearSuccess: 'optionsClearSuccess',
  optionsPairingError: 'optionsPairingError', optionsPairingSent: 'optionsPairingSent', optionsPreferenceError: 'optionsPreferenceError',
  optionsPreferenceSaved: 'optionsPreferenceSaved', optionsRevokeFailed: 'optionsRevokeFailed', optionsRevokeSuccess: 'optionsRevokeSuccess',
  optionsStateUnavailable: 'optionsStateUnavailable', queueEmpty: 'queueEmpty', queueItem: 'queueItem', queueRetained: 'queueRetained',
  popupErrorActiveTab: 'popupErrorActiveTab', popupErrorDelivery: 'popupErrorDelivery', popupErrorStaging: 'popupErrorStaging',
  popupStateQueued: 'popupStateQueued', popupStateReady: 'popupStateReady', popupStateRepositoryStaged: 'popupStateRepositoryStaged',
  popupStateStaged: 'popupStateStaged', popupStateSubmitted: 'popupStateSubmitted',
} as const;

export type MessageKey = keyof typeof messageIds;

export function message(key: MessageKey, substitutions: string | readonly string[] = []): string {
  const value = chrome.i18n.getMessage(key, substitutions as string | string[]);
  if (value === '') throw new Error(`missing-message:${key}`);
  return value;
}

export function localizeDocument(root: Document = document): void {
  root.documentElement.lang = chrome.i18n.getUILanguage();
  localizeAttribute(root, { attribute: 'aria-label', dataName: 'data-i18n-aria-label' });
  localizeAttribute(root, { attribute: 'placeholder', dataName: 'data-i18n-placeholder' });
  localizeAttribute(root, { attribute: 'title', dataName: 'data-i18n-title' });
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n;
    if (key !== undefined) element.textContent = chrome.i18n.getMessage(key);
  }
}

function localizeAttribute(root: Document, options: { readonly attribute: string; readonly dataName: string }): void {
  for (const element of root.querySelectorAll<HTMLElement>(`[${options.dataName}]`)) {
    const key = element.getAttribute(options.dataName);
    if (key !== null) element.setAttribute(options.attribute, chrome.i18n.getMessage(key));
  }
}
