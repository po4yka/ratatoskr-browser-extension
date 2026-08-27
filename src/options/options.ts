import { localizeDocument, message, type MessageKey } from '../i18n/messages';
import { decodeOptionsReply, optionsMessages } from '../protocol/options-control';
import { connectDestructiveDialogs } from './dialog-ui';
import { optionsElements, renderOptionsState, selectedMode } from './dom';
import { createSupportSession, type Diagnostics } from './diagnostics';

localizeDocument();
const elements = optionsElements();
const supportSession = createSupportSession();

if (elements !== undefined) {
  elements.pairingForm.addEventListener('submit', (event) => { event.preventDefault(); void pair(); });
  elements.preferencesForm.addEventListener('submit', (event) => { event.preventDefault(); void savePreference(); });
  elements.diagnosticsSensitive.addEventListener('change', () => supportSession.setIncludeUrls(elements.diagnosticsSensitive.checked));
  elements.diagnostics.addEventListener('click', () => void exportDiagnostics());
  connectDestructiveDialogs({ action: 'revoke', dispatch: revoke, invoker: elements.revoke });
  connectDestructiveDialogs({ action: 'clear', dispatch: clearAll, invoker: elements.clear });
  void loadState();
}

async function pair(): Promise<void> {
  const endpoint = document.querySelector<HTMLInputElement>('[data-role="pairing-endpoint"]')?.value ?? '';
  const code = document.querySelector<HTMLInputElement>('[data-role="pairing-code"]')?.value ?? '';
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || !await chrome.permissions.request({ origins: [`${url.origin}/*`] })) throw new Error('permission-denied');
    await chrome.runtime.sendMessage({ code, endpoint: url.origin, protocolVersion: 1, type: 'pairing.submit' });
    showStatus('optionsPairingSent');
    await loadState();
  } catch {
    showStatus('optionsPairingError');
  }
}

async function loadState(): Promise<void> {
  if (elements === undefined) return;
  try {
    const reply = decodeOptionsReply(await chrome.runtime.sendMessage(optionsMessages.state()));
    if (reply.type !== 'options.state') throw new Error('invalid-state');
    renderOptionsState(elements, reply.state);
    showStatus(reply.state.queue.length === 0 ? 'queueEmpty' : 'queueRetained', String(reply.state.queue.length));
  } catch {
    showStatus('optionsStateUnavailable');
  }
}

async function savePreference(): Promise<void> {
  try {
    const reply = decodeOptionsReply(await chrome.runtime.sendMessage(optionsMessages.preference(selectedMode())));
    showStatus(reply.type === 'options.preference.result' ? 'optionsPreferenceSaved' : 'optionsPreferenceError');
  } catch {
    showStatus('optionsPreferenceError');
  }
}

async function revoke(): Promise<void> {
  try {
    const reply = decodeOptionsReply(await chrome.runtime.sendMessage(optionsMessages.revoke()));
    showStatus(reply.type === 'options.revoke.result' && reply.status !== 'failed' ? 'optionsRevokeSuccess' : 'optionsRevokeFailed');
    await loadState();
  } catch {
    showStatus('optionsRevokeFailed');
  }
}

async function clearAll(): Promise<void> {
  if (elements === undefined) return;
  try {
    const reply = decodeOptionsReply(await chrome.runtime.sendMessage(optionsMessages.clear()));
    if (reply.type !== 'options.clear.result') throw new Error('invalid-clear-result');
    const key = reply.status === 'cleared' ? 'optionsClearSuccess' : reply.status === 'blocked' ? 'optionsClearBlocked' : 'optionsClearIncomplete';
    supportSession.reset();
    elements.diagnosticsSensitive.checked = false;
    showStatus(key);
    await loadState();
  } catch {
    showStatus('optionsClearIncomplete');
  }
}

async function exportDiagnostics(): Promise<void> {
  try {
    const reply = decodeOptionsReply(await chrome.runtime.sendMessage(optionsMessages.diagnostics(supportSession.exportOptions().includeUrls)));
    if (reply.type !== 'options.diagnostics') throw new Error('invalid-diagnostics');
    download(reply.diagnostics);
    showStatus('diagnosticsReady');
  } catch {
    showStatus('diagnosticsError');
  }
}

function download(diagnostics: Diagnostics): void {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(diagnostics, null, 2)}\n`], { type: 'application/json' }));
  const link = document.createElement('a');
  link.download = 'ratatoskr-diagnostics.json';
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function showStatus(key: MessageKey, substitution?: string): void {
  if (elements !== undefined) elements.status.textContent = message(key, substitution ?? []);
}
