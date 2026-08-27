## Why

Staged browser captures remain local even though Platform already accepts idempotent article
capture requests and publishes their operation status. Users need both an immediate quick-save
path and a truthful tracked-save path without exposing more page data or browser privileges.

## What Changes

- Submit each staged article draft to Platform's existing `POST /v1/captures` boundary with its
  durable queue idempotency key.
- Add explicit quick-save and tracked-save presentation state machines.
- Persist accepted operation identity and recover tracked polling after service-worker restart.
- Render Platform lifecycle status, retryable failure guidance, and a validated web-reader deep
  link only after an analysis result is reported.

## Capabilities

### New Capabilities

- `article-capture-submission`: Idempotent Platform capture submission, quick and tracked modes,
  recovered operation polling, and truthful result/failure presentation.

### Modified Capabilities

- `capture-drafts`: Replace the staging-only delivery limitation with explicit user-selected
  submission modes while preserving truthful draft-state presentation.

## Impact

The popup, service worker, queue storage, runtime protocol, and a new Platform API adapter change.
The implementation consumes existing Platform `POST /v1/captures` and operation-read routes; it
does not add Platform contracts, browser permissions, host permissions, content scripts, or
provider access.
