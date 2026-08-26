# extension-message-protocol Specification

## Purpose

Defines the safe, typed runtime boundary between Ratatoskr extension surfaces without allowing a page or an unknown extension message to trigger privileged worker behavior.

## Requirements

### Requirement: Versioned extension message contract

The extension SHALL use one discriminated, protocol-versioned message contract for popup-to-worker, worker-to-content-script, and content-script-to-worker exchanges. Every accepted message SHALL declare the first protocol version, a known message type, and only the fields defined for that type.

#### Scenario: Known popup request round-trips through the worker

- **WHEN** the popup sends a valid known message with the first protocol version
- **THEN** the worker returns the documented reply variant with the same protocol version

#### Scenario: Known content-script request is handled by the worker

- **WHEN** the content script sends a valid known message with the first protocol version
- **THEN** the worker produces only the documented reply or rejection for that request type

### Requirement: Fail-closed message validation

The service worker and content script SHALL reject unknown protocol versions, unknown message discriminants, malformed payloads, and messages from an unexpected extension sender/context. Rejection SHALL expose a stable safe error code and SHALL NOT disclose credentials, queued captures, or page-private data.

#### Scenario: Unknown message type is rejected

- **WHEN** a runtime message declares an unrecognized type
- **THEN** the receiving extension surface returns the stable unknown-message rejection

#### Scenario: Unexpected sender is rejected before processing

- **WHEN** the worker receives an otherwise valid content-originated message from an unexpected sender/context
- **THEN** it rejects the message without invoking a privileged action

### Requirement: Exhaustive surface handling

Each protocol receiver SHALL handle every allowed incoming discriminant exhaustively at compile time, so adding a message type cannot silently fall through to a default action.

#### Scenario: Protocol union expands

- **WHEN** a new message discriminant is added to a receiver's accepted union without a matching handler
- **THEN** the TypeScript type check fails

### Requirement: Explicit content-script activation

The extension SHALL not register a persistent content script or a page-level message bridge. Any future content-script exchange SHALL occur only after an explicit extension user action and SHALL use the extension-runtime protocol rather than page `postMessage` input.

#### Scenario: Package manifest is inspected

- **WHEN** the extension manifest is inspected
- **THEN** it contains no static content-script declaration and no persistent page host access
