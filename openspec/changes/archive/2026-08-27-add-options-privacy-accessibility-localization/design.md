## Context

See `proposal.md` for motivation. The current options page sends pairing and queue-inspection messages but has no preference repository, safe device-state projection, destructive-action controller, diagnostics model, localization layer, or shared accessibility styling. Durable state currently lives in `chrome.storage.local` under credential, queue, and tracked-operation keys; retry wakeups use `chrome.alarms`; pairing grants the exact optional HTTPS origin. Platform already publishes authenticated self-device revocation as `DELETE /v1/devices/{id}`.

The service worker must remain the only surface that reads credentials or full queue payloads. The manifest permission baseline cannot expand, and browser-worker suspension means destructive operations cannot rely on mutable global state for correctness. User-visible artifacts remain English source text, but behavior and markup must consume it through localization keys.

## Goals / Non-Goals

**Goals:**

- Make options state and preferences useful without exposing captured content or secrets.
- Make remote revocation and local erasure deliberate, complete, and truthfully reported.
- Make diagnostics structurally incapable of exporting credentials or user content.
- Establish one small localization boundary and one testable accessibility baseline shared by popup and options.
- Preserve explicit capture, minimum permissions, deterministic packaging, and current Platform contracts.

**Non-Goals:**

- Adding another locale, choosing translated copy, or negotiating an application-specific locale.
- Adding analytics, log collection, crash upload, background support sessions, or automatic diagnostic submission.
- Adding queue edit/retry controls, notification permissions, provider-session access, or release-store automation.
- Changing Platform, shared workspace contracts, storage versions, or browser targets.

## Decisions

### 1. Keep all options data behind a closed worker protocol

Add an options-specific protocol module with exact runtime decoders and exhaustive request handling. The service worker accepts these messages only when `sender.id` is the extension, `sender.tab` is absent, and `sender.url` exactly equals the packaged options page URL. Safe state replies project queue summaries, the default mode, and public pairing fields; they never return stored objects.

This extends the existing message-boundary pattern and keeps credentials and full captures out of UI code. Direct storage reads from options were rejected because they would couple UI to secret-bearing storage and make clear-data completeness harder to centralize.

### 2. Store one preference and make it affect an explicit popup choice

Persist a closed `{ defaultCaptureMode: "quick" | "tracked" }` record in local extension storage, defaulting to `quick` when absent or invalid. Replace the popup's two immediate save buttons with a labeled mode group and one explicit Save action; staging initializes the choice from the preference but never submits automatically. Both modes remain visible and selectable for each capture.

Merely styling or focusing one of two buttons was rejected because it would make “default” ambiguous and difficult to expose consistently to assistive technology.

### 3. Use two native, sequential confirmation dialogs

Revoke and clear-all each use a review dialog followed by a separately named final dialog. Only the final dialog dispatches the worker request. Dialog helpers move focus to the first meaningful control, restore focus to the invoker on cancel or completion, and localize every name and description. The action handlers remain idempotent against repeated clicks while a request is pending.

`window.confirm` was rejected because it cannot present the required action-specific detail, controlled focus restoration, or consistent localized semantics. A single checkbox was rejected because it is one confirmation, not two distinct decisions.

### 4. Revoke remotely before deleting the credential

Extend the Platform identity client with authenticated, redirect-blocked `DELETE /v1/devices/{stored-device-id}` against the stored exact HTTPS origin. A 204 response confirms revocation. An authorization response proving that the device is already unusable degrades to logged out. Network, redirect, server, and malformed-response failures retain the usable credential and return a safe retryable UI result.

Clear-all invokes the same revoke boundary first when paired, then performs local erasure. This prevents an apparently complete cleanup from silently leaving an active device that the extension can no longer revoke.

### 5. Centralize complete local erasure as an explicit coordinator

The clear-data coordinator owns a fixed cleanup sequence after revocation: clear local, session, and sync extension storage; clear the queue retry alarm; remove every currently granted optional origin declared for the extension; reset volatile diagnostics state; then reload a fresh empty safe-state projection. Each step is awaited. If any step fails after cleanup has begun, the result names only the safe failed category and the UI says cleanup was incomplete rather than rolling back or claiming success.

