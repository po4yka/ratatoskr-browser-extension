export interface PairedDevice {
  readonly accessToken: string;
  readonly deviceId: string;
  readonly deviceSecret: string;
  readonly expiresAt: number;
  readonly refreshToken: string;
}

export interface RotatedCredentials {
  readonly accessToken: string;
  readonly expiresAt: number;
  readonly refreshToken: string;
}

export class PlatformIdentityError extends Error {
  constructor(readonly code: 'device-revoked' | 'identity-unavailable') { super(code); }
}

export function createPlatformIdentityClient(options: { readonly endpoint: string; readonly fetch: typeof fetch }): {
  pair(code: string): Promise<PairedDevice>;
  refresh(refreshToken: string): Promise<RotatedCredentials>;
  revoke(request: { readonly accessToken: string; readonly deviceId: string }): Promise<'already-unauthorized' | 'revoked'>;
} {
  const endpoint = httpsOrigin(options.endpoint);
  return {
    pair: async (code) => paired(await request({ body: { code, kind: 'browser_extension' }, expected: 201, fetcher: options.fetch, url: `${endpoint}/v1/devices/pair` })),
    refresh: async (refreshToken) => rotated(await request({ body: { refresh_token: refreshToken }, expected: 200, fetcher: options.fetch, url: `${endpoint}/v1/sessions/refresh` })),
    revoke: async (revokeRequest) => revoke({ endpoint, fetcher: options.fetch, request: revokeRequest }),
  };
}

async function revoke(options: { readonly endpoint: string; readonly fetcher: typeof fetch; readonly request: { readonly accessToken: string; readonly deviceId: string } }): Promise<'already-unauthorized' | 'revoked'> {
  if (!/^[A-Za-z0-9-]{1,128}$/.test(options.request.deviceId)) throw new PlatformIdentityError('identity-unavailable');
  const response = await options.fetcher(`${options.endpoint}/v1/devices/${options.request.deviceId}`, {
    headers: { authorization: `Bearer ${options.request.accessToken}` }, method: 'DELETE', redirect: 'error',
  });
  if (response.status === 204) return 'revoked';
  if (response.status === 401) return 'already-unauthorized';
  throw new PlatformIdentityError('identity-unavailable');
}

async function request(options: { readonly body: object; readonly expected: number; readonly fetcher: typeof fetch; readonly url: string }): Promise<unknown> {
  const response = await options.fetcher(options.url, { body: JSON.stringify(options.body), headers: { 'content-type': 'application/json' }, method: 'POST', redirect: 'error' });
  if (response.status !== options.expected) throw new PlatformIdentityError(response.status === 401 ? 'device-revoked' : 'identity-unavailable');
  return response.json();
}

function paired(value: unknown): PairedDevice {
  const record = object(value);
  return { accessToken: string(record.credential), deviceId: string(record.device_id), deviceSecret: string(record.device_secret), expiresAt: Date.parse(string(record.expires_at)), refreshToken: string(record.refresh_token) };
}

function rotated(value: unknown): RotatedCredentials {
  const record = object(value);
  return { accessToken: string(record.credential), expiresAt: Date.parse(string(record.expires_at)), refreshToken: string(record.refresh_token) };
}

function httpsOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) throw new Error('invalid-endpoint');
  return url.origin;
}

function object(value: unknown): Record<string, unknown> { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid-platform-response'); return value as Record<string, unknown>; }
function string(value: unknown): string { if (typeof value !== 'string') throw new Error('invalid-platform-response'); return value; }
