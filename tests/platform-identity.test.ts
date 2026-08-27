import { describe, expect, it } from 'vitest';

interface Api {
  createPlatformIdentityClient(options: { readonly endpoint: string; readonly fetch: typeof fetch }): {
    pair(code: string): Promise<{ readonly accessToken: string; readonly deviceId: string; readonly deviceSecret: string; readonly expiresAt: number; readonly refreshToken: string }>;
    refresh(refreshToken: string): Promise<{ readonly accessToken: string; readonly expiresAt: number; readonly refreshToken: string }>;
  };
}

async function loadApi(): Promise<Api> {
  return (await import(new URL('../src/auth/platform-identity.ts', import.meta.url).href)) as Api;
}

describe('Platform identity HTTP boundary', () => {
  it('exchanges an explicit pairing code and rotates credentials without redirects', async () => {
    const { createPlatformIdentityClient } = await loadApi();
    const requests: Request[] = [];
    const client = createPlatformIdentityClient({
      endpoint: 'https://ratatoskr.example',
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(JSON.stringify(requests.length === 1
          ? { credential: 'access', device_id: 'device-1', device_secret: 'root', expires_at: '2026-08-27T12:00:00Z', refresh_token: 'refresh', refresh_expires_at: '2026-08-28T12:00:00Z', user_id: 'user-1' }
          : { credential: 'access-2', expires_at: '2026-08-27T13:00:00Z', refresh_token: 'refresh-2', refresh_expires_at: '2026-08-28T13:00:00Z' }), { status: requests.length === 1 ? 201 : 200 });
      },
    });
    await expect(client.pair('pairing-code')).resolves.toMatchObject({ accessToken: 'access', deviceId: 'device-1', deviceSecret: 'root', refreshToken: 'refresh' });
    await expect(client.refresh('refresh')).resolves.toMatchObject({ accessToken: 'access-2', refreshToken: 'refresh-2' });
    expect(await requests[0]?.json()).toEqual({ code: 'pairing-code', kind: 'browser_extension' });
    expect(requests.map((request) => [request.url, request.redirect])).toEqual([
      ['https://ratatoskr.example/v1/devices/pair', 'error'],
      ['https://ratatoskr.example/v1/sessions/refresh', 'error'],
    ]);
  });
});
