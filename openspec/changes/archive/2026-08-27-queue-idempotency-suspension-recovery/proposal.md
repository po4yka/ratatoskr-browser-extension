## Why

The prior extension lost capture submissions when the browser closed, and an MV3 service worker
can suspend between any two asynchronous steps. Ratatoskr needs a durable, inspectable client-side
queue before it can submit captures without duplicate remote effects or silent loss.

## What Changes

- Add an extension-local durable capture queue in `chrome.storage.local`, with a stable random
  local capture ID and idempotency key created before any network attempt.
- Add a suspension-safe queue processor that persists an attempt lease before submission,
  recovers interrupted attempts on service-worker startup/alarm wake-up, reuses the same
  idempotency key, and records accepted, retry-wait, and permanent-terminal states.
- Add bounded exponential backoff with jitter and server retry hints for retryable outcomes; do
  not retry permanent policy or validation outcomes.
- Add a read-only options-page queue inspection surface showing safe item state, retry timing,
  attempt count, and terminal status.
- Extend the extension-runtime protocol for authenticated options-to-worker queue inspection and
  add the narrow `alarms` permission required to wake deferred retries. No host permissions,
  provider access, credentials, or Platform API contract are added.

## Capabilities

### New Capabilities

- `durable-capture-queue`: Durable, idempotent capture delivery and recovery across MV3 worker
  suspension, with retry state and a safe local inspection view.

### Modified Capabilities

- `extension-message-protocol`: Add validated, extension-page-only queue inspection messages and
  replies.
- `minimal-permission-baseline`: Document and require the narrowly scoped `alarms` permission for
  retry scheduling while retaining no host permissions.

## Impact

- Affects capture staging, background worker startup/alarm handling, a new queue storage and
  processor layer, protocol validation, options UI, manifest/permission documentation, and tests.
- Uses the existing `storage` permission through `chrome.storage.local` and adds `alarms`; it adds
  no production dependency or cross-repository Platform contract. The concrete Platform submission
  client remains a later change behind the queue submitter interface.
