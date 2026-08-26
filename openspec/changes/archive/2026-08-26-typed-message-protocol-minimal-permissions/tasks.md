## 1. Worker protocol contract

- [x] 1.1 Add `tests/message-protocol.test.ts` with failing missing-module assertions for known popup and content-script protocol round-trips, unknown-version/type rejection, malformed-message rejection, and an `assertNever`-based compile-time exhaustive receiver check; run the test and `npm run typecheck` to confirm failure is caused by the absent protocol module.
- [x] 1.2 Implement the shared version-1 discriminated unions, strict runtime decoder, safe rejection replies, sender-context validation, and exhaustive popup/worker dispatch in `src/protocol/` and affected adapters; rerun `tests/message-protocol.test.ts` and `npm run typecheck` to confirm they pass.

## 2. Content-script protocol boundary

- [x] 2.1 Add `tests/content-message-handler.test.ts` with failing missing-module assertions that the content-script receiver exhaustively handles its documented worker message and rejects unknown or page-originated input without a `window.postMessage` bridge; run the targeted test and confirm failure is caused by the absent handler.
- [x] 2.2 Implement the ephemeral extension-runtime content-script handler and its worker-directed adapter without registering a static content script; rerun `tests/content-message-handler.test.ts` and confirm it passes.

## 3. Permission baseline and rationale

- [x] 3.1 Extend `tests/manifest.test.ts` or add `tests/permission-rationale.test.ts` with failing assertions that the manifest contains exactly `activeTab`, `contextMenus`, and `storage`, has no host or static content-script entries, and that the committed rationale table accounts for every permission and excluded broad grant; run the targeted test and confirm the missing `storage` permission/rationale causes failure.
- [x] 3.2 Add `storage` to `src/manifest.json` and a committed permission-rationale table documenting plan-item ownership, purpose, no-host baseline, and excluded broad grants; rerun the targeted permission test and confirm it passes.

## 4. Integrated verification

- [x] 4.1 Run `npm run gate`, `openspec validate --all --strict`, and `openspec validate --archived`; inspect the final diff to confirm no persistent host permission, static content script, `window.postMessage` bridge, networking, credential access, queue, or unrelated change was introduced.
