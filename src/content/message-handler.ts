import {
  assertNever,
  createContentContextMessage,
  decodeContentScriptRequest,
  type ContentContext,
  type ContentScriptReply,
} from '../protocol/messages';

export type ReadContentContext = () => ContentContext;
export type SendToWorker = (message: ContentScriptReply) => Promise<unknown>;

export function handleContentScriptMessage(message: unknown, readContext: ReadContentContext): ContentScriptReply {
  const request = decodeContentScriptRequest(message);
  switch (request.type) {
    case 'content-context.request':
      return createContentContextMessage(readContext());
    case 'protocol.error':
      return request;
    default:
      return assertNever(request);
  }
}

export async function sendContentScriptReply(
  message: unknown,
  options: { readonly readContext: ReadContentContext; readonly sendToWorker: SendToWorker },
): Promise<unknown> {
  return options.sendToWorker(handleContentScriptMessage(message, options.readContext));
}
