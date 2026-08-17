# Security Policy for Ratatoskr Browser Extension

Report vulnerabilities privately. Do not publish device credentials, captured private URLs/text, browser storage dumps, production endpoints, signed packages, or exploit pages containing user data.

Security review is required for every permission/host permission, content script, message channel, context menu, device pairing, storage, deep link, update/package, dependency, CSP, and external-write flow.

Baseline: explicit action only; no browsing-history collection; no cookies/session/network interception; minimal optional permissions; validate sender/origin/message schemas; no remote code/eval; strict CSP; escape page content; Key material in extension storage only as designed; TLS/idempotency; safe logs without URLs/selection text; signed reviewed releases.
