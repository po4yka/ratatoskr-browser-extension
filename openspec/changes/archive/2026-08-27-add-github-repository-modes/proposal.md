## Why

Repository URLs currently fall through the generic article flow, so the extension cannot expose GitHub Catalog's contract-fixed preview or its distinct `metadata`, `track`, and `star` effects. The shared contracts and the GitHub service's Edge-proxied `/v1/gh` routes now provide a stable boundary for a capability-gated client without giving the extension provider credentials.

## What Changes

- Recognize only canonical public GitHub repository-root URLs in capture drafts and preserve the original captured URL.
- Read Platform's authenticated capability document and show a metadata preview card only when the non-stale GitHub service advertises repository preview.
- Offer only the `metadata`, `track`, and `star` actions returned by the preview contract; keep absent GitHub capability unavailable rather than falling back to generic ingestion.
- Require a visible, immediate confirmation for `track` and a stronger external-write confirmation for `star`; never remember or synthesize confirmation evidence.
- Submit exact preview target, mode, stable idempotency key, and opaque confirmation evidence to the Edge-proxied GitHub action route, with an account reference only for `star`.
- Render metadata, provider-star, and desired-backup component outcomes separately so partial and accepted-policy results cannot be presented as full success or verified backup.
- Keep the existing manifest permission baseline unchanged.

## Capabilities

### New Capabilities

- `github-repository-actions`: GitHub repository detection, capability-gated preview, confirmed metadata/track/star actions, and truthful component outcome presentation.

### Modified Capabilities

None.

## Impact

- Affects capture draft classification, popup markup/controller state, runtime messages, service-worker authenticated GitHub requests, and result rendering.
- Uses the existing Platform device credential and `/v1/gh` Edge gateway route; the extension receives no GitHub token and performs no provider call directly.
- Tests are fixed to the canonical `github.repository_preview_response` and `github.repository_action_result` fixtures from `ratatoskr-contracts`; no new production dependency or browser permission is added.
- Cross-repository rollout requirement: Platform must configure a healthy `github` gateway route and expose its non-stale service capability document before the UI enables the feature. Older or partial deployments truthfully show GitHub actions as unavailable.