Clearing only known keys was rejected because new extension-owned state could survive unnoticed. Adding `browsingData` was rejected because extension storage and permissions are the entire owned scope and that API would broaden privilege.

### 6. Build diagnostics from typed allowlisted inputs

Create a pure diagnostics builder whose output type enumerates every JSON key. Its normal inputs are already-minimized projections: package version, parsed browser identity, paired boolean, aggregate queue/operation counts, stable error categories, and permission booleans. It never accepts a credential record or arbitrary serialized storage object.

When the volatile options-page checkbox is enabled, the request may additionally supply Platform origin and capture URLs from a worker-side explicit projection. The export marks itself sensitive. Tokens, secrets, authorization and idempotency values, titles, notes, selections, handles, raw errors, and unknown nested values have no output slot in either mode. The checkbox is DOM memory only, starts false on every page load, and is reset by clear-all. Export uses a local JSON `Blob` and download link, so no `downloads` permission is needed.

A recursive redact-after-serialization filter was rejected because new fields could bypass a denylist. Redacting only query parameters was rejected because paths, hosts, and fragments can also be private.

### 7. Use the browser message catalog as the localization source

Add `default_locale: "en"`, `_locales/en/messages.json`, manifest `__MSG_*__` references, and a small typed localization adapter over `chrome.i18n.getMessage`. Markup carries message identifiers for text, labels, descriptions, placeholders, and accessible names; entry points localize the document before loading state. Dynamic status/domain values map to message identifiers and substitutions rather than sentence concatenation. The build copies the catalog into the package.

A hand-written in-code dictionary was rejected because it would not localize manifest metadata and would create a second catalog format. Additional EN/RU translations are intentionally outside this change; the English catalog is the source catalog required by Manifest V3.

### 8. Gate a concrete accessibility checklist without a new dependency

Use semantic HTML (`main`, headings, `fieldset`/`legend`, labeled form controls, `output`, lists, and named native `dialog`) plus a shared packaged stylesheet with visible `:focus-visible` treatment and reduced-motion-safe behavior. Extend behavior tests for dialog focus and live announcements. Add a named static checklist test that inspects both packaged surfaces for document language localization, landmarks, headings, control labels, descriptions, live regions, dialog names, non-negative tab order, and message-catalog coverage.

This does not claim a complete WCAG conformance audit. Adding an accessibility scanner dependency was rejected because the repository has no DOM/browser harness and a new production or test dependency is unnecessary for the requested baseline. A packaged browser smoke check remains a future cross-browser release item.

## Risks / Trade-offs

- [Remote revocation is unavailable while Platform is offline] → Keep the credential and local data intact, report the unconfirmed state, and permit retry instead of creating an orphaned registered device.
- [A later storage mechanism could escape clear-all] → Keep all extension-owned persistence behind the clear-data coordinator and make the completeness test fail whenever a new storage adapter is added without a cleanup step.
- [Sensitive URL diagnostics can disclose private browsing context] → Default off, keep the opt-in volatile, label the export sensitive, show a warning beside the checkbox, and never include user text or credentials.
- [Static accessibility checks cannot prove screen-reader behavior] → Pair structural checks with dialog-focus and status-announcement behavior tests and document this evidence boundary; perform a rendered keyboard/screen-reader audit when the cross-browser harness exists.
- [Manifest localization changes package paths] → Extend build-artifact and deterministic-package tests to require the source catalog and reject missing message references.
- [Clearing several browser resources cannot be atomic] → Sequence and await each operation, report partial cleanup honestly, and never claim complete success after any failed step.

## Migration Plan

There is no schema migration. Existing installations read a missing or malformed preference as `quick`; all current queue, operation, and credential records remain valid. The source catalog and stylesheet are added to deterministic package inputs, and the manifest permission set remains unchanged.

Rollback removes the new UI/protocol modules and catalog references. A user who already cleared data remains unpaired with empty local state; a user who already revoked a device must pair again. No compatibility shim or parallel behavior remains.
