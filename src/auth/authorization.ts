import type { DeviceCredentialRecord, DeviceCredentialStore } from './pairing';
import { PlatformIdentityError } from './platform-identity';
import type { SubmitCapture, SubmitOutcome, SubmitRequest } from '../queue/types';

export interface CredentialBoundary {
  accessToken(): Promise<string>;
  connectionState(): Promise<'logged-out' | 'paired'>;
  degradeToLoggedOut(): Promise<void>;
  endpoint(): Promise<string>;
}

export interface RefreshResult {
  readonly accessToken: string;
  readonly expiresAt: number;
  readonly refreshToken: string;
}

export interface AuthorizationRequest {
  readonly accessToken: string;
  readonly idempotencyKey: string;
}

export interface AuthorizedSubmitter {
  (request: { readonly idempotencyKey: string }): Promise<unknown>;
}

export class DeviceRevokedError extends Error {
  readonly code = 'device-revoked';
}

export function createCredentialBoundary(options: {
  readonly now: () => number;
  readonly refresh: (refreshToken: string, endpoint: string) => Promise<RefreshResult>;
  readonly store: DeviceCredentialStore;
}): CredentialBoundary {
  return new CredentialBoundaryImpl(options);
}

export function createAuthorizedSubmitter(options: {
  readonly authorization: CredentialBoundary;
  readonly submit: (request: AuthorizationRequest) => Promise<unknown>;
}): AuthorizedSubmitter {
  return async (request) => options.submit({ accessToken: await options.authorization.accessToken(), idempotencyKey: request.idempotencyKey });
}

export function createAuthorizedQueueSubmitter(options: {
  readonly authorization: CredentialBoundary;
  readonly submit: (request: SubmitRequest & { readonly accessToken: string }) => Promise<SubmitOutcome>;
}): SubmitCapture {
  return async (request) => {
    try {
      return await options.submit({ ...request, accessToken: await options.authorization.accessToken() });
    } catch (error) {
      if (error instanceof DeviceRevokedError || (error instanceof PlatformIdentityError && error.code === 'device-revoked')) {
        await options.authorization.degradeToLoggedOut();
        return { reason: 'authentication-required', type: 'terminal' };
      }
      throw error;
    }
  };
}

class CredentialBoundaryImpl implements CredentialBoundary {
  private refreshInFlight: Promise<string> | undefined;

  constructor(private readonly options: { readonly now: () => number; readonly refresh: (refreshToken: string, endpoint: string) => Promise<RefreshResult>; readonly store: DeviceCredentialStore }) {}

  async accessToken(): Promise<string> {
    const credential = await this.readCredential();
    if (credential.expiresAt > this.options.now()) {
      return credential.accessToken;
    }
    return this.refreshOnce(credential);
  }

  async connectionState(): Promise<'logged-out' | 'paired'> {
    return isCredentialRecord(await this.options.store.load()) ? 'paired' : 'logged-out';
  }

  async endpoint(): Promise<string> {
    return (await this.readCredential()).endpoint;
  }

  async degradeToLoggedOut(): Promise<void> {
    await this.options.store.clear();
  }

  private async readCredential(): Promise<DeviceCredentialRecord> {
    const stored = await this.options.store.load();
    if (!isCredentialRecord(stored)) {
      throw new Error('Device is not paired.');
    }
    return stored;
  }

  private async refreshOnce(credential: DeviceCredentialRecord): Promise<string> {
    const inFlight = this.refreshInFlight ?? this.refresh(credential);
    this.refreshInFlight = inFlight;
    try {
      return await inFlight;
    } finally {
      if (this.refreshInFlight === inFlight) {
        this.refreshInFlight = undefined;
      }
    }
  }

  private async refresh(credential: DeviceCredentialRecord): Promise<string> {
    let refreshed: RefreshResult;
    try {
      refreshed = await this.options.refresh(credential.refreshToken, credential.endpoint);
    } catch (error) {
      if (error instanceof DeviceRevokedError || (error instanceof PlatformIdentityError && error.code === 'device-revoked')) {
        await this.degradeToLoggedOut();
      }
      throw error;
    }
    const next = { ...credential, ...refreshed };
    await this.options.store.save(next);
    return next.accessToken;
  }
}

function isCredentialRecord(value: unknown): value is DeviceCredentialRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.accessToken === 'string'
    && typeof record.deviceId === 'string'
    && typeof record.endpoint === 'string'
    && typeof record.expiresAt === 'number'
    && typeof record.refreshToken === 'string';
}
