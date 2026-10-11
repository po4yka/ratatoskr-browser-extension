## Context

`socialRoutes` in `src/capture/draft.ts` maps a host set and a path grammar to a provider. XR-021 CONTRACTS.md R2-11 fixes the host sets: Platform accepts the four Threads hosts, and the extension routes the four Threads hosts and all six X hosts. The path regexes are unchanged.

## Decisions

### D1: Extend the existing host sets in place

The host sets are data in the existing table, so the change adds hosts to those sets. No new code path or per-host branch is introduced, and the host match stays an exact set lookup on the parsed hostname, which is why `threads.com.evil.example` and `nottwitter.com` stay generic.

## Risks / Trade-offs

- [A new host is added to a lane Platform has not yet opened] -> Platform's round 2 change accepts the same four Threads hosts; the six X hosts are already accepted by Platform. Deployment order is Platform first, which the changeset records.
