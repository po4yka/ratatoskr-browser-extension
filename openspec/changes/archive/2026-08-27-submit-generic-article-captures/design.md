## Context

The durable queue already owns local capture identity and recovery, while Platform accepts only a
URL plus an idempotency header and exposes operation snapshots. The popup currently stages a draft
without a delivery choice. See proposal.md and the `operation-progress` workspace spec.

## Goals / Non-Goals

**Goals:**

- Keep queue identity as the one submission idempotency source.
- Make tracked status restart-safe and monotonic from Platform snapshots.
- Form reader links only from the published document result convention.

**Non-Goals:**

- New Platform endpoints, contracts, browser permissions, server-sent-event parsing, extraction,
  analysis, or any page-content upload.

## Decisions

### D1. Use the published JSON endpoints with polling

The worker will call `POST /v1/captures` and poll `GET /v1/operations/{id}` through a narrow
authenticated adapter. Polling is the permitted SSE-equivalent and survives MV3 suspension without
requiring a long-lived stream. SSE is rejected for this slice because it adds lifecycle and parser
recovery machinery without improving the required observed state.

### D2. Persist minimal tracking records beside durable queue data

The queue record will retain its selected mode and accepted operation identifier. A small tracking
projection stores only capture/operation identity and safe lifecycle display fields, never raw
operation result bodies, selected text, or credentials. A worker restart reconstructs active tracked
records from accepted queue items and polls again.

### D3. Model delivery and observation separately

Quick save ends its popup flow at durable queueing. Tracked save reads the same delivery record but
continues through Platform snapshots. A terminal retry creates a fresh queue record, so it cannot
reuse the idempotency key of an already terminal operation.

### D4. Only known document results produce reader links

The reader URL is resolved against the configured HTTPS endpoint only when a terminal successful
snapshot includes `result_kind: content.document` and a bounded `document:<id>` target. Other
results remain truthful terminal references; the extension never navigates to arbitrary server data.

## Risks / Trade-offs

- [A worker suspends between acceptance and tracking] → persist the operation identifier in the
  queue acceptance transition, then reconstruct the tracked projection at startup.
- [Polling fails transiently] → retain the last safe snapshot and retry on the next wake-up; do not
  downgrade a terminal snapshot.
- [Platform returns unknown status or malformed fields] → reject the snapshot locally and render a
  safe tracking error rather than guessing.

## Migration Plan

Existing queued entries deserialize as quick-save records and retain their current retry behavior.
Rollback removes the client version; Platform captures are already durable and need no schema or API
migration.
