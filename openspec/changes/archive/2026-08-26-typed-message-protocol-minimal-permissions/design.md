## Context

See [proposal.md](proposal.md) for the motivation. The existing MV3 extension has a popup
and a context-menu worker adapter, with `activeTab` and `contextMenus` already requested.
There is no shared runtime message contract, content script, storage permission, or host
permission. The `capture-drafts` change deliberately excluded those concerns.

## Goals / Non-Goals

**Goals:**

- Establish one extension-local contract with a `protocolVersion: 1` field that rejects all
  other versions; it is a schema marker, not version negotiation.
- Make runtime decoding and receiver dispatch fail closed, while preserving strict TypeScript
  exhaustiveness checks.
- Provide an injectable worker/content-script boundary suitable for unit tests without
  registering a persistent content script.
- Make the permission baseline and exclusions reviewable in one committed document and tests.

**Non-Goals:**

- No page extraction, static content-script registration, `window.postMessage` bridge,
  `chrome.scripting` injection, networking, Platform API client, queue, credentials, alarms,
  commands, notifications, or host access.
- No protocol compatibility routing, migration path, or later major protocol version.

## Decisions

### Closed discriminated unions with explicit runtime decoder

Create a `src/protocol/` module that exports narrow TypeScript unions for each receiver,
the first protocol-version literal, a runtime decoder from `unknown`, and safe reply/error
variants. The decoder accepts only own plain-object data with exactly the documented shapes;
unknown keys, discriminants, and versions fail safe. A bare TypeScript union was considered
but rejected because browser runtime messages are untyped at process boundaries.

### Receiver-specific unions and `assertNever`

Use a receiver-specific accepted union in popup, worker, and content-script handlers. Switch
statements terminate in an `assertNever` helper that accepts `never`, so new variants fail
`tsc` until every receiver is updated. A permissive `default` branch was rejected because it
could discard new or hostile messages silently.

### No page bridge and no registered content script

The content-script module owns only extension-runtime decoding and a worker-directed request
adapter. It will not listen to page `window.postMessage`, and the manifest will not include a
`content_scripts` declaration. This proves the protocol boundary without asking for host or
`scripting` permission before a user-facing extraction capability exists. A static content
script was rejected because it would broaden page presence without an implemented action.

### Baseline permission set with no host permissions

The manifest baseline is `activeTab`, `contextMenus`, and `storage`. `activeTab` supports
explicit current-tab work; `contextMenus` supports the shipped explicit page/link/selection
actions; `storage` is required for planned local state in items 4, 5, 6, and 9. There are no
host permissions because this change performs no network or persistent page access. A future
paired endpoint or feature that needs host access must name its exact origin and receive its
own review; a wildcard was rejected as neither minimal nor demonstrably required now.

## Risks / Trade-offs

- [A later use case needs a new message shape] → Adding the union member intentionally breaks
  type checking until every receiver and runtime decoder has an explicit decision.
- [The content script is not yet executable in a packed extension] → The protocol module is
  tested in isolation; an explicit extraction feature will add a separately reviewed injection
  and permission design.
- [Storage permission precedes its first persisted record] → It is narrowly scoped to the
  roadmap's imminent local state and is retained only with the committed rationale and regression test.

## Migration Plan

1. Add failing protocol and manifest/rationale tests.
2. Add the shared decoder, exhaustive receiver adapters, and minimal content-script boundary.
3. Add `storage` to the manifest and the rationale table; retain the existing explicit-action
   permissions and no host list.
4. Run the repository gate and strict OpenSpec validation. Rollback removes the protocol,
   `storage` permission, rationale document, and their tests together; no persisted or remote
   data exists in this change.
