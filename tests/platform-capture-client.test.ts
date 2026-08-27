import { describe, expect, it } from 'vitest';

interface CaptureClient {
  submit(request: { readonly accessToken: string; readonly idempotencyKey: string; readonly url: string }): Promise<{ readonly operationId: string }>;
}

interface CaptureApi {
  createPlatformCaptureClient(options: { readonly endpoint: string; readonly fetch: typeof fetch }): CaptureClient;
}

async function loadApi(): Promise<CaptureApi> {
  return (await import(new URL('../src/capture/platform-client.ts', import.meta.url).href)) as CaptureApi;
}

describe('Platform capture HTTP boundary', () => {
  it('submits only the URL and stable idempotency key', async () => {
    const { createPlatformCaptureClient } = await loadApi();
    const requests: Request[] = [];
    const client = createPlatformCaptureClient({
      endpoint: 'https://ratatoskr.example',
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(JSON.stringify({ operation_id: 'operation-1', status: 'accepted' }), { status: 202 });
      },
    });

    await expect(client.submit({
      accessToken: 'device-token',
      idempotencyKey: 'capture-key-1',
      url: 'https://example.test/articles/one',
    })).resolves.toEqual({ operationId: 'operation-1' });
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.url).toBe('https://ratatoskr.example/v1/captures');
    expect(request?.headers.get('authorization')).toBe('Bearer device-token');
    expect(request?.headers.get('idempotency-key')).toBe('capture-key-1');
    expect(await request?.json()).toEqual({ url: 'https://example.test/articles/one' });
  });
});
