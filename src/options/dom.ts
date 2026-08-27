import { message } from '../i18n/messages';
import type { SafeOptionsState } from './state';
import { queueItemText } from './queue-view';

export interface OptionsElements {
  readonly clear: HTMLButtonElement;
  readonly diagnostics: HTMLButtonElement;
  readonly diagnosticsSensitive: HTMLInputElement;
  readonly deviceEndpoint: HTMLOutputElement;
  readonly deviceId: HTMLOutputElement;
  readonly deviceStatus: HTMLOutputElement;
  readonly pairingForm: HTMLFormElement;
  readonly preferencesForm: HTMLFormElement;
  readonly queue: HTMLUListElement;
  readonly revoke: HTMLButtonElement;
  readonly status: HTMLElement;
}

export function optionsElements(): OptionsElements | undefined {
  const elements = {
    clear: query<HTMLButtonElement>('[data-action="clear-all"]'),
    diagnostics: query<HTMLButtonElement>('[data-action="export-diagnostics"]'),
    diagnosticsSensitive: query<HTMLInputElement>('[data-role="diagnostics-sensitive"]'),
    deviceEndpoint: query<HTMLOutputElement>('[data-role="device-endpoint"]'),
    deviceId: query<HTMLOutputElement>('[data-role="device-id"]'),
    deviceStatus: query<HTMLOutputElement>('[data-role="device-status"]'),
    pairingForm: query<HTMLFormElement>('[data-role="pairing-form"]'),
    preferencesForm: query<HTMLFormElement>('[data-role="preferences-form"]'),
    queue: query<HTMLUListElement>('[data-role="queue-list"]'),
    revoke: query<HTMLButtonElement>('[data-action="revoke"]'),
    status: query<HTMLElement>('[data-role="status"]'),
  };
  return Object.values(elements).some((value) => value === null) ? undefined : elements as OptionsElements;
}

export function renderOptionsState(elements: OptionsElements, state: SafeOptionsState): void {
  const mode = document.querySelector<HTMLInputElement>(`[name="default-mode"][value="${state.defaultCaptureMode}"]`);
  if (mode !== null) mode.checked = true;
  const paired = state.device.status === 'paired';
  elements.deviceStatus.value = chrome.i18n.getMessage(paired ? 'devicePaired' : 'deviceUnpaired');
  elements.deviceEndpoint.value = paired ? state.device.endpoint : message('commonUnavailable');
  elements.deviceId.value = paired ? state.device.deviceId : message('commonUnavailable');
  elements.revoke.disabled = !paired;
  elements.queue.replaceChildren(...state.queue.map((item) => {
    const element = document.createElement('li');
    element.textContent = queueItemText(item, (values) => message('queueItem', values));
    return element;
  }));
}

export function selectedMode(): 'quick' | 'tracked' {
  return document.querySelector<HTMLInputElement>('[name="default-mode"]:checked')?.value === 'tracked' ? 'tracked' : 'quick';
}

function query<T extends Element>(selector: string): T | null {
  return document.querySelector<T>(selector);
}
