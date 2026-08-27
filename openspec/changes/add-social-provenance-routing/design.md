## Context

See `proposal.md` for motivation and `specs/social-capture-routing/spec.md` for the extension
contract. The current Platform `POST /v1/captures` accepts only `{ "url": ... }` and always emits
`content.capture.requested.v1` for the extractor. The social owners use explicit-capture
provenance, but there is no published Platform command, public request shape, or operation-result
vocabulary that carries it from this client to them.

## Goals / Non-Goals

**Goals:**

- Route only recognized social permalinks using a narrow, deterministic local classifier.
- Preserve user-capture provenance and render result truth from typed Platform snapshots.
- Retain the existing queue's idempotency and service-worker recovery guarantees.

**Non-Goals:**

- Provider URL canonicalization, social-content retrieval, cookie/session access, native Saved or
  bookmark synchronization, provider writes, and article extraction.
- Guessing a command name, result kind, unavailable vocabulary, or Platform fallback before the
  fleet contract publishes it.

## Decisions

### D1: Classification is a pure local table with conservative fallback

The extension will parse only HTTP(S) URLs and recognize the exact public provider hosts and
post-permalink path forms admitted by each owning social service. It will preserve the input URL
unchanged and pass it to the owner for canonicalization. Lookalike hosts, profile pages, and
unrecognized shapes stay generic, avoiding an extension-maintained substitute for provider policy.

This is preferred to host-only routing because host-only routing converts profile and login pages
into social capture claims, and to browser-side canonicalization because it duplicates service-owned
normalization rules.

### D2: Submission is blocked on a shared typed contract

Before client implementation, the workspace and Platform must publish one request/command route
that carries social owner, original permalink, capture time, `browser_extension`, and
`explicit_user_capture`, and routes it to its social owner rather than the extractor. The generated
client or validated request type will be the extension's only network boundary.

This is preferred to extending the current client body locally: Platform's current deserializer
silently ignores unknown fields and still sends the command to the extractor, which would make a
false provenance/routing claim.

### D3: UI consumes typed outcome detail rather than stage names or warnings

The shared operation result contract must identify a preserved social post separately from an
unavailable/deleted source and a failed linked-article extraction. The extension will validate
those closed values at its API boundary and render them as unavailable or partial; it will neither
infer deletion from a network error nor manufacture a reader link for a social result.

This is preferred to parsing warning strings because warning text is not a stable contract and
cannot identify which dependent result was preserved.

## Risks / Trade-offs

- [The Platform contract remains unavailable] → do not begin extension routing; keep social URLs
  out of a release rather than silently sending them to article extraction.
- [Provider URL grammars drift] → table tests are derived from owner service specs and updated only
  with an owner-contract change.
- [A partial snapshot lacks typed result detail] → render safe generic partial status and omit
  preservation claims until the producer supplies the required detail.

## Migration Plan

1. Land the workspace contract plus Platform/social-owner rollout, with the Platform route ready
   before the extension submits it.
2. Add failing extension tests for the classification table, submission provenance, and unavailable
   and partial rendering; then implement each paired behavior.
3. Run the extension gate, deploy the fleet contract before the extension, and roll back by
   withholding the extension release if the route is unavailable. No compatibility path or second
   API version is introduced.
