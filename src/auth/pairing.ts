export type PairingOutcome = 'approved' | 'expired' | 'origin-mismatch' | 'pending' | 'rejected';

export interface DeviceCredentialRecord {
  readonly accessToken: string;
  readonly deviceId: string;
  readonly deviceSecret: string;
  readonly endpoint: string;
  readonly expiresAt: number;
  readonly refreshToken: string;
}

export interface DeviceCredentialStore {
  clear(): Promise<void>;
  load(): Promise<unknown>;
  save(record: DeviceCredentialRecord): Promise<void>;
}

export interface PairingChallenge {
  readonly approvalUrl: string;
  readonly challengeId: string;
  readonly endpoint: string;
}

export type ApprovalResult =
  | { readonly type: 'approved'; readonly credential: DeviceCredentialRecord }
  | { readonly type: 'expired' | 'pending' | 'rejected' };

export interface PlatformIdentity {
  checkApproval(challenge: PairingChallenge): Promise<ApprovalResult>;
  createChallenge(endpoint: string): Promise<PairingChallenge>;
}

export type PairingState =
  | { readonly deviceId: string; readonly endpoint: string; readonly status: 'paired' }
  | { readonly status: 'awaiting-approval' | 'pairing-expired' | 'pairing-origin-mismatch' | 'pairing-rejected' };

type UnpairedPairingStatus = 'awaiting-approval' | 'pairing-expired' | 'pairing-origin-mismatch' | 'pairing-rejected';

export interface PairingController {
  begin(endpoint: string): Promise<{ readonly approvalUrl: string; readonly challengeId: string; readonly status: 'awaiting-approval' }>;
  complete(challengeId: string): Promise<PairingState>;
}

export function createPairingController(options: {
  readonly identity: PlatformIdentity;
  readonly now: () => number;
  readonly store: DeviceCredentialStore;
}): PairingController {
  return new PairingControllerImpl(options);
}

export function createPlatformIdentityFixture(outcome: PairingOutcome): PlatformIdentity {
  return {
    async checkApproval(challenge) {
      if (outcome === 'origin-mismatch') {
        return {
          credential: {
            accessToken: 'fixture-access-token',
            deviceId: 'device-1',
            deviceSecret: 'fixture-device-secret',
            endpoint: 'https://other.example',
            expiresAt: 61_000,
            refreshToken: 'fixture-refresh-token',
          },
          type: 'approved',
        };
      }
      if (outcome !== 'approved') {
        return { type: outcome };
      }
      return {
        credential: {
          accessToken: 'fixture-access-token',
          deviceId: 'device-1',
          deviceSecret: 'fixture-device-secret',
          endpoint: challenge.endpoint,
          expiresAt: 61_000,
          refreshToken: 'fixture-refresh-token',
        },
        type: 'approved',
      };
    },
    async createChallenge(endpoint) {
      return {
        approvalUrl: `${endpoint}/approve/challenge-1`,
        challengeId: 'challenge-1',
        endpoint,
      };
    },
  };
}

class PairingControllerImpl implements PairingController {
  private activeChallenge: PairingChallenge | undefined;

  constructor(private readonly options: { readonly identity: PlatformIdentity; readonly now: () => number; readonly store: DeviceCredentialStore }) {}

  async begin(endpoint: string): Promise<{ readonly approvalUrl: string; readonly challengeId: string; readonly status: 'awaiting-approval' }> {
    assertHttpsOrigin(endpoint);
    const challenge = await this.options.identity.createChallenge(endpoint);
    this.activeChallenge = challenge;
    return { approvalUrl: challenge.approvalUrl, challengeId: challenge.challengeId, status: 'awaiting-approval' };
  }

  async complete(challengeId: string): Promise<PairingState> {
    const challenge = this.activeChallenge;
    if (challenge === undefined || challenge.challengeId !== challengeId) {
      return { status: 'pairing-origin-mismatch' };
    }
    const result = await this.options.identity.checkApproval(challenge);
    if (result.type === 'approved') {
      if (result.credential.endpoint !== challenge.endpoint || result.credential.expiresAt <= this.options.now()) {
        return { status: 'pairing-origin-mismatch' };
      }
      await this.options.store.save(result.credential);
      return { deviceId: result.credential.deviceId, endpoint: result.credential.endpoint, status: 'paired' };
    }
    return { status: toPairingState(result.type) };
  }
}

function assertHttpsOrigin(value: string): void {
  const endpoint = new URL(value);
  if (endpoint.protocol !== 'https:' || endpoint.pathname !== '/' || endpoint.search !== '' || endpoint.hash !== '') {
    throw new Error('Pairing requires an HTTPS origin.');
  }
}

function toPairingState(outcome: Exclude<PairingOutcome, 'approved' | 'origin-mismatch'>): UnpairedPairingStatus {
  switch (outcome) {
    case 'expired':
      return 'pairing-expired';
    case 'pending':
      return 'awaiting-approval';
    case 'rejected':
      return 'pairing-rejected';
  }
}
