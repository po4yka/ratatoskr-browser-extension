## 1. Fleet contract prerequisite

- [ ] 1.1 In `ratatoskr-workspace`, add a failing Platform/contract test that submits a social
  capture with owner, original permalink, capture time, `browser_extension`, and
  `explicit_user_capture`, and asserts it is routed to the owning social command rather than
  `content.capture.requested.v1`.
- [ ] 1.2 Implement and publish that one-version workspace contract, generated Platform client,
  Platform route, and typed social unavailable/partial operation-result values; verify the
  contract and Platform gates pass and the social owners consume the command.

## 2. Social classification

- [ ] 2.1 Add `tests/social-capture-routing.test.ts` with a failing, table-driven classifier test
  covering valid X, Instagram, and Threads post permalinks plus article, profile, lookalike-host,
  and unsupported-shape fallbacks; verify it fails only because classification is absent.
- [ ] 2.2 Implement the pure conservative classifier and draft routing needed for 2.1; verify the
  new classification test passes and recognized social drafts cannot take the generic article path.

## 3. Social submission provenance

- [ ] 3.1 Add a failing Platform-client/queue submission test that expects the generated social
  request to retain original URL, stable idempotency key, social owner, capture time,
  `browser_extension`, and `explicit_user_capture` through a retry while excluding page and
  credential data; verify it fails before the client change.
- [ ] 3.2 Implement the social submission path against the published fleet contract and propagate
  the immutable provenance through queue retries; verify the provenance test and existing generic
  article submission tests pass.

## 4. Truthful social outcomes

- [ ] 4.1 Add failing operation-panel tests for an unavailable/deleted social snapshot and for a
  partial snapshot containing a preserved post plus failed linked-article extraction; verify they
  fail because the current panel only renders generic status and warnings.
- [ ] 4.2 Validate typed social operation results at the Platform boundary and render unavailable
  and partial outcomes without reader links or false success; verify the new outcome tests and
  existing operation-tracker tests pass.

## 5. Documentation and full validation

- [ ] 5.1 Update README and permission rationale to document the social route, explicit-capture
  provenance, unavailable/partial wording, and unchanged permission set; documentation cannot
  start from a failing behavioral test, so verify the rendered text and permission tests instead.
- [ ] 5.2 Run `openspec validate --all --strict`, `npm run gate`, and the workspace contract/Platform
  gates after their rollout; verify every command is green before merging the extension change.
