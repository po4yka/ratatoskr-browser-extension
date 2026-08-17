# Browser Extension local data model

## Durable state

- device connection: endpoint, public device ID, non-secret status; secret credential stored according to approved browser storage/security ADR.
- capture drafts and queue items: local ID/idempotency, kind, minimized payload, attempts, next retry, safe error.
- operation bindings and compact progress/results.
- user preferences, optional permission state, recent explicit captures with bounded retention.

## Constraints

Content scripts cannot read credential/queue storage directly. Queue transitions are atomic and survive service-worker suspension. Payload size/count and selected text are bounded. URLs are canonicalized but originals with sensitive queries are handled under policy. Completed/failed items expire under local retention. Clear-data and device revoke remove local sensitive state. No cookies/history/provider tokens are stored.
