# Browser Extension testing strategy

Required tests:

- URL/kind classification, canonicalization, selected-text/title size and hostile Unicode/HTML.
- Popup/context-menu/action flows and external-write confirmation.
- Content-script/runtime sender/message validation and no credential access.
- Durable queue across service-worker stop/restart, offline, timeout, duplicate submit, retry/cancel/revoke.
- Device pairing/refresh/revoke and no-secret logs/storage export.
- Permission grant/denial/removal and capability degradation.
- CSP/no-eval/no-remote-code, dependency audit, deterministic package contents.
- Browser automation on Chromium and supported Firefox path.
- Workspace extension -> Platform -> article/social/GitHub operation flow.

Tests use local mock Platform and synthetic pages; no real provider session or private site fixture.
