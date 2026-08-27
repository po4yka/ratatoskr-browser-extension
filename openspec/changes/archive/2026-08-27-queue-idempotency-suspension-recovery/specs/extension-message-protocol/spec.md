## MODIFIED Requirements

### Requirement: Versioned extension message contract

The extension SHALL use one discriminated, protocol-versioned message contract for popup-to-worker,
options-to-worker, worker-to-content-script, and content-script-to-worker exchanges. Every accepted
message SHALL declare the first protocol version, a known message type, and only the fields defined
for that type. A valid extension-page queue-inspection request SHALL receive only the documented
safe queue-summary reply or a stable rejection.

#### Scenario: Known popup request round-trips through the worker

- **WHEN** the popup sends a valid known message with the first protocol version
- **THEN** the worker returns the documented reply variant with the same protocol version

#### Scenario: Known content-script request is handled by the worker

- **WHEN** the content script sends a valid known message with the first protocol version
- **THEN** the worker produces only the documented reply or rejection for that request type

#### Scenario: Options queue inspection round-trips through the worker

- **WHEN** an extension options page sends a valid queue-inspection request with the first protocol version
- **THEN** the worker returns only the documented safe queue-summary reply with the same protocol version

### Requirement: Fail-closed message validation

The service worker and content script SHALL reject unknown protocol versions, unknown message
discriminants, malformed payloads, and messages from an unexpected extension sender/context.
Rejection SHALL expose a stable safe error code and SHALL NOT disclose credentials, queued captures,
or page-private data. A queue-inspection reply SHALL expose only the documented safe summary fields.

#### Scenario: Unknown message type is rejected

- **WHEN** a runtime message declares an unrecognized type
- **THEN** the receiving extension surface returns the stable unknown-message rejection

#### Scenario: Unexpected sender is rejected before processing

- **WHEN** the worker receives an otherwise valid content-originated message from an unexpected sender/context
- **THEN** it rejects the message without invoking a privileged action

#### Scenario: Malformed queue inspection request is rejected

- **WHEN** the worker receives a queue-inspection request with unexpected fields or an unexpected sender
- **THEN** it rejects the request without reading or returning queue state
