# device-pairing Specification

## Purpose

Provides explicit, revocable Ratatoskr device identity for the extension while keeping device
credentials out of pages, content scripts, and synchronized browser storage.

## Requirements

### Requirement: Pairing exchanges an explicit primary-session code

The extension SHALL begin pairing only after an explicit options-page action. It SHALL accept a
one-time code created in the user's authenticated primary Platform session, request only the exact
HTTPS endpoint origin, and exchange the code through Platform's device-pair endpoint. It SHALL
store a successful device identity only for that exact origin and SHALL expose no secret in UI.

#### Scenario: Explicit pairing code becomes a paired device

- **WHEN** the user explicitly supplies a live primary-session pairing code
- **THEN** the extension reports the paired device identity for the configured origin without
  exposing either credential to UI or page contexts

#### Scenario: Refused or origin-mismatched code does not pair

- **WHEN** a code fixture is refused, expired, spent, malformed, or belongs to another HTTPS origin
- **THEN** the extension remains unpaired and reports only the corresponding safe pairing state

### Requirement: Device credentials remain in the privileged boundary

The extension SHALL store device access and refresh credentials only in non-sync extension storage
with the strongest available trusted-context access restriction. Only the service worker's device
credential boundary SHALL read, write, refresh, or clear them. Runtime protocol replies, page
contexts, content scripts, diagnostics, and exported settings SHALL NOT contain credential values.

#### Scenario: Content-script request cannot obtain a credential

- **WHEN** a content script or page-derived runtime message asks for device credentials or pairing
  secret data
- **THEN** the extension rejects it with a stable safe protocol error and neither executes a
  credential read nor returns credential data

### Requirement: Refresh is serialized through queued delivery

The queue submission path SHALL obtain authorization through the device credential boundary. When
the access credential requires refresh, concurrent submissions SHALL share one refresh exchange and
each resumed request SHALL use the resulting credential. A refresh failure that is retryable SHALL
leave the device paired and return a retryable submission outcome without disclosing credentials.

#### Scenario: Concurrent queued submissions share one refresh

- **WHEN** two queued submissions require refresh before Platform accepts them
- **THEN** the extension performs one refresh exchange and both submissions use its resulting
  authorization without persisting a duplicate refresh operation

### Requirement: Revoked devices degrade cleanly to logged out

When Platform rejects an authorization or refresh because the paired device is revoked, the
extension SHALL clear its local credential record, report a logged-out action-required state, and
not retry the rejected delivery automatically. A later explicit pairing action SHALL be able to
establish a new device identity.

#### Scenario: Revocation during delivery clears the device state

- **WHEN** Platform reports that the queued submission's paired device is revoked
- **THEN** the extension deletes the credential record, records a non-retryable authentication
  outcome for that delivery, and exposes only logged-out state
