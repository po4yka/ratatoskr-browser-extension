import { assertNever, type WorkerIncomingMessage } from '../src/protocol/messages';

export function handleEveryWorkerMessage(message: WorkerIncomingMessage): string {
  switch (message.type) {
    case 'content-context':
      return message.context.url;
    case 'popup.stage-draft':
      return message.draft.url;
    default:
      return assertNever(message);
  }
}
