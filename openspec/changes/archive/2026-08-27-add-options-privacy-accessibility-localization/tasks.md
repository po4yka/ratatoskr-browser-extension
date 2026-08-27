## 1. Options state and default capture mode

- [x] 1.1 Add `tests/options-state.test.ts` with `uses the saved default mode without automatic submission` and `projects only safe queue and paired-device fields`; run `npm test -- tests/options-state.test.ts` and confirm the mode/store/protocol assertions fail because the new options state boundary does not exist
- [x] 1.2 Implement the validated preference repository, trusted options state protocol, safe queue/device projection, options controls, and popup mode group; run `npm test -- tests/options-state.test.ts tests/options-queue.test.ts tests/message-protocol.test.ts tests/popup-markup.test.ts` and confirm they pass

## 2. Remote device revocation

- [x] 2.1 Add `tests/device-revocation.test.ts` with `revokes only the stored device at the paired origin`, `clears credentials only after confirmed or already-unauthorized revoke`, and `retains credentials after an unconfirmed failure`; run `npm test -- tests/device-revocation.test.ts` and confirm the missing revoke client/controller assertions fail
- [x] 2.2 Implement the authenticated redirect-blocked Platform revoke request and fail-closed credential-boundary controller; run `npm test -- tests/device-revocation.test.ts tests/platform-identity.test.ts tests/credential-boundary.test.ts tests/durable-queue-auth.test.ts` and confirm they pass

## 3. Double-confirmed destructive controls

- [x] 3.1 Add `tests/destructive-confirmations.test.ts` with `dispatches revoke only after two confirmations`, `dispatches clear-all only after two confirmations`, and `cancel restores focus without dispatch`; run `npm test -- tests/destructive-confirmations.test.ts` and confirm the dialog-flow assertions fail because the two-stage controller and markup are absent
- [x] 3.2 Implement sequential named native dialogs for revoke and clear-all, pending-action deduplication, cancel behavior, and focus restoration; run `npm test -- tests/destructive-confirmations.test.ts` and confirm every action and keyboard/focus path passes

## 4. Complete local data erasure

- [x] 4.1 Add `tests/clear-data.test.ts` with `clear-all removes every extension-owned residue after revocation`, `paired clear-all stops before erasure when revoke is unconfirmed`, and `partial cleanup never reports complete`; assert local/session/sync storage, tracked operations, queue/preferences/credentials, alarms, optional origins, and volatile support state are all covered, then run `npm test -- tests/clear-data.test.ts` and confirm the completeness assertions fail because no cleanup coordinator exists
- [x] 4.2 Implement the revoke-first clear-data coordinator, all storage-area cleanup, queue-alarm and optional-origin removal, volatile reset, partial-result reporting, and worker protocol handler; run `npm test -- tests/clear-data.test.ts tests/durable-queue.test.ts tests/operation-tracker.test.ts tests/device-revocation.test.ts` and confirm they pass

## 5. Redacted diagnostics export

- [x] 5.1 Add `tests/diagnostics-redaction.test.ts` with `default export contains only allowlisted aggregate fields`, `hostile nested URL token and user-content values never escape`, `support-session toggle includes only labeled URL fields`, and `support inclusion is not persisted`; run `npm test -- tests/diagnostics-redaction.test.ts` and confirm the allowlist/redaction assertions fail because diagnostics are not implemented
- [x] 5.2 Implement the typed allowlist diagnostics builder, aggregate safe-state inputs, volatile URL opt-in, visibly sensitive JSON export, and local Blob download flow; run `npm test -- tests/diagnostics-redaction.test.ts tests/credential-boundary.test.ts tests/options-state.test.ts` and confirm all default, sensitive-session, and secret-exclusion paths pass

## 6. Localization-ready packaging

- [x] 6.1 Add `tests/localization-readiness.test.ts` with `every manifest and surface message key resolves`, `behavior entry points contain no user-visible English or Russian sentence`, and `packaged catalog is complete`; run `npm test -- tests/localization-readiness.test.ts` and confirm the catalog/reference/package assertions fail because strings are still inline
- [x] 6.2 Add the source-language WebExtension message catalog, typed `chrome.i18n` adapter, manifest message references, markup attributes, parameterized dynamic messages, and deterministic catalog copying; run `npm test -- tests/localization-readiness.test.ts tests/build-artifacts.test.ts tests/package-determinism.test.ts` and confirm they pass without adding a translation locale or dependency

## 7. Accessibility baseline

- [x] 7.1 Add `tests/accessibility-checklist.test.ts` with `popup passes the plan-item-9 accessibility checklist` and `options passes the plan-item-9 accessibility checklist`; require localized document language, main landmark, heading order, named controls/groups/dialogs, descriptions, live regions, non-negative tab order, and shared focus styling, then run `npm test -- tests/accessibility-checklist.test.ts` and confirm the checklist fails on the current surfaces
- [x] 7.2 Apply the semantic markup, accessible names/descriptions, live-region urgency, shared visible-focus/reduced-motion styles, and dialog focus behavior across popup and options; run `npm test -- tests/accessibility-checklist.test.ts tests/destructive-confirmations.test.ts tests/popup-markup.test.ts` and confirm the named checklist and interaction results pass

## 8. Documentation, regression gate, and delivery evidence

- [x] 8.1 Update README, architecture/data-model/testing/privacy documentation, permission analysis, and plan status for the delivered options/data/diagnostics/a11y/i18n behavior; no failing test starts this documentation task because it records already-tested behavior, then verify `rg -n "options|revoke|clear|diagnostic|accessib|local" README.md docs`
- [x] 8.2 Run the focused plan-item-9 suite, `openspec validate --all --strict`, and `openspec validate --archived`; fix only in-scope failures and record the observed results
- [x] 8.3 Run the full product gate through the shared machine slot with `build-gate -- npm run gate`, inspect the final diff and packaged manifest/assets for scope, permission, privacy, and localization regressions, and mark complete only after every command is observed green
