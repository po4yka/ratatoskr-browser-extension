# Browser Extension requirements

## Goals

1. Save the current page, a link, or selected text through explicit user action.
2. Classify article, Instagram, Threads, X, and GitHub URLs without accessing provider sessions.
3. Attach optional note, collection/tags, and safe mode choices.
4. Queue captures durably offline and expose operation progress/results.
5. Pair/revoke a Ratatoskr device with minimal permissions and privacy.

## Non-goals

Passive browsing collection, history scraping, cookies/passwords, hidden API/network interception, full-page archival, provider account synchronization, or executing backend domain logic.

## Requirements

- Every capture has explicit gesture and preview/confirmation when external write is possible.
- Permissions and payload fields are documented and minimized.
- Captures use stable idempotency keys and survive MV3 suspension/restart.
- GitHub `star` and other provider writes require explicit confirmation/capability.
- Social captures record `BrowserExtension` acquisition and `ExplicitUserCapture` authority.
- Device credentials are revocable and never exposed to content scripts/pages.
- Errors/progress are truthful and recoverable.

First slice: context-menu/popup page capture -> durable queue -> Platform operation -> completed status.
