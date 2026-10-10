## Why

The extension stamps every social capture with `new Date().toISOString().replace(/\.000Z$/, 'Z')`. That strips only an all-zero fraction, so one in ten millisecond values yields a fraction with a trailing zero such as `.120Z`. The contracts `WireTimestamp` accepts only the canonical form, in which trailing zeros of the fraction are trimmed, so Platform answers those captures with 400 and the rejection is permanent. The extension's own draft validator accepts `.120Z` as well, so the bad value is persisted in the queue and resent unchanged. This change makes the extension agree with the canonical contract (XR-021 CONTRACTS.md section S10, decision CD4).

## What Changes

- Add one formatter that renders a `Date` as a canonical wire timestamp: RFC 3339 UTC, literal `Z`, no fraction when the sub-second part is zero, otherwise the fraction with trailing zeros trimmed.
- Stamp social drafts with that formatter.
- Make the draft validator reject any `capturedAt` whose fraction ends in zero, or whose fraction is longer than nine digits.
- Re-canonicalize `captured_at` at the single wire edge (the Platform capture client), so a draft queued before this change with `.120Z` is repaired and delivered rather than dropped. A value that cannot be parsed as a UTC instant fails with a permanent `PlatformCaptureError`.

## Capabilities

### New Capabilities

- `social-capture-timestamps`: canonical `captured_at` rendering, validation and wire repair for social captures.

### Modified Capabilities

None.

## Impact

- Extension only: `src/protocol/wire-timestamp.ts` (new), `src/capture/draft.ts`, `src/protocol/validation.ts`, `src/capture/platform-client.ts`, and `tests/wire-timestamp.test.ts`.
- No Platform, contracts or service change. The cross-repository rule lives in "XR-021 CONTRACTS.md section S10 CD4"; contracts adds the matching fixtures.
- Deliberate break: a draft whose `capturedAt` fraction ends in zero no longer passes `isCaptureDraft`, so the popup submit message and the staging message reject it. Drafts already persisted in the queue are not revalidated on load; they are repaired at the wire edge instead.
