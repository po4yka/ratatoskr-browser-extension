# Browser Extension domain model

## Terms

- **Capture draft:** normalized URL/selection/note/options before submission.
- **Capture kind:** article, social source, GitHub repository, selected text, or generic URL.
- **Queue item:** durable client request with idempotency key, attempts, and safe status.
- **Device connection:** paired Platform endpoint and revocable credential reference.
- **Operation binding:** Platform operation ID and projected progress/result.
- **Permission grant:** required/optional browser capability and host scope.

## Lifecycle

`draft -> confirmed -> queued -> sending -> accepted -> processing -> completed | failed | paused`

## Invariants

1. Captures are user-initiated.
2. Content scripts never receive device secrets.
3. Page-provided data is hostile and schema/size constrained.
4. Offline/restart cannot duplicate effects.
5. Social acquisition/authority and GitHub modes are explicit.
6. External provider writes require separate confirmation.
7. Extension stores no browsing history beyond user-created capture records.
