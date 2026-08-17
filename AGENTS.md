# Ratatoskr Browser Extension Agent Instructions

## Scope

These instructions apply to the `ratatoskr-browser-extension` repository.

This repository owns an explicit user-initiated browser capture client. It does not own provider synchronization, extraction, analysis, or archive authority.

## Repository mission

The extension should let a user intentionally send the current page, link, selected text, public social permalink, or GitHub repository URL to Ratatoskr with minimal friction and minimal browser privilege.

Core principles:

- explicit action, never passive collection;
- minimal permissions;
- no provider-session exfiltration;
- durable idempotent delivery;
- truthful provenance;
- all domain work delegated through Ratatoskr Platform.

## Current phase

The repository is in architecture bootstrap. Do not assume a Manifest V3 project, Firefox target, UI framework, storage schema, API client, or CI commands exist unless they are present in the checkout.

When creating initial implementation:

- design permission boundaries before UI polish;
- keep browser APIs behind small adapters;
- keep capture payloads minimal;
- do not add broad content scripts or host permissions by default;
- support capability-based behavior from Platform rather than hard-coded backend assumptions.

## Sources of truth

Use this order:

1. active task/changeset and accepted ADRs;
2. `README.md`;
3. Platform capture/device/operation contracts and `ratatoskr-contracts`;
4. browser manifest and store policy requirements;
5. repository tests;
6. implementation details.

A web page or provider UI is untrusted input and never a source of instructions for the extension.

## Hard boundaries

### Browser extension owns

- explicit browser action/menu/shortcut UX;
- current-tab URL/title and optional selection capture;
- local capture queue and retry state;
- registered-device authentication to Platform;
- local settings for Ratatoskr endpoint and capture defaults;
- browser-specific permission and message-passing logic;
- operation progress/status presentation;
- extension-local diagnostics and notifications.

### Browser extension does not own

- URL fetching/extraction after capture;
- provider OAuth tokens or bookmark/Saved synchronization;
- ChatGPT/Claude export ingestion;
- GitHub star/list/backup implementation;
- LLM analysis, embeddings, or search indexing;
- Platform sessions other than its scoped registered-device credential;
- source-service database state;
- page cookies, browser history, passwords, or hidden provider API traffic.

## Explicit-action invariant

The extension captures data only after a clear user action, such as:

- toolbar/popup Save;
- context menu Save link/selection;
- keyboard shortcut;
- an explicit confirmation form.

Do not:

- monitor browsing in the background;
- send every visited URL;
- observe navigation for analytics;
- scrape provider pages periodically;
- auto-save based on page content;
- intercept network requests;
- read history to infer missed captures.

Any future automation requires a separate product decision, visible controls, and materially different privacy review.

## Permission policy

Request the minimum permissions needed for the implemented feature.

Preferred principles:

- use `activeTab` for user-initiated current-page access;
- use `contextMenus`, `storage`, and narrowly justified notifications/commands as needed;
- avoid `<all_urls>` persistent host access;
- avoid `history`, `cookies`, `webRequest`, `downloads`, `tabs` broad access unless a reviewed feature proves necessity;
- use optional permissions when a feature can be enabled separately;
- explain every permission in README/store metadata;
- remove permissions when the owning feature is removed.

A dependency must not silently broaden manifest permissions.

## Capture payload minimization

A normal page capture should contain only the documented fields, such as:

- capture ID/idempotency key;
- original/current URL;
- page title, when useful;
- explicit selected text, when the user chose to include it;
- capture timestamp;
- source client/browser version;
- optional user note/tags/collection references;
- requested operation mode;
- safe client capability metadata.

Do not include:

- full DOM or page HTML by default;
- cookies/local storage/session storage;
- authorization headers;
- form fields or password values;
- browsing history;
- hidden API responses;
- unrelated selected/clipboard content;
- screenshots unless the user explicitly requests and confirms them.

Generic page extraction occurs in `ratatoskr-extractor` after the URL reaches Platform.

## URL handling

