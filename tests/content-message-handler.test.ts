import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface ContentHandlerApi {
  handleContentScriptMessage(
    message: unknown,
    readContext: () => { readonly selectionText?: string; readonly title: string; readonly url: string },
  ): unknown;
}

async function loadContentHandlerApi(): Promise<ContentHandlerApi> {
  return (await import(new URL('../src/content/message-handler.ts', import.meta.url).href)) as ContentHandlerApi;
}

describe('content-script protocol handler', () => {
  it('handles the documented worker request and rejects unknown messages', async () => {
    const { handleContentScriptMessage } = await loadContentHandlerApi();

    expect(
      handleContentScriptMessage(
        { protocolVersion: 1, type: 'content-context.request' },
        () => ({ selectionText: 'Selected by the user', title: 'Example page', url: 'https://example.test/source' }),
      ),
    ).toEqual({
      context: { selectionText: 'Selected by the user', title: 'Example page', url: 'https://example.test/source' },
      protocolVersion: 1,
      type: 'content-context',
    });
    expect(handleContentScriptMessage({ protocolVersion: 1, type: 'page.post-message' }, () => ({ title: 'Ignored', url: 'https://example.test' }))).toEqual({
      code: 'unknown-message',
      protocolVersion: 1,
      type: 'protocol.error',
    });
  });

  it('does not expose a page postMessage bridge', () => {
    const source = readFileSync(new URL('../src/content/message-handler.ts', import.meta.url), 'utf8');

    expect(source).not.toContain('window.addEventListener');
    expect(source).not.toContain('.postMessage(');
  });
});
