## Why

The capture-draft slice has popup and service-worker surfaces but no formal runtime protocol or
content-script boundary. Adding that boundary now prevents the legacy extension's broad-permission
pattern from leaking into the new design as later capture features are introduced.

## What Changes

- Define a single, protocol-versioned discriminated-union message contract for popup-to-worker,
  content-script-to-worker, and worker-to-caller exchanges.
- Validate unknown versions and message variants at runtime, and reject content-script messages
  whose sender or payload does not satisfy the privileged worker boundary.
- Keep protocol handling exhaustive in every participating extension surface.
- Add the minimal persistent permission baseline needed by implementation-plan items 1–9:
  `activeTab` and `storage`; retain the already implemented `contextMenus` action surface, with
  no host permissions.
- Publish a committed permission-rationale table that maps each requested permission to an
  implemented or planned user-visible capability and explicitly records excluded broad grants.

## Capabilities

### New Capabilities

- `extension-message-protocol`: Typed, versioned, validated extension-runtime messages across
  popup, content script, and service worker.
- `minimal-permission-baseline`: Reviewed extension permission baseline and rationale for the
  browser capture roadmap.

### Modified Capabilities

- None.

## Impact

- Affects shared TypeScript protocol modules, popup and service-worker adapters, a new ephemeral
  user-triggered content-script adapter, the MV3 manifest, permission documentation, and tests.
- Adds no dependencies, persistent host permissions, provider access, networking, credentials, or
  queue implementation.
- The protocol is extension-local and does not change any cross-repository Platform contract.
