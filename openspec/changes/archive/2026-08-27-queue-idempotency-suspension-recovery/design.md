## Context

See [proposal.md](proposal.md). Capture drafts are currently constructed and locally staged, but no
draft survives a worker lifecycle as a deliverable request. The manifest already grants `storage`;
there is no Platform submission client yet, so queue orchestration must remain behind an injected
submitter and must not invent a Platform contract.

## Goals / Non-Goals

**Goals:**

- Make an intentional capture durable before an asynchronous submission attempt.
- Recover safely after a worker is recreated at any asynchronous boundary.
- Give the options page truthful, minimal queue state through the existing authenticated extension
  message boundary.
- Make retry timing deterministic under an injected test clock/random source while adding bounded
  jitter in the browser.

**Non-Goals:**

- Platform authentication, endpoint configuration, actual HTTP request shape, operation-progress
  polling, editing/deleting queue items, notifications, or any provider interaction.
- Persistent page observation, host permissions, content-script changes, cookie/history access, or
  treating duplicate transport attempts as a local exactly-once guarantee.

## Decisions

### `chrome.storage.local` snapshot behind a queue-store boundary

The queue will use `chrome.storage.local`, not sync storage or IndexedDB, through a small
asynchronous `QueueStore` interface. Its single queue snapshot will contain a bounded list of
minimized items, so a record and every state transition can be written before the next async
boundary. This keeps the first implementation browser-native, needs no dependency or migration
tooling, and is easy to replace behind the interface if size or transactional requirements grow.

IndexedDB was considered for transactional records, but adds a browser database surface before the
queue has large payloads or concurrent writer requirements. `storage.sync` was rejected because
captures and retry state must remain local to this browser profile.

### Persisted capture identity and attempt lease

Enqueue creates a random local capture ID and a random idempotency key once, then stores both with
the minimized draft. A queue processor first persists `submitting` plus a unique attempt token and
lease expiry, then invokes its submitter. It accepts a completion only when the token still matches
the persisted item, preventing a delayed callback from an old worker from overwriting recovered
state.

At worker startup and an alarm wake, expired/incomplete `submitting` records are made eligible for
retry. A retry reuses the persisted key. A client cannot guarantee one network invocation across a
crash after the server has received a request and before local persistence; the guarantee is one
remote accepted effect from the idempotent submitter. A local in-memory promise lock was rejected
because it vanishes on suspension.

### Explicit retry scheduler and outcome classification

The processor will schedule the earliest eligible record with `chrome.alarms` and also resume due
records on worker startup. Retryable outcomes persist attempt count and `nextRetryAt` using a capped
exponential delay with bounded jitter; a valid submitter retry hint overrides the calculated delay.
Permanent validation/policy outcomes persist a terminal failure and do not get an alarm. Outcomes
are stable local categories, never raw server messages.

A one-off timer was rejected because it dies with the MV3 worker. Replaying all items immediately
was rejected because it ignores backoff and can repeatedly overload an unavailable endpoint.

### Read-only, safe options projection through the worker

The options page will request a queue summary using a new validated protocol message. The worker
will project only local ID, status, attempt count, next retry time, and stable safe outcome; it will
not expose drafts, selections, notes, credentials, or raw URLs. The page will render with
`textContent` and has no write controls in this slice.

Direct options-page storage access was rejected because the worker is the queue authority and a
single projection makes future privacy controls reviewable.

### Testable browser adapters

Queue clock, random source, storage adapter, alarm adapter, capture ID/key generator, and submitter
will be injected at the queue boundary. Tests will share one fake durable storage instance across
two processor instances to model old-worker loss and new-worker recovery. The fake submitter will
deduplicate accepted effects by idempotency key, exercising the real failure window instead of
claiming impossible exactly-once transport.

## Risks / Trade-offs

- [A worker dies after remote acceptance but before local completion] → Recovery may make another
  transport request, but it uses the same key and the submitter records one accepted effect.
- [Storage quota is exceeded] → Enforce record count and payload-size limits before enqueue and
  return a safe local error without silently discarding existing items.
- [An alarm is delayed by the browser] → Persisted retry eligibility is authoritative; startup and
  any later wake process due records without losing them.
- [Future Platform result shape differs] → Keep the first submitter interface local and translate
  it only in the later Platform-client change.

## Migration Plan

1. Add the failing queue, recovery, backoff, protocol, manifest, and options tests described in
   `tasks.md`; verify each new behavior test fails for the missing behavior.
2. Implement the storage-backed queue, processor, browser alarm adapter, protocol projection, and
   read-only options list; keep all state local and versionless under the current development rules.
3. Run the product gate and both strict/archived OpenSpec validations, then inspect the package and
   permission diff. Rollback removes the queue module, `alarms` permission, options projection, and
   associated tests; local queue records are then inaccessible but no remote contract is changed.
