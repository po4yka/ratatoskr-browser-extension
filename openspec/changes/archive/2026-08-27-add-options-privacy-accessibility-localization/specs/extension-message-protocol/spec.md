## ADDED Requirements

### Requirement: Options controls use a closed trusted-page protocol

Preferences, paired-device inspection, diagnostics creation, device revocation, and clear-all SHALL use validated first-version runtime messages with closed request and reply shapes. The worker SHALL accept destructive and sensitive options requests only from the extension's own options-page URL, return safe result codes rather than stored records or raw errors, and handle every new discriminant exhaustively.

#### Scenario: Trusted options page reads safe state

- **WHEN** the packaged options page sends a valid state-inspection request
- **THEN** the worker returns only the documented preference, public paired-device, and redacted queue fields

#### Scenario: Popup cannot invoke destructive options control

- **WHEN** an otherwise valid revoke or clear-all message comes from the popup, a content script, another extension page, or a sender with unexpected fields
- **THEN** the worker rejects it before network or storage work with a stable safe protocol error

#### Scenario: Unknown options message fails closed

- **WHEN** an options-page message uses an unknown discriminant, extra field, or unsupported protocol version
- **THEN** the worker performs no state change and returns only a stable protocol error
