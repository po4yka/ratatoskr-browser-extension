## Why

The extension currently submits every URL as a generic `content.capture.requested.v1` request.
That sends X, Instagram, and Threads permalinks to the extractor and loses the explicit-capture
provenance that their owning services require. It also leaves the popup unable to distinguish a
preserved social post with a failed linked-article extraction from a wholly unavailable post.

## What Changes

- Classify only supported public X, Instagram, and Threads permalinks locally, without page
  session access, and send them to the owning social service through a Platform-defined route.
- Carry the exact original permalink plus `browser_extension` acquisition and
  `explicit_user_capture` saved-authority metadata; do not claim native Saved/bookmark authority.
- Render Platform's typed social unavailable/deleted outcome and partial outcomes truthfully,
  including a preserved post whose linked article could not be extracted.
- Preserve generic article capture behavior for non-social URLs and retain existing local
  idempotency and tracked-operation recovery.

## Capabilities

### New Capabilities

- `social-capture-routing`: explicit classification, provenance-preserving Platform submission,
  and truthful social operation outcomes for X, Instagram, and Threads.

### Modified Capabilities

- `article-capture-submission`: generic article submission must exclude recognized social
  permalinks so it cannot present their capture as article extraction.

## Impact

- Extension: capture-draft classification, queue submission, Platform client, operation snapshot
  validation, popup operation panel, focused tests, and permission documentation (no new
  permission is expected).
- Fleet contract: the current Platform route accepts only `{ url }` and always emits
  `content.capture.requested.v1` for the extractor. A workspace changeset and Platform/social
  rollout must first define the social command route, provenance fields, and typed unavailable and
  partial result vocabulary. The extension must not send ignored metadata and claim that routing
  occurred.
