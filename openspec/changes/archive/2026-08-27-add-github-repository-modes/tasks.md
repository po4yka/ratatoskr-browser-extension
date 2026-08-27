## 1. Repository URL classification

- [x] 1.1 Add `tests/github-repository-routing.test.ts` test `classifies only canonical GitHub repository roots` and run it red, with the assertion failing because no classifier or draft GitHub intent exists.
- [x] 1.2 Implement conservative repository-root classification and draft intent in `src/capture/draft.ts`; run `tests/github-repository-routing.test.ts` green and keep existing draft/social tests green.

## 2. Capability-gated preview

- [x] 2.1 Add `tests/github-repository-preview.test.ts` tests `offers the contract preview only for a current GitHub capability` and `keeps a stale or absent GitHub service unavailable`, using the canonical contract preview fixture; run them red because no GitHub client/capability projection exists.
- [x] 2.2 Implement strict capability and preview request/response validation in a dedicated GitHub client; run `tests/github-repository-preview.test.ts` green and verify requests use authenticated `/v1/capabilities` and `/v1/gh/repositories/preview` only.

## 3. Explicit confirmation gating

- [x] 3.1 Add `tests/github-action-confirmation.test.ts` tests `cancellation emits no track action`, `star confirmation is target and account bound`, and `unadvertised star cannot be confirmed`; run them red because no confirmation state model exists.
- [x] 3.2 Implement the one-shot confirmation state model for metadata/track/star; run `tests/github-action-confirmation.test.ts` green and verify track/star cannot produce an intent before confirmation.

## 4. Action request and outcome fidelity

- [x] 4.1 Add `tests/github-action-outcomes.test.ts` tests `submits the exact confirmed contract request` and `preserves a partial star and backup result`, using the canonical partial-result fixture plus malformed aggregates; run them red because action submission and component projection do not exist.
- [x] 4.2 Implement the authenticated `/v1/gh/repositories/actions` boundary, strict action-result validation, stable per-intent idempotency, and component outcome projection; run `tests/github-action-outcomes.test.ts` green without exposing device or provider credentials.

## 5. Popup and worker integration

- [x] 5.1 Extend `tests/popup-markup.test.ts` and add `tests/github-message-handler.test.ts` assertions for the metadata-preview card, separate track/star dialogs, unavailable state, extension-page sender validation, and closed messages; run them red because the popup/worker flow is absent.
- [x] 5.2 Wire repository preview/action messages through the service worker and popup, render the capability-gated card/dialogs/component results, and prevent recognized repository drafts from generic quick/tracked submission; run the focused markup, protocol, and popup/controller tests green.

## 6. Documentation and validation

- [x] 6.1 Update README with repository detection, capability absence, confirmations, component-result wording, `/v1/gh` rollout dependency, and unchanged permission analysis; documentation cannot start from a behavioral failing test, so verify `tests/permission-rationale.test.ts` and manifest snapshots instead.
- [x] 6.2 Run `openspec validate add-github-repository-modes --strict`, the focused test files, `build-gate -- npm run gate`, and contract-fixture provenance checks; review the final diff and mark tasks complete only after every named command is observed green.
