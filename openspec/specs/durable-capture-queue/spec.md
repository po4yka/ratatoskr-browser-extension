# durable-capture-queue Specification

## Purpose

Provides durable, bounded delivery of an explicitly staged capture despite MV3 service-worker
suspension, while preserving a truthful local record of each request's delivery outcome.

## Requirements

### Requirement: Capture is durably identified before submission

The extension SHALL persist a queue record before attempting delivery for an explicitly staged
capture. The record SHALL contain a locally generated capture identifier and idempotency key that
remain unchanged for every retry and recovery of that capture. A new intentional capture SHALL
receive a distinct identifier and key.

#### Scenario: Retry retains the staged capture identity

- **WHEN** a queued capture has a retryable delivery outcome
- **THEN** its later attempt uses the same persisted capture identifier and idempotency key

### Requirement: Interrupted delivery is recovered without duplicate effects

The extension SHALL persist an in-flight delivery claim before invoking a submitter and SHALL
recover an uncompleted claim after service-worker restart. Recovery SHALL submit only with the
persisted idempotency key and SHALL not present the capture as accepted until a matching outcome is
durably recorded. Repeated transport requests for an interrupted claim SHALL be safe for an
idempotent submitter and produce one accepted remote effect.

#### Scenario: Worker suspends after a submission begins

- **WHEN** a service worker is suspended after a queued item is claimed but before its accepted outcome is persisted
- **THEN** a restarted worker recovers the item with its original idempotency key and the idempotent submitter records one accepted capture effect

### Requirement: Retry and terminal outcomes are durable and bounded

The extension SHALL classify retryable and permanent delivery outcomes, persist retry attempt
count and next eligible retry time, and apply bounded exponential backoff with jitter unless a
valid server retry hint is later. It SHALL record permanent failures as terminal and SHALL NOT
automatically retry them.

#### Scenario: Retryable outcomes advance backoff

- **WHEN** consecutive retryable outcomes are recorded for a capture
- **THEN** each persisted next retry time advances according to the configured bounded backoff and the idempotency key remains unchanged

#### Scenario: Permanent outcome is recorded

- **WHEN** a submitter reports a permanent validation or policy outcome
- **THEN** the queue records a terminal state and schedules no automatic retry

### Requirement: Queue retention is bounded without silent discard

The extension SHALL reject a new capture that exceeds the configured record-count or minimized
payload-size limit without discarding an existing item. It SHALL record a terminal local outcome
when a retained item exceeds its configured retry-count or retention-age limit and SHALL NOT
schedule another automatic retry for that item.

#### Scenario: New capture exceeds queue capacity

- **WHEN** an explicit capture would exceed the configured queue count or item-size limit
- **THEN** the extension rejects that capture and leaves all existing queue records unchanged

#### Scenario: Retried capture reaches its limit

- **WHEN** a retryable capture reaches its configured retry-count or retention-age limit
- **THEN** the extension records a terminal local outcome and does not schedule another retry

### Requirement: Queue transitions preserve concurrent explicit captures

The extension SHALL serialize local queue transitions that originate in the same live extension
worker so concurrent explicit capture actions cannot overwrite one another's durable records.

#### Scenario: Two explicit actions enqueue concurrently

- **WHEN** two explicit capture actions enqueue distinct drafts before either storage write completes
- **THEN** the durable queue retains both records with their distinct identifiers

### Requirement: Queue state is safely inspectable in options

The options page SHALL show the user a read-only summary of each retained queue item including its
local status, attempt count, next retry time when applicable, and terminal outcome. The summary
SHALL exclude credentials, selected text, notes, and unredacted sensitive URL query values.

#### Scenario: User opens queue inspection

- **WHEN** the options page requests the queue summary through the extension runtime boundary
- **THEN** it displays the durable state of retained items without exposing excluded capture content or credentials
