## Context

See proposal.md for the motivation. The current worker owns a durable queue but has a placeholder
submitter, and no current runtime message can represent pairing. Existing runtime protocol rules
already reject unknown message discriminants and restrict content-script senders.

## Goals / Non-Goals

**Goals:**

- Create a narrow, injectable Platform identity boundary that can be exercised by local fixtures.
- Persist secrets only through an unexported worker-owned repository and expose a safe state
  projection.
- Make queued authorization resilient to service-worker concurrency using one in-flight refresh.
- Treat revoked credentials as a clean, terminal transition to logged out.

**Non-Goals:**

- Implement Platform's primary-session pairing-code issuance page or change its server contract.
- Add provider OAuth, cookies, persistent host permissions, a page bridge, or a content-script pairing surface.
- Submit capture payloads or introduce operation tracking; those remain plan item 6.

## Decisions

### Existing pairing-code HTTP contract

The authenticated primary session creates a short-lived code at Platform. The options page accepts
that code only after explicit user action; the worker posts `{ code, kind: "browser_extension" }`
to `/v1/devices/pair` and posts the rotated refresh token to `/v1/sessions/refresh`. Tests use
fetch fixtures for successful, refused, malformed, and revoked responses. UI networking was
rejected because it would expose credentials outside the worker.

### Narrow optional endpoint grant

The manifest declares optional HTTPS host access and the options action requests only the exact
origin entered by the user. The worker validates HTTPS origin equality and rejects redirects.

### Trusted local extension storage behind one repository

The credential repository will use `chrome.storage.local`, never `storage.sync`, and set local
storage to trusted contexts where the browser provides that restriction. Its API returns safe
connection state or an access credential only to worker-only callers; it has no protocol export.
Keeping a refresh credential only in memory was rejected because service-worker and browser
restarts would turn ordinary suspension into logout.

### Authorization wrapper at the queue submission seam

The queue's submit callback will be an authorization wrapper that obtains an access credential
from the boundary, refreshes when expiry requires it, and maps safe outcomes back to the queue.
The boundary holds one in-flight refresh promise, so simultaneous submissions wait for one refresh
instead of rotating the device credential twice. Embedding tokens in queue records was rejected
because records are intentionally inspectable and durable.

### Revocation is a terminal local state transition

The adapter reports revocation through a typed result. The boundary deletes the local record before
returning an authentication-required outcome, preventing later queue attempts from reusing a known
invalid secret. Retaining the record for diagnostics was rejected because it defeats revocation.

## Risks / Trade-offs

- [Browser lacks trusted-context storage access controls] → use the storage abstraction's most
  restrictive available mode and keep the content-script module free of both storage and identity
  imports; Firefox-specific hardening remains a browser-adapter follow-up.
- [Platform endpoint is unavailable] → preserve a safe unpaired state and show a retryable error;
  never retain a pairing code or response body.
- [Refresh is interrupted after Platform rotates the secret] → future Platform endpoint support
  must provide idempotent refresh/recovery; this slice never persists a credential in queue state.

## Migration Plan

No persisted legacy credential is read or migrated. A browser with a legacy localStorage JWT is
treated as logged out and the user explicitly pairs again. Rollback removes the extension's
credential record, leaving the device revocable server-side and no secret recoverable from queue
data.