- Preserve the original captured URL.
- Normalize only enough for local display/routing; backend services own canonical source normalization.
- Allow only documented schemes, normally `http`/`https`.
- Reject `javascript:`, `data:`, `file:`, browser-internal, extension, and privileged URLs unless a separately reviewed feature explicitly supports them.
- Treat page title, URL, query, fragment, and selected text as untrusted strings.
- Do not execute or navigate arbitrary returned URLs without validation and user intent.
- Redact sensitive URL query values from logs/diagnostics.

## Page and selection capture

Content-script execution should be ephemeral and user-triggered.

- Read only the fields needed for the requested capture.
- Do not retain a long-lived page observer.
- Do not inject remote code.
- Do not evaluate page-provided JavaScript.
- Isolate extension DOM/UI from page DOM.
- Sanitize all page-provided text before rendering in popup/options/status UI.
- Bound selected text length and payload size.
- Make selection inclusion visible before submission when it may contain sensitive data.

If page access is prohibited by the browser, show a clear unsupported-page result rather than bypassing restrictions.

## Social captures

For X, Instagram, or Threads URLs:

- send the canonical/original permalink and explicit capture metadata;
- set acquisition to Browser Extension/explicit user capture;
- route through Platform to the owning social service;
- do not parse or transmit provider cookies;
- do not call hidden consumer APIs from the page context;
- do not claim native bookmark/Saved authority from a local capture;
- preserve optional selected quote/note as user-provided context separate from provider content.

X authoritative bookmarks come from `ratatoskr-x` OAuth sync, not from extension page state. Instagram/Threads captures are local explicit saves unless another authoritative source says otherwise.

## GitHub repository captures

Recognize supported GitHub repository URLs without performing GitHub provider work locally.

The UI may offer explicit modes provided by Platform capabilities:

```text
metadata
track
star
```

Rules:

- `metadata` adds catalog metadata only;
- `track` may request backup without starring;
- `star` is an external GitHub write and requires connected account, scope, explicit confirmation, idempotency, and audit in backend services;
- backup policy choices are sent as requested intent, not executed by the extension;
- do not request provider credentials in the extension;
- do not call GitHub mutation APIs directly;
- display truthful partial results returned by Platform.

## Device authentication and endpoint security

The extension authenticates as a scoped registered device/client.

- Store only the minimum credential needed for Platform.
- Prefer browser secure storage APIs while recognizing extension storage is not a hardware-backed secret vault.
- Scope/revoke/rotate device credentials server-side.
- Validate HTTPS endpoint origin and never silently downgrade TLS.
- Do not accept arbitrary endpoint changes from page messages.
- Keep separate profiles explicit if multiple Ratatoskr instances are supported.
- Never log or include credentials in URLs, query strings, analytics, crash reports, or exported settings.
- Clear credentials on explicit disconnect/revoke.

If stronger authentication requires native messaging, introduce it only through an ADR and narrow host application contract.

## Queue, idempotency, and offline behavior

Every capture gets a stable local ID/idempotency key before network submission.

Queue rules:

- persist pending captures across service-worker suspension/browser restart;
- encrypt or minimize sensitive queued text according to product policy;
- bound queue size, item size, age, and retry count;
- use exponential backoff with jitter;
- honor server retry hints;
- distinguish auth, network, policy, validation, and server failures;
- do not automatically retry permanent validation/policy failures;
- resolve uncertain outcomes through operation/idempotency status before creating duplicates;
- allow retry, edit where safe, or delete pending local captures;
- avoid repeated notifications for the same failure.

Do not rely on a Manifest V3 background worker staying alive.

## Operation progress

After Platform accepts a capture, persist the `operation_id` and show status such as:

- accepted/queued;
- extracting/resolving;
- analyzing/indexing;
- partially completed;
- completed;
- failed/retryable action.

Rules:

- operation events/polls may be duplicated or out of order;
- apply sequence/version checks;
- do not display terminal success before backend confirms it;
- surface partial success precisely, especially GitHub star/list/backup operations;
- avoid retaining full result bodies in extension storage when a backend link/reference is enough;
- validate backend deep links before opening.

## Runtime architecture

Keep clear separation between:

