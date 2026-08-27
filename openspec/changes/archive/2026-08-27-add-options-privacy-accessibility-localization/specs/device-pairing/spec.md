## ADDED Requirements

### Requirement: The extension can revoke its paired device explicitly

The extension SHALL use its authenticated Platform session to revoke only its own stored public device identifier through `DELETE /v1/devices/{device_id}` at the exact paired HTTPS origin, with redirects blocked. It SHALL treat a confirmed no-content response as success, map an already unauthorized device to logged-out state, and SHALL NOT clear a still-usable local credential on an unconfirmed network, server, or response-validation failure.

#### Scenario: Current paired device is revoked

- **WHEN** the authenticated revoke request for the exact stored device identifier returns Platform's successful no-content response
- **THEN** the credential boundary clears the record and exposes only logged-out state

#### Scenario: Revoke cannot be confirmed

- **WHEN** the authenticated revoke request redirects, targets a mismatched origin or device identifier, fails on the network, or returns an unexpected response
- **THEN** the extension reports a safe revocation failure without exposing secrets or clearing the usable credential
