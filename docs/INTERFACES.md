# Browser Extension interfaces

## Browser APIs

Action/popup, context menus, active tab or narrowly scoped content script, storage, alarms/retry, notifications/badge, optional permissions, and runtime messaging.

## Page/content boundary

Content scripts extract only explicitly requested URL/title/selection/metadata with size limits. Messages are typed, sender-validated, one-directional where possible, and never accept arbitrary code/HTML.

## Platform boundary

Device pairing/refresh/revoke; capture submit with idempotency; operation status; capabilities; collections/tags. All network calls use TLS and bounded retries.

## Rules

The service worker owns credentials/queue/network. UI renders escaped data. Provider URL classification does not access cookies or hidden endpoints. GitHub mode and write confirmation are included explicitly. Errors are safe and distinguish offline/auth/revoked/unsupported/invalid/provider-partial/terminal states without exposing private URL/query or selected text in telemetry.
