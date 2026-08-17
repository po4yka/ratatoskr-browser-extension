# Browser Extension threat model

## Assets

Device credential, private current-page URL/selection/note, capture intent, Platform endpoint, queue, browser permissions, and package/update integrity.

## Threats and controls

- **Overbroad permission/history access:** minimal optional permissions and documented purpose; no history/cookies/webRequest.
- **Hostile page/content-script injection:** isolated world, typed messages, sender validation, escaped rendering, bounds.
- **Credential exfiltration:** service-worker-only access, no page/content exposure, revoke/rotate, no logs.
- **Passive collection:** event handlers require explicit gesture; no background tab scans.
- **Duplicate/forged capture:** cryptographic/random idempotency, authenticated Platform, local state machine.
- **External write surprise:** capability check plus explicit confirmation and result details.
- **Supply-chain/remote-code attack:** lockfile, dependency review, CSP, no eval/remote scripts, reproducible signed packages.
- **Data residue:** bounded retention, clear/revoke flow, sanitized diagnostics.

Re-review for broader host permissions, DOM/media capture, OAuth inside extension, remote configuration, or enterprise deployment.
