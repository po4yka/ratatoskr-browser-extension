## 1. Platform capture delivery

- [x] 1.1 Add `tests/platform-capture-client.test.ts` with a fake fetch harness whose `submits only the URL and stable idempotency key` assertion fails because no Platform capture adapter exists; run that test and confirm the missing-module failure.
- [x] 1.2 Implement the narrow authenticated Platform capture/operation adapter and queue acceptance operation-ID persistence; rerun `tests/platform-capture-client.test.ts` until it passes.

## 2. Explicit save modes

- [x] 2.1 Add `tests/article-submission-state.test.ts` covering `quick save becomes queued without waiting` and `tracked save presents acceptance and progress` with failing imports/assertions; run it and confirm the asserted state-machine gap.
- [x] 2.2 Implement the submission state machine and popup quick-save/tracked-save controls, including accessible queued and operation-panel rendering; rerun `tests/article-submission-state.test.ts` until it passes.

## 3. Tracking recovery and terminal actions

- [x] 3.1 Add `tests/operation-tracker.test.ts` with fake Platform snapshots for `restart polling recovers a terminal snapshot`, out-of-order snapshot rejection, retryable failure, and `forms a reader deep link only for a document result`; run it and confirm those assertions fail before the tracker exists.
- [x] 3.2 Implement minimal persisted tracked-operation projection, worker recovery/polling, safe terminal rendering data, and explicit new-identity retry; rerun `tests/operation-tracker.test.ts` until it passes.

## 4. Runtime integration and completion

- [x] 4.1 Add `tests/article-submission-protocol.test.ts` that exercises popup-to-worker quick/tracked submission, queueing, and safe operation-status replies through a fake API harness; run it and confirm its behavioral assertion fails before integration.
- [x] 4.2 Wire the validated runtime messages, service-worker Platform adapter, queue recovery, and popup status refresh; rerun `tests/article-submission-protocol.test.ts` until it passes.
- [x] 4.3 Update permission and development-facing documentation for the unchanged permission set and delivery behavior; no RED because this is documentation, then verify the final diff contains no permission expansion.
- [x] 4.4 Run `npm run gate`, `openspec validate --all --strict`, and `openspec validate --archived`; inspect the final diff and record observed results before marking this task complete.
