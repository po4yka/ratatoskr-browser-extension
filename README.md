# Ratatoskr Browser Extension

`ratatoskr-browser-extension` is the explicit browser capture client for Ratatoskr. It lets a user save the current page, selected text, or a supported social/GitHub URL to their local Ratatoskr deployment without exposing provider passwords, session cookies, or hidden browser APIs.

> **Status:** architecture bootstrap. No extension manifest, background worker, popup UI, content script, or API client is implemented yet.

> [!IMPORTANT]
> **Ratatoskr is in development.** No database holds data that has to survive a schema change.
> While this status holds, these two rules replace what the documents below plan:
>
> - the API and the database keep their first version. There is no `v2` and no later major
>   version.
> - the database has no migrations. One schema definition exists, and a schema change edits it in
>   place.
>
> Only the repository owner changes this status.

## Role in Ratatoskr

The extension is a user-controlled capture surface. It answers one narrow question:

> What does the user explicitly want Ratatoskr to preserve from the page currently open in the browser?

It does not continuously monitor browsing history, scrape logged-in accounts in the background, or become a provider synchronization service.

Typical destinations:

- ordinary web article -> `ratatoskr-extractor`;
- GitHub repository -> `ratatoskr-github`;
- X post -> `ratatoskr-x`;
- Instagram post/reel -> `ratatoskr-instagram`;
- Threads post -> `ratatoskr-threads`;
- generic selected text or note -> Platform capture workflow.

Routing is performed through `ratatoskr-platform`; the extension never connects directly to service databases or internal message buses.

## Core responsibilities

- explicit "Save to Ratatoskr" action;
- capture of the current canonical URL;
- optional selected text;
- optional user note;
- optional tags or collection selection;
- source-platform detection as a routing hint;
- registered-device authentication;
- idempotent submission through the public Edge API;
- operation progress and final result display;
- offline or retry queue for transient local-server failures;
- deep link to the corresponding Ratatoskr web view;
- minimal, transparent browser permissions.

## Explicit capture model

The extension sends only data the user deliberately chooses:

```json
{
  "canonical_url": "https://example.com/article",
  "captured_at": "2026-08-17T10:30:00+04:00",
  "source": "browser_extension",
  "selected_text": "Optional user selection",
  "note": "Optional note",
  "collection_ids": ["..."]
}
```

A click on the toolbar action, context-menu command, or keyboard shortcut creates capture intent. Merely visiting a page does nothing.

## Proposed extension architecture

```text
ratatoskr-browser-extension/
├── apps/
│   └── extension/
│       ├── manifest
│       ├── background service worker
│       ├── popup
│       ├── options
│       ├── content scripts
│       └── assets
├── packages/
│   ├── api-client/
│   ├── capture-model/
│   ├── storage/
│   └── ui/
├── e2e/
└── tooling/
```

The initial implementation should target a modern Chromium Manifest V3 environment, while keeping browser-specific APIs behind narrow adapters so Firefox support can be evaluated later.

## Capture surfaces

### Toolbar popup

The popup may expose:

- detected source type;
- canonical URL preview;
- note field;
- collection/tag selectors;
- save action;
- operation status;
- open-in-Ratatoskr action.

### Context menu

Planned commands:

```text
Save page to Ratatoskr
Save selected text to Ratatoskr
Save link to Ratatoskr
Save GitHub repository
```

Provider-specific actions remain explicit and are enabled only when the current URL matches a supported public shape.

### Keyboard shortcut

A configurable shortcut may open the capture popup. It must not submit content without a visible user action unless the user explicitly enables a one-step capture mode.

## URL and page metadata

The extension may collect lightweight browser-visible metadata:

- `document.location.href`;
- canonical link when present;
- page title;
- selected text;
- current tab URL;
- optional meta description as a hint.

This metadata is not treated as the authoritative extracted document. `ratatoskr-extractor` performs safe retrieval, canonical parsing, provenance, and quality validation on the server side.

For authenticated or private pages, the extension does not transmit the browser DOM, cookies, storage, authorization headers, or session tokens by default.

## Social capture semantics

Instagram and Threads captures represent explicit local saves:

```text
saved_authority = ExplicitUserCapture
```

They are not labeled as authoritative copies of native Saved state.

