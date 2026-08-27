# Browser Extension local data model

## Durable state

- device connection: endpoint, public device ID, non-secret status; secret credential stored according to approved browser storage/security ADR.
- capture drafts and queue items: local ID/idempotency, kind, minimized payload, attempts, next retry, safe error.
- operation bindings and compact progress/results.
- user preferences, optional permission state, recent explicit captures with bounded retention.

The options projection contains only the saved capture mode, aggregate queue count, safe queue item
status/retry metadata, public device ID/origin/status, extension version, and coarse operation state.
It is not a serialization of durable state. Diagnostic documents are likewise constructed from a
fixed allowlist. A volatile support-session flag may add endpoint and queue-item URLs, but the flag
is never persisted and cannot admit credentials, titles, selections, notes, tags, or raw errors.

## Constraints

Content scripts cannot read credential/queue storage directly. Queue transitions are atomic and survive service-worker suspension. Payload size/count and selected text are bounded. URLs are canonicalized but originals with sensitive queries are handled under policy. Completed/failed items expire under local retention. Clear-all revokes a paired device before erasure and removes local/session/sync extension storage, retry alarms, the exact optional Platform origin, and volatile support state; partial cleanup is reported as incomplete. No cookies/history/provider tokens are stored.
