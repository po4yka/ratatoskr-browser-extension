import type { QueueAlarm } from './types';

export const queueAlarmName = 'durable-capture-queue';

export class ChromeQueueAlarm implements QueueAlarm {
  schedule(at: number | undefined): void {
    if (at === undefined) {
      void chrome.alarms.clear(queueAlarmName);
      return;
    }
    chrome.alarms.create(queueAlarmName, { when: at });
  }
}

export function registerQueueAlarm(processDue: () => Promise<void>): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === queueAlarmName) {
      void processDue();
    }
  });
}
