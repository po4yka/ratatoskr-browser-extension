## 1. Pairing handshake and credential boundary

- [x] 1.1 Add `tests/platform-identity.test.ts` pairing-code/refresh fixtures and observe its missing-module failure.
  and pending/rejected/expired/origin-mismatched fixture matrix assertions; run it and confirm the
  expected missing identity-boundary failure.
- [x] 1.2 Implement worker-only Platform pairing-code/refresh HTTP client and verify its fixture test passes.
  safe connection-state projection in `src/auth/`; rerun `tests/device-pairing.test.ts` and verify
  the matrix passes.
- [x] 1.3 Update manifest and permission-rationale tests for optional exact-origin HTTPS access.
  only trusted non-sync storage and that a content-script-origin request cannot obtain a credential;
  run it and confirm the expected absent boundary/unknown-message failure.
- [x] 1.4 Implement explicit options pairing form, exact-origin optional host grant, worker message, and trusted storage initialization.
  rerun `tests/credential-boundary.test.ts` and verify no credential value is returned or read for
  content-script messages.

## 2. Queued authorization and revocation

- [x] 2.1 Preserve the existing failing-test single-flight coverage in `tests/device-pairing.test.ts`.
  `tests/device-pairing.test.ts`; run it and confirm it observes multiple or missing refreshes
  before authorization integration exists.
- [x] 2.2 Wire the queue through the authorization wrapper and Platform refresh client.
  rerun `tests/device-pairing.test.ts` and verify concurrent submissions make exactly one refresh.
- [x] 2.3 Preserve revocation terminal-outcome coverage in pairing and queue tests.
  `tests/device-pairing.test.ts` and `tests/durable-queue-auth.test.ts`; run them and confirm the
  missing logged-out/terminal transition.
- [x] 2.4 Map Platform 401 to typed revocation, credential clearing, and a non-retryable queue outcome.
  tests and verify the credential record is absent, safe state is logged out, and delivery is not
  retried.

## 3. Integrated verification

- [x] 3.1 Run the focused pairing, credential-boundary, and durable-queue tests, then
  `npm run gate`, `openspec validate --all --strict`, and `openspec validate --archived`; inspect
  the final diff for tokens, `localStorage`, `storage.sync`, content-script credential imports,
  provider permissions, or untracked generated artifacts. This verification task cannot start
  from a failing test because it checks integrated configuration and release boundaries.
