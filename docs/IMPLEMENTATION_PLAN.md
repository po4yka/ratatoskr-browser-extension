# Browser Extension implementation plan

1. Scaffold TypeScript MV3 project, lint/typecheck/test/build, CSP, and deterministic packaging.
2. Implement popup/action and context-menu page/link/selection capture drafts.
3. Add typed service-worker/content-script message protocol and minimal permissions.
4. Implement local queue/idempotency and MV3 suspension recovery.
5. Implement Platform device pairing and secure credential boundary.
6. Submit generic article captures and track operation status.
7. Add social provenance routing and unavailable/partial results.
8. Add GitHub metadata/track/star modes with capability and explicit write confirmation.
9. Add options, revoke/clear-data, redacted diagnostics, accessibility, and localization readiness.
10. Add cross-browser packaging/release/signing and workspace integration.

Definition of Done: explicit capture survives offline/restart without duplicates; permissions are minimal; pages cannot access credentials; no cookies/history/network interception exists; browser and workspace tests pass.
