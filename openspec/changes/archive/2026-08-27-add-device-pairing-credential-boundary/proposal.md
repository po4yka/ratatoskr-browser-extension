## Why

The legacy extension persisted long-lived JWTs in page-readable local storage, so a hostile page
or content-script defect could expose a durable Platform credential. Ratatoskr needs an explicit
device-approval flow that gives the service worker a scoped, revocable credential without letting
page contexts obtain or relay it.

## What Changes

- Replace the rejected challenge/approval-URL model with Platform's existing one-time pairing-code
  contract: the primary session creates the code and the extension explicitly exchanges it.
- Keep the credential exclusively in non-sync extension storage behind a service-worker-only
  repository; popup, options, and content-script protocol surfaces receive only safe connection
  state.
- Add a single-flight refresh path used by queued submissions, and clear the local credential and
  report a logged-out state when Platform reports revocation.
- Replace the legacy localStorage/JWT model; no compatibility path remains.

## Capabilities

### New Capabilities

- `device-pairing`: Explicit Platform identity approval, secret isolation, refresh serialization,
  and revocation-safe extension connection state.

### Modified Capabilities

- `durable-capture-queue`: Queued submission obtains its authorization through the device
  credential boundary and treats revocation as an action-required logged-out state.

## Impact

Adds the worker-owned Platform HTTP identity client, explicit options-page pairing code form, and
the narrow optional HTTPS origin grant required for the user-selected endpoint. It adds no provider,
cookie, history, or network-interception permission and makes no Platform server contract change.
