## Purpose

Defines how explicit browser captures recognize supported social permalinks, preserve their
limited provenance, and present the social operation outcome without inventing content state.

## ADDED Requirements

### Requirement: Supported social permalinks route to their owning service
The extension SHALL classify an explicit `http` or `https` capture as social only when it matches
the published public permalink grammar for X, Instagram, or Threads. It SHALL route X, Instagram,
and Threads captures through the Platform route assigned by the fleet contract, and SHALL route
all other valid URLs through generic article capture. It SHALL preserve the original URL and SHALL
NOT read provider cookies, browser storage, page HTML, hidden APIs, or provider sessions while
classifying.

#### Scenario: A classification table selects the social owner
- **WHEN** the classifier receives representative valid X, Instagram, and Threads post-permalink
  URLs plus a non-social article URL and a provider profile or unsupported URL shape
- **THEN** valid social rows select exactly `x`, `instagram`, or `threads`, while every other row
  remains generic and no row causes page or provider-session access

### Requirement: Social submissions carry only explicit-capture provenance
The extension SHALL submit a recognized social permalink with its original URL, stable local
idempotency key, capture time, `browser_extension` acquisition, and
`explicit_user_capture` saved authority as defined by the fleet contract. It SHALL keep an
optional user note or selected quote separate from provider content, and SHALL NOT assert that a
capture is a native provider Saved item or bookmark.

#### Scenario: A social capture preserves its provenance across retry
- **WHEN** a recognized social capture is queued and then retried after a retryable delivery
  failure
- **THEN** each submission has the same original URL, idempotency key, social owner, acquisition,
  and saved authority, and contains no cookie, page body, credential, or provider-content claim

### Requirement: Social terminal outcomes are rendered without false success
The extension SHALL render a typed unavailable or deleted social outcome as an unavailable capture
with its safe user guidance, and SHALL NOT expose a document reader link or label it completed. It
SHALL render a partial outcome as partial, identify the preserved social result and each failed
dependent result from the Platform snapshot, and SHALL NOT represent the failed dependent result
as preserved social content.

#### Scenario: A deleted social source remains unavailable
- **WHEN** Platform reports that a social capture is deleted or unavailable and provides no
  preserved social result
- **THEN** the popup displays an unavailable result, does not display a reader link, and offers
  retry only when Platform marks that outcome retryable

#### Scenario: A preserved post with a failed article is partial
- **WHEN** Platform reports a partial social capture containing a preserved post result and a
  typed linked-article extraction failure
- **THEN** the popup identifies the post as preserved, identifies article extraction as failed,
  and labels the overall outcome partial rather than succeeded
