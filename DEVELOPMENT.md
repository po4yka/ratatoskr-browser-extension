# Developing Ratatoskr Browser Extension

> Status: Proposed  
> Last reviewed: 2026-08-17

Architecture bootstrap: Manifest V3 project, UI, service worker, content scripts, queue, device pairing, packaging, and CI are not implemented.

## Intended toolchain

TypeScript, WebExtensions/Manifest V3, a minimal UI framework/build tool, browser storage APIs, generated Platform API client, Web Crypto where needed, unit/browser automation tests, lint/typecheck, and deterministic packaging for Chromium and Firefox-compatible targets where feasible.

## Workflow

1. Require an explicit user action for every capture.
2. Request the smallest possible permission and host scope.
3. Minimize payload to URL, selected text, note, capture metadata, and explicit options.
4. Persist queue state before network work and use idempotency.
5. Test service-worker suspension/restart, hostile pages/messages, permission changes, offline retry, and data clearing.

The first scaffold PR must document exact install/build/typecheck/test/package/load-unpacked commands. No provider cookie or password is ever required.
