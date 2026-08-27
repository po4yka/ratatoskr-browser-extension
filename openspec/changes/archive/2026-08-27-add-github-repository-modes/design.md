## Context

See `proposal.md` for motivation and `specs/github-repository-actions/spec.md` for behavior. The shared `ratatoskr-contracts` repository now fixes preview/action wire shapes and valid/invalid fixtures. GitHub Catalog serves `/v1/capabilities`, `/v1/gh/repositories/preview`, and `/v1/gh/repositories/actions`; Platform Edge already supports a configured `/v1/gh` authenticated proxy that strips the device bearer token and injects bounded identity claims.

The extension currently has a pure draft classifier, a strict runtime-message boundary, a paired-device authorization boundary, generic capture queueing, and a popup with stage/quick/tracked actions. GitHub repository actions are synchronous component-result commands rather than generic capture operations, so they must not enter `/v1/captures` or reuse article-result semantics.

## Goals / Non-Goals

**Goals:**

- Keep URL classification and presentation state testable through public pure interfaces.
- Consume the exact first-version contract vocabulary and reject unknown or contradictory responses.
- Make capability absence and staleness a normal unavailable state.
- Ensure only the service worker touches the device credential and network.
- Keep confirmation bound to one preview target and selected mode.

**Non-Goals:**

- GitHub OAuth, provider-token handling, star-list filing, unstar, or direct GitHub API calls.
- Generic article fallback for recognized repository roots when GitHub Catalog is unavailable.
- Claiming desired backup acceptance is storage completion or verification.
- Adding permissions, content scripts, migrations, a second API version, or compatibility paths.

## Decisions

### Use a strict local classifier with a separate preview URL

`classifyGithubRepository` accepts only the repository-root shape the shared preview request accepts. It returns a trailing-slash-free preview URL while the draft retains the user's original URL. This avoids sending unsupported query/sub-resource forms and avoids rewriting provenance. Allowing broad GitHub paths and hoping the backend canonicalizes them was rejected because the Catalog contract explicitly refuses those shapes.

### Gate through Platform's sampled service capability document

The GitHub client reads authenticated `GET /v1/capabilities`, finds the `github` service section, requires `stale === false`, and validates `repository_preview` plus the closed action list. Preview actions are intersected with that list. Guessing capability names from service reachability or treating a stale document as empty success was rejected.

### Keep contract validation local and dependency-free

Small runtime validators mirror the generated TypeScript contract shapes and additionally enforce cross-field aggregate consistency that the generated schema calls a lower bound. Contract fixtures are copied into focused extension test fixtures with provenance comments rather than importing across repository boundaries at build time. Adding a schema-validation dependency is unnecessary for four bounded shapes and would create production maintenance/license impact.

### Route privileged requests through dedicated messages

The popup sends validated `github.preview` and `github.action` messages to the service worker. Handlers require an extension-page sender, acquire the paired endpoint/token inside the worker, and call only the Edge-proxied `/v1/gh` routes. Page/content-script senders cannot invoke them. The worker creates the final action request from validated popup intent and preview target; no page-provided provider token or endpoint is accepted.

### Model confirmation as a target-bound one-shot state machine

The popup controller enters `confirmation-required` only for an advertised `track` or `star` mode. Confirming returns one immutable action intent containing the exact preview target, mode, fresh `browser-extension-confirmation:<uuid>` evidence reference, and a fresh stable action idempotency key. Cancelling clears it; preview changes invalidate it. Metadata uses its explicit action-button click as confirmation and still receives fresh evidence because the shared wire contract requires evidence for every action. A remembered boolean was rejected because it could silently authorize another repository or mode.

### Render contract components, not a synthesized success sentence

The result projector returns one row for metadata, provider star, and desired backup plus the validated aggregate. `accepted` is worded as policy acceptance only; negative states keep their safe reason. The projector refuses aggregates inconsistent with positive/negative component facts, so the UI cannot turn malformed data into success.

## Risks / Trade-offs

- [Platform deployment omits or misconfigures the `github` gateway route] -> The sampled service section is absent/stale and the popup disables preview/actions without generic fallback.
- [Generated shared contracts change after fixture copy] -> Tests name the source contract/fixture and strict validators reject drift; a future contract adoption updates fixtures and validators together under a workspace changeset.
- [Network outcome becomes uncertain after submitting an action] -> The request carries a stable per-intent idempotency key and retry uses that same intent while the popup remains open; durable cross-restart action recovery is deferred because this item does not define a persisted provider-write queue and the server remains replay-safe.
- [Popup closes during confirmation] -> No request is emitted because confirmation state is in-memory and one-shot; reopening requires a fresh preview and confirmation.

## Migration Plan

1. Ship the extension code; no permission or stored-data migration is needed.
2. Deploy/configure GitHub Catalog behind Platform's `/v1/gh` gateway route and let the capability sampler observe a non-stale document.
3. The UI becomes available only after step 2 is observed; rollback removes or stales the service capability and immediately hides actions without changing captured data.
