import { describe, expect, it } from 'vitest';

interface DiagnosticsApi {
  buildDiagnostics(input: DiagnosticInput, options?: { readonly includeUrls?: boolean }): unknown;
  createSupportSession(): {
    exportOptions(): { readonly includeUrls: boolean };
    reset(): void;
    setIncludeUrls(value: boolean): void;
  };
}

interface DiagnosticInput {
  readonly browser: { readonly family: string; readonly version: string };
  readonly endpoint?: string;
  readonly extensionVersion: string;
  readonly operations: readonly Record<string, unknown>[];
  readonly paired: boolean;
  readonly permissions: { readonly endpointOrigin: boolean };
  readonly queue: readonly Record<string, unknown>[];
}

const input: DiagnosticInput = {
  browser: { family: 'Chromium', version: '120' },
  endpoint: 'https://ratatoskr.example/private',
  extensionVersion: '0.1.0',
  operations: [{ rawError: 'authorization Bearer raw-secret', status: 'failed', target: 'document:private' }],
  paired: true,
  permissions: { endpointOrigin: true },
  queue: [{
    accessToken: 'access-secret', idempotencyKey: 'idem-secret', note: 'private note', selectionText: 'private selection',
    status: 'retry-wait', title: 'private title', url: 'https://private.example/path?token=secret',
  }],
};

async function loadApi(): Promise<DiagnosticsApi> {
  return (await import(new URL('../src/options/diagnostics.ts', import.meta.url).href)) as DiagnosticsApi;
}

describe('diagnostics redaction', () => {
  it('default export contains only allowlisted aggregate fields', async () => {
    const { buildDiagnostics } = await loadApi();
    expect(buildDiagnostics(input)).toEqual({
      browser: input.browser,
      extensionVersion: '0.1.0',
      operations: { byStatus: { failed: 1 }, total: 1 },
      paired: true,
      permissions: { endpointOrigin: true },
      queue: { byStatus: { 'retry-wait': 1 }, total: 1 },
      schemaVersion: 1,
      sensitiveFieldsIncluded: false,
    });
  });

  it('hostile nested URL token and user-content values never escape', async () => {
    const { buildDiagnostics } = await loadApi();
    const serialized = JSON.stringify(buildDiagnostics(input));
    expect(serialized).not.toMatch(/ratatoskr\.example|private\.example|secret|private note|private selection|private title|Bearer|document:private/);
  });

  it('support-session toggle includes only labeled URL fields', async () => {
    const { buildDiagnostics } = await loadApi();
    const diagnostics = buildDiagnostics(input, { includeUrls: true });
    expect(diagnostics).toMatchObject({
      sensitiveFieldsIncluded: true,
      sensitiveUrls: { captureUrls: ['https://private.example/path?token=secret'], endpoint: 'https://ratatoskr.example/private' },
    });
    expect(JSON.stringify(diagnostics)).not.toMatch(/access-secret|idem-secret|private note|private selection|private title|Bearer|document:private/);
  });

  it('support inclusion is not persisted', async () => {
    const { createSupportSession } = await loadApi();
    const first = createSupportSession();
    first.setIncludeUrls(true);
    expect(first.exportOptions()).toEqual({ includeUrls: true });
    expect(createSupportSession().exportOptions()).toEqual({ includeUrls: false });
    first.reset();
    expect(first.exportOptions()).toEqual({ includeUrls: false });
  });
});