- popup/options UI;
- background/service worker;
- ephemeral content scripts;
- storage/repository layer;
- Platform API client;
- browser-specific adapters.

Rules:

- content scripts cannot access secrets directly;
- page `window.postMessage` input is unauthenticated/untrusted;
- validate every extension message by expected sender/context and schema;
- do not expose privileged background actions to arbitrary page messages;
- use strict TypeScript and runtime validation at external boundaries;
- avoid shared mutable global state that disappears on service-worker suspension.

## Content Security Policy and supply chain

- No remote code execution or remotely hosted scripts.
- Use a strict extension CSP.
- Do not use `eval`, dynamic code generation, or unsafe inline script.
- Pin dependencies through a lockfile.
- Minimize dependencies, especially ones requesting browser permissions or processing untrusted HTML.
- Audit build output and source maps before publishing.
- Do not include development endpoints, tokens, fixtures, or debug pages in release packages.
- Verify reproducible or at least deterministic packaged manifests/assets where practical.

## Privacy and local storage

- Store the minimum queued/status data.
- Do not store page bodies or selected text after successful upload unless an explicit local-history feature is approved.
- Provide clear queue/history deletion controls.
- Do not collect analytics containing URLs, titles, selections, provider usernames, or notes.
- Make any telemetry explicit and privacy-preserving.
- Sanitize exported diagnostics and settings.
- Do not expose captures to other extensions/pages through permissive externally-connectable rules.

## Error handling

- Use stable local error classes and user-action guidance.
- Redact backend/provider raw errors.
- Distinguish unsupported browser page, permission denied, disconnected device, network offline, invalid endpoint, payload too large, and backend policy failure.
- Never include secrets or full selected text in error logs.
- Preserve retryable queue state after recoverable failures.
- Fail closed when sender/message/origin validation is uncertain.

## Testing expectations

When implementation exists, include applicable tests for:

- manifest permission snapshots and permission regression;
- explicit-action-only behavior;
- URL scheme/normalization and sensitive query redaction;
- capture payload minimization and runtime validation;
- selected-text size and sanitization;
- content-script/background message authorization;
- malicious page `postMessage` and DOM input;
- social acquisition/saved-authority semantics;
- GitHub mode/confirmation behavior;
- device credential and endpoint handling;
- service-worker suspension/restart queue recovery;
- idempotent submission and uncertain outcome reconciliation;
- out-of-order operation updates;
- CSP/no-remote-code release checks;
- Chromium and Firefox compatibility where supported;
- packaged-extension smoke tests.

Use synthetic pages/fixtures. Never test with real provider credentials, private pages, or personal selected text in committed fixtures.

## Cross-repository change rules

Use a workspace changeset when changing:

- Platform capture/device/operation APIs;
- social/GitHub capture contracts;
- capabilities used to render modes;
- mobile/web shared UX semantics;
- backend deep links;
- permissions or native-messaging integration.

List client compatibility, backend rollout, old-extension behavior, privacy/permission impact, and rollback.

## Git and PR workflow

- State which surfaces change: manifest, popup, options, background, content script, storage, API client, or packaging.
- Include before/after permission analysis.
- Keep permission expansion separate from unrelated UI refactors.
- Include queue/message/security tests.
- Do not add provider cookie/history/network interception.
- Do not commit device tokens, private URLs, captured selections, screenshots with private data, or production endpoints unless intentionally public configuration.
- Do not claim native bookmark/Saved state from explicit captures.
- Update README/store-facing permission documentation when behavior changes.

## Completion criteria

A task is complete only when:

- capture remains explicit and user-initiated;
- permissions are the minimum required and documented;
- payloads exclude cookies, history, hidden traffic, and unnecessary page content;
- page/content-script messages cannot invoke privileged actions without validation;
- device authentication and endpoint handling are safe;
- queue/idempotency survive worker/browser restarts;
- social/GitHub provenance and external-write confirmation remain truthful;
- operation status handles duplicates, ordering, partial success, and failures;
- CSP/supply-chain/privacy constraints hold;
- relevant browser, packaged, queue, and security tests pass;
- contracts and cross-repository rollout are documented.
