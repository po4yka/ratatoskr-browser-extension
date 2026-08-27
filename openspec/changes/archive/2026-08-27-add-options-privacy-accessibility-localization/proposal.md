## Why

The extension's current options surface can pair a device and list a minimal queue, but it cannot configure the default save behavior, safely disconnect, erase all local state, or produce support diagnostics. Plan item 9 closes those privacy and operability gaps while making every extension surface keyboard- and assistive-technology-friendly and moving user-visible text out of code and markup for later localization.

## What Changes

- Add an options experience for choosing the default capture mode, inspecting the redacted local queue, and viewing non-secret paired-device status.
- Add separately named device-revoke and clear-all-data actions, each protected by two explicit confirmation steps. Device revoke uses Platform's existing `DELETE /v1/devices/{id}` contract before clearing the local credential; clear-all removes every extension-owned storage record and scheduled retry alarm.
- Add a diagnostics exporter built from an explicit safe-field allowlist. Tokens, device secrets, refresh credentials, notes, selections, titles, and other captured content are never exportable; a volatile, per-options-session support toggle may include endpoint and captured URL fields and resets on reload.
- Externalize user-visible strings behind stable message keys and ship one source-language catalog so additional locales can be added without changing behavior code.
- Apply and automatically check an accessibility baseline across popup, options, confirmation, status, queue, and operation surfaces, including labels, native keyboard controls, focus behavior, semantic grouping, and live announcements.
- Keep the reviewed Manifest V3 permissions unchanged and add no production dependency.

## Capabilities

### New Capabilities

- `options-data-controls`: Covers default capture preferences, safe queue/device inspection, double-confirmed revoke and complete local erasure, and allowlist-based support diagnostics.
- `accessible-localizable-surfaces`: Covers the cross-surface accessibility baseline and externalized message catalog used by popup and options behavior.

### Modified Capabilities

- `device-pairing`: Adds explicit authenticated self-device revocation with fail-closed local credential handling.
- `extension-message-protocol`: Adds validated options-page requests and safe replies for preferences, device state, destructive data controls, and diagnostics.

## Impact

- Affects the options page, popup, service worker, runtime protocol, credential/queue/operation storage adapters, manifest/build assets, tests, and user-facing documentation.
- Uses the existing Platform device-revoke API and existing extension storage and alarm permissions; no Platform or shared contract change is required.
- Does not add browser permissions, host grants, content scripts, provider access, analytics, or dependencies. The sensitive diagnostics toggle is session-local and credentials remain excluded under all modes.