For X, the official connector remains authoritative for bookmark synchronization. An explicit extension capture can coexist with a native X bookmark but preserves its own provenance.

## GitHub repository workflow

When the current page is a GitHub repository, the extension can open a safe repository action flow:

```text
metadata
track
star
```

Default behavior is `metadata`. `track` requests Git Vault enrollment. `star` is an external GitHub write and requires:

- a connected GitHub account;
- necessary provider scope;
- explicit confirmation;
- an idempotency key;
- an audit record.

The extension never stores the GitHub access token.

## Authentication

The extension registers as a Ratatoskr device through Platform. Planned behavior:

- initial pairing with the user's local Ratatoskr instance;
- short-lived access token;
- secure refresh or re-pairing policy;
- token storage in browser extension storage appropriate to the threat model;
- endpoint allowlist and TLS status display;
- explicit revoke from Ratatoskr account settings.

Provider tokens are never delivered to the extension.

## Offline and retry queue

Captures may occur while the local deployment is unavailable. The extension can retain a bounded local queue containing:

- capture ID and idempotency key;
- URL and selected text;
- note and local selection state;
- created time;
- retry count and last failure;
- target Ratatoskr endpoint.

Queue entries are encrypted or minimized as appropriate, size-bounded, visible to the user, and never silently discarded. Large files are out of scope for the initial extension and should use the web or mobile upload flow.

## Permissions policy

The extension requests the minimum permissions required for its configured surfaces. It should avoid broad host permissions whenever active-tab or explicit host grants are sufficient.

Expected principles:

- use `activeTab` for user-triggered page access;
- request storage only for settings, queue, and device state;
- request context-menu permissions only when the feature is enabled;
- no `cookies` permission;
- no browsing-history permission;
- no web-request interception for credential capture;
- no persistent content scripts on unrelated sites;
- no remotely hosted executable code.

Every permission must be documented in the store listing and in the repository.

## Privacy and security invariants

1. No provider password, cookie, local storage, or authorization header is collected.
2. No background browsing-history collection occurs.
3. A capture requires an explicit user action.
4. Page metadata is a hint; server-side source services remain authoritative.
5. Private-page DOM is not uploaded by default.
6. Provider external writes require separate confirmation and server-side consent validation.
7. Device tokens never enter logs or exported diagnostics.
8. The queue is bounded, inspectable, and clearable.
9. Endpoint changes require explicit user approval.
10. Content scripts are narrowly scoped and do not execute arbitrary remote code.

## Operation progress

After submission, the popup may present phases such as:

```text
Accepted
Resolving source
Extracting content
Analysing
Stored
Completed with warnings
Failed — retry available
```

Progress is obtained from the public Platform operation API. The extension does not infer completion from network timing or communicate directly with internal workers.

## Observability and diagnostics

Local diagnostics may include:

```text
extension version
browser version
registered endpoint
pairing state
queued capture count
last submission time
last operation result
API compatibility status
```

A diagnostic export redacts tokens, notes, selected text, private URLs, and user content by default.

## Non-goals

- Browser automation of Instagram, Threads, X, ChatGPT, Claude, or GitHub sessions.
- Access to provider cookies or hidden APIs.
- Continuous browsing-history capture.
- Full page extraction in the extension.
- LLM analysis or search.
- Direct NATS, PostgreSQL, or BlobStore access.
- Automatic provider writes caused by page navigation.
- Large arbitrary file backup in the first version.

## Initial milestones

1. Establish extension tooling, manifest, popup, and options page.
2. Implement active-tab URL capture and registered-device pairing.
3. Add idempotent generic page submission and operation progress.
4. Add notes, selected text, and local retry queue.
5. Add context-menu and keyboard-shortcut surfaces.
6. Add GitHub repository mode selection.
7. Add explicit X, Instagram, and Threads URL recognition.
8. Add compatibility checks and end-to-end tests against local Platform.
9. Harden permissions, diagnostics, update, and store-release workflows.

## Workspace integration

`ratatoskr-workspace` pins the extension with compatible Platform, social, GitHub, Extractor, Knowledge, and public API contracts. Integration tests run the built extension against an isolated browser and workspace Compose profile.

## Project status

This README defines the intended explicit browser-capture client. No extension application, manifest, API client, queue, or UI exists yet.
