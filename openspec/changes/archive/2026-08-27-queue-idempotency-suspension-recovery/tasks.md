## 1. Durable queue identity and storage

- [x] 1.1 Add `tests/durable-queue.test.ts` with `persists an idempotency key before submission and reuses it after retry`; run `npx vitest run tests/durable-queue.test.ts` and confirm the test fails because the durable queue module is absent.
- [x] 1.2 Implement the bounded `chrome.storage.local` queue-store boundary, minimized record model, injected identifier/key generator, and enqueue/claim/complete transitions in `src/queue/`; rerun `npx vitest run tests/durable-queue.test.ts` and confirm the stable-ID/key test passes.

## 2. Suspension recovery and idempotent delivery

- [x] 2.1 Extend `tests/durable-queue.test.ts` with `recovers a claimed submission after simulated worker suspension with one accepted fake-API effect`; run it and confirm the recovery assertion fails because a new processor cannot recover the interrupted durable record.
- [x] 2.2 Implement persisted attempt-token leases, startup recovery, and stale-completion protection in the queue processor; rerun `npx vitest run tests/durable-queue.test.ts` and confirm the simulated old-worker/new-worker test passes while the fake API observes one accepted effect for the stable key.

## 3. Retry scheduling and terminal outcomes

- [x] 3.1 Extend `tests/durable-queue.test.ts` with `persists bounded exponential retry backoff and does not reschedule permanent outcomes`; run it and confirm the expected retry times and terminal-state assertions fail before retry classification exists.
- [x] 3.2 Implement injected clock/random backoff, retry-hint handling, permanent-outcome recording, and `chrome.alarms` scheduling/recovery adapters; rerun `npx vitest run tests/durable-queue.test.ts` and confirm backoff progression, stable key reuse, and no permanent retry pass.
- [x] 3.3 Extend `tests/durable-queue.test.ts` with `rejects an oversized capture without discarding retained items` and `records retry exhaustion as terminal`; run it and confirm the capacity and retry-limit assertions fail before retention bounds are implemented.
- [x] 3.4 Enforce record-count, payload-size, retention-age, and retry-count bounds in `src/queue/`; rerun `npx vitest run tests/durable-queue.test.ts` and confirm rejected inputs preserve existing items and exhausted items schedule no retry.

## 4. Worker and options inspection boundary

- [x] 4.1 Add failing protocol/options/manifest assertions in `tests/message-protocol.test.ts`, `tests/manifest.test.ts`, and a new `tests/options-queue.test.ts`: `returns a safe queue summary to an extension page`, `requests only the reviewed alarms permission`, and `renders queue state without draft content`; run those files and confirm each fails for its missing message, permission, or UI surface.
- [x] 4.2 Wire durable staging/recovery and due-alarm handling through `src/background/service-worker.ts`, add validated options queue-summary messages and projection, add the read-only options queue list, request `alarms`, and update `docs/PERMISSIONS.md`, `README.md`, and `DEVELOPMENT.md`; rerun the targeted tests and confirm they pass with no host permissions, cookie/history access, provider access, or raw capture-content exposure.
- [x] 4.3 Add `tests/durable-queue-concurrency.test.ts` with `retains concurrent explicit captures`; run it and confirm the two-enqueue assertion fails because independent storage reads overwrite one snapshot.
- [x] 4.4 Serialize queue operations in `src/queue/queue.ts`; rerun `npx vitest run tests/durable-queue-concurrency.test.ts` and confirm both capture records persist.

## 5. Integrated verification and lifecycle

- [x] 5.1 Run `build-gate -- npm run gate`, `openspec validate --all --strict`, and `openspec validate --archived`; inspect the final diff and packed manifest, confirm all checks pass, and record the exact results. This is broader integration validation and cannot start from a single failing behavior test.
- [x] 5.2 Verify release readiness: all preceding tasks are ticked, the full gate and strict OpenSpec validations are green, the packed manifest has only the reviewed permissions, and the user has authorized archive/commit/integration/push/cleanup. The archive and Git lifecycle are performed immediately after this prerequisite because OpenSpec requires no unticked tasks before archiving.
