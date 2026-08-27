## Purpose

Provides one privacy-preserving place to configure capture behavior, inspect local state, disconnect the registered device, erase extension data, and export support evidence.

## ADDED Requirements

### Requirement: Options expose useful non-secret state

The extension SHALL let the user choose `quick` or `tracked` as the default capture mode, and the popup SHALL initialize its explicit capture-mode choice from that preference without submitting a capture automatically. The options page SHALL show queue identifiers, delivery modes, states, attempt counts, safe failure categories, and retry times, together with paired status, Platform origin, and public device identifier. It SHALL NOT expose capture URLs, titles, selections, notes, idempotency keys, credentials, or raw backend errors in the normal queue or device inspector.

#### Scenario: Default capture mode affects the next popup

- **WHEN** the user saves `tracked` as the default capture mode and later stages a supported capture
- **THEN** the popup selects tracked mode while requiring a separate explicit save action

#### Scenario: Queue and device inspection stays minimized

- **WHEN** the options page loads paired-device state and a queued capture containing a private URL and selection
- **THEN** it displays the public device and safe queue summary without rendering the URL, selection, note, credential, or idempotency key

### Requirement: Device revocation is deliberate and fail closed

The extension SHALL require two distinct user confirmations before sending an authenticated revoke request for its current device. It SHALL clear the local credential and report the device unpaired only after Platform confirms revocation or reports that the device is already unauthorized. A network, server, or malformed-response failure SHALL retain the credential, report that revocation was not confirmed, and allow the user to retry.

#### Scenario: Confirmed revoke disconnects the device

- **WHEN** a paired user completes both revoke confirmations and Platform confirms `DELETE /v1/devices/{device_id}`
- **THEN** the extension clears the local credential, reports the device unpaired, and does not submit another request without a new pairing

#### Scenario: Failed revoke preserves the ability to retry

- **WHEN** both revoke confirmations complete but Platform revocation fails without proving the device already unauthorized
- **THEN** the extension retains the local credential and reports that remote revocation was not confirmed

#### Scenario: One confirmation has no destructive effect

- **WHEN** the user completes only the first revoke confirmation or dismisses either confirmation
- **THEN** no revoke request is sent and no local state is removed

### Requirement: Clear all removes every extension-owned local residue

The extension SHALL require two distinct user confirmations before clear-all. If a device is paired, clear-all SHALL first meet the device-revocation requirement. It SHALL then clear extension local, session, and sync storage, pending operation bindings, queue items, preferences, in-memory support state, scheduled queue alarms, and granted optional endpoint origins. It SHALL report completion only after every cleanup step succeeds; a partial cleanup SHALL report the incomplete state without claiming that all data was cleared.

#### Scenario: Clear-all completeness

- **WHEN** the user completes both clear-all confirmations and the paired device is successfully revoked
- **THEN** every extension storage area is empty, retry alarms and optional endpoint origins are removed, volatile support state is reset, and the options page reports an unpaired empty state

#### Scenario: Clear-all is cancelled

- **WHEN** the user dismisses either clear-all confirmation
- **THEN** the extension performs no remote revocation and removes no storage, alarm, permission, or in-memory state

#### Scenario: Paired clear-all cannot orphan an active device silently

- **WHEN** clear-all cannot confirm revocation of the paired device
- **THEN** it stops before local erasure and reports that no complete clear occurred

### Requirement: Diagnostics are redacted by construction

The extension SHALL construct diagnostics from an explicit safe-field allowlist rather than serializing stored objects and filtering them afterward. Default diagnostics SHALL contain only schema and extension versions, browser family/version, paired boolean, aggregate queue state/counts, aggregate operation state/counts, safe error categories, and permission presence. Default diagnostics SHALL omit endpoint and captured URLs. Credentials, device secrets, refresh values, authorization headers, idempotency keys, titles, selections, notes, provider handles, raw errors, and other user content SHALL never be exportable.

#### Scenario: Hostile stored values cannot escape the default export

- **WHEN** extension storage contains URLs, token-shaped values, notes, selections, titles, raw errors, and unexpected nested fields
- **THEN** the default exported JSON contains none of those fields or values and contains only the documented diagnostic keys

#### Scenario: Support-session URL inclusion is explicit and volatile

- **WHEN** the user explicitly enables sensitive URL inclusion for the current options-page support session and exports diagnostics
- **THEN** the export is visibly marked sensitive and may include Platform origin and capture URLs, while still excluding every credential and user-content field

#### Scenario: Support-session inclusion resets

- **WHEN** the options page is reloaded or closed after sensitive URL inclusion was enabled
- **THEN** the next diagnostics export defaults to URL exclusion without reading a persisted opt-in
