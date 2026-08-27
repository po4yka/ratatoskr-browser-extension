## MODIFIED Requirements

### Requirement: Retry and terminal outcomes are durable and bounded

The extension SHALL classify retryable and permanent delivery outcomes, persist retry attempt
count and next eligible retry time, and apply bounded exponential backoff with jitter unless a
valid server retry hint is later. It SHALL record permanent failures as terminal and SHALL NOT
automatically retry them. A device-revoked authorization result SHALL be a permanent
action-required failure that clears the local paired-device state.

#### Scenario: Retryable outcomes advance backoff

- **WHEN** consecutive retryable outcomes are recorded for a capture
- **THEN** each persisted next retry time advances according to the configured bounded backoff and the idempotency key remains unchanged

#### Scenario: Permanent outcome is recorded

- **WHEN** a submitter reports a permanent validation or policy outcome
- **THEN** the queue records a terminal state and schedules no automatic retry

#### Scenario: Device revocation terminates a queued delivery

- **WHEN** the authorization boundary reports that Platform revoked the paired device
- **THEN** the queue records a non-retryable authentication outcome and schedules no automatic retry
