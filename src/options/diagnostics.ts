interface DiagnosticInput {
  readonly browser: { readonly family: string; readonly version: string };
  readonly endpoint?: string;
  readonly extensionVersion: string;
  readonly operations: readonly Record<string, unknown>[];
  readonly paired: boolean;
  readonly permissions: { readonly endpointOrigin: boolean };
  readonly queue: readonly Record<string, unknown>[];
}

interface Aggregate {
  readonly byStatus: Readonly<Record<string, number>>;
  readonly total: number;
}

export interface Diagnostics {
  readonly browser: { readonly family: string; readonly version: string };
  readonly extensionVersion: string;
  readonly operations: Aggregate;
  readonly paired: boolean;
  readonly permissions: { readonly endpointOrigin: boolean };
  readonly queue: Aggregate;
  readonly schemaVersion: 1;
  readonly sensitiveFieldsIncluded: boolean;
  readonly sensitiveUrls?: { readonly captureUrls: readonly string[]; readonly endpoint?: string };
}

export function buildDiagnostics(input: DiagnosticInput, options: { readonly includeUrls?: boolean } = {}): Diagnostics {
  const includeUrls = options.includeUrls === true;
  return {
    browser: { family: input.browser.family, version: input.browser.version },
    extensionVersion: input.extensionVersion,
    operations: aggregate(input.operations),
    paired: input.paired,
    permissions: { endpointOrigin: input.permissions.endpointOrigin },
    queue: aggregate(input.queue),
    schemaVersion: 1,
    sensitiveFieldsIncluded: includeUrls,
    ...(includeUrls ? { sensitiveUrls: sensitiveUrls(input) } : {}),
  };
}

export function createSupportSession(): {
  exportOptions(): { readonly includeUrls: boolean };
  reset(): void;
  setIncludeUrls(value: boolean): void;
} {
  let includeUrls = false;
  return {
    exportOptions: () => ({ includeUrls }),
    reset: () => { includeUrls = false; },
    setIncludeUrls: (value) => { includeUrls = value; },
  };
}

function aggregate(items: readonly Record<string, unknown>[]): Aggregate {
  const byStatus: Record<string, number> = {};
  for (const item of items) {
    const status = safeStatus(item.status);
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }
  return { byStatus, total: items.length };
}

function safeStatus(value: unknown): string {
  const allowed = ['accepted', 'cancelled', 'failed', 'partially_succeeded', 'queued', 'retry-wait', 'running', 'submitting', 'succeeded', 'terminal-failure'];
  return typeof value === 'string' && allowed.includes(value) ? value : 'unknown';
}

function sensitiveUrls(input: DiagnosticInput): { readonly captureUrls: readonly string[]; readonly endpoint?: string } {
  const captureUrls = input.queue.flatMap((item) => typeof item.url === 'string' ? [item.url] : []);
  return { captureUrls, ...(input.endpoint === undefined ? {} : { endpoint: input.endpoint }) };
}
