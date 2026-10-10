## Context

The canonical form is defined by XR-021 CONTRACTS.md section S10 (CD4): RFC 3339 UTC with a literal `Z`, seconds precision when the sub-second part is zero, otherwise the fraction with trailing zeros trimmed. The validator rule from that section is `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{0,8}[1-9])?Z$/`. The extension has no contracts pin, so it mirrors the rule and the contracts fixtures prove the other side.

## Goals / Non-Goals

**Goals:**

- Emit only canonical `captured_at` values.
- Reject non-canonical values at the draft boundary.
- Repair previously queued non-canonical values at the wire edge.

**Non-Goals:**

- Any Platform, contracts or service change.
- The linked-article partial outcome and mobile capture routing.

## Decisions

### D1: One module owns the format

`src/protocol/wire-timestamp.ts` exports `formatWireTimestamp(date)`, `canonicalizeWireTimestamp(text)` and `isCanonicalWireTimestamp(value)`. The formatter trims the millisecond fraction of `toISOString()` directly instead of using a replace chain, so the rule is visible in one place. `canonicalizeWireTimestamp` returns a value that is already canonical unchanged; otherwise it accepts only a full date-time ending in a literal `Z`, parses it with `Date.parse`, and re-renders it, which yields `undefined` for unparsable or non-UTC text. This is preferred to a second regex in the client because the validator, the draft factory and the client then cannot disagree.

### D2: Repair at the wire edge, strict at the draft boundary

`submit()` passes `social.capturedAt` through `canonicalizeWireTimestamp`, so a queue entry written by an older build is delivered with a correct value. The draft validator is strict: it is the boundary for new input and rejects what the contract rejects. A value that cannot be parsed raises `PlatformCaptureError('permanent')`, because retrying cannot change the outcome.

### D3: Precision limit

JavaScript dates carry millisecond precision, so the formatter never produces more than three fraction digits. The validator accepts up to nine fraction digits that do not end in zero, matching the contract rule, because a canonical value written by another producer must not be rejected.

## Risks / Trade-offs

- [A draft already in the queue carries a non-canonical value] → the queue does not revalidate stored drafts, so the entry reaches `submit`, where the wire edge repairs it; the strict validator only guards new messages.
- [`Date.parse` accepts forms the contract does not] → the result is re-rendered, so only the canonical string leaves the extension.
