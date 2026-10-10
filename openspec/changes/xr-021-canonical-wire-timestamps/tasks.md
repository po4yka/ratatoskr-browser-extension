## 1. Canonical formatter and draft stamping

- [x] 1.1 Add `tests/wire-timestamp.test.ts` with `formats every millisecond value of a second canonically` (the oracle comparison over 0..999 and the `/\.\d*0Z$/` exclusion) and `stamps a social draft with a canonical captured_at` (clock fixed at 120 ms, expects `:00.12Z`), plus a signature-only `src/protocol/wire-timestamp.ts`; run the file and confirm both tests fail on their assertions.
- [x] 1.2 Implement `formatWireTimestamp` and use it in `socialCapture()` in `src/capture/draft.ts`; rerun `tests/wire-timestamp.test.ts` and confirm both tests pass.

## 2. Strict draft validation

- [x] 2.1 Add `rejects non-canonical and accepts canonical draft timestamps` to `tests/wire-timestamp.test.ts` (`isCaptureDraft` rejects `.120Z` and `.100Z`, accepts `.12Z`, `.1Z` and `Z`); run it and confirm it fails because the current validator accepts `.120Z`.
- [x] 2.2 Implement `isCanonicalWireTimestamp` per CONTRACTS.md S10 CD4 and use it in `src/protocol/validation.ts` in place of `isCanonicalTimestamp`; rerun and confirm it passes.

## 3. Repair at the wire edge

- [x] 3.1 Add `repairs a queued non-canonical captured_at when submitting` and `fails permanently when captured_at is not a UTC instant` to `tests/wire-timestamp.test.ts`; run them and confirm they fail because `submit` forwards the stored string unchanged.
- [x] 3.2 Implement `canonicalizeWireTimestamp` and call it in `submit()` in `src/capture/platform-client.ts`, throwing `PlatformCaptureError('permanent')` before any request when it returns `undefined`; rerun and confirm both pass.

## 4. Full validation

- [ ] 4.1 Run `npm run gate`, `openspec validate --all --strict` and `openspec validate --archived`, then archive the change; a gate run cannot start from a failing test.
