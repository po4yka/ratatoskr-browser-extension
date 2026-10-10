## ADDED Requirements

### Requirement: Social captures carry canonical wire timestamps
The extension SHALL render the `captured_at` of a social capture as an RFC 3339 UTC timestamp with a literal `Z`, without a fraction when the sub-second part is zero and otherwise with the fraction's trailing zeros trimmed. It SHALL reject a draft whose `capturedAt` is not in that form, and SHALL re-render a stored `capturedAt` into that form before sending it to Platform. It SHALL fail a submission permanently when the stored value cannot be read as a UTC instant.

#### Scenario: Every millisecond value renders canonically
- **WHEN** a date is formatted for each millisecond value from 0 to 999 within one second
- **THEN** each result equals the whole-second timestamp with the trimmed fraction and a `Z`, and none ends in a zero before the `Z`

#### Scenario: A social draft is stamped canonically
- **WHEN** a draft is created for an X status URL while the clock reads 120 milliseconds past the second
- **THEN** the draft's `capturedAt` ends in `:00.12Z`

#### Scenario: A non-canonical draft timestamp is rejected
- **WHEN** a draft whose `capturedAt` ends in `.120Z` or `.100Z` is validated
- **THEN** the validator rejects it, while `.12Z`, `.1Z` and a whole-second `Z` are accepted

#### Scenario: A previously queued timestamp is repaired at the wire edge
- **WHEN** a queued social draft whose `capturedAt` ends in `.120Z` is submitted to Platform
- **THEN** the request body carries `captured_at` ending in `.12Z`

#### Scenario: An unreadable timestamp fails permanently
- **WHEN** a social submission carries a `capturedAt` that is not a UTC timestamp
- **THEN** the submission fails with a permanent capture error and no request is sent
