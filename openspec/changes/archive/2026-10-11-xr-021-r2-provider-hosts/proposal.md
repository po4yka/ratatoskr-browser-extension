## Why

The extension routes a permalink to a provider lane only for the hosts it knows. Threads moved to `threads.com` and the extension accepts only `threads.net` hosts, and for X it accepts three of the six hosts Platform accepts, so a permalink copied today from `threads.com` or `twitter.com` takes the generic extractor path and never reaches the provider lane. This change makes the extension agree with the fleet host sets (XR-021 round 2, CONTRACTS.md section R2-11, building on S10).

## What Changes

- Route `threads.net`, `www.threads.net`, `threads.com` and `www.threads.com` to the Threads lane.
- Route `x.com`, `www.x.com`, `mobile.x.com`, `twitter.com`, `www.twitter.com` and `mobile.twitter.com` to the X lane.
- Leave the path grammars unchanged, so profile URLs, look-alike hosts and `http://` URLs still do not route.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `social-capture-routing`: the recognised host sets for X and Threads.

## Impact

- Extension only: `src/capture/draft.ts` and `tests/social-capture-routing.test.ts`.
- No manifest permission changes, because routing classifies a URL the user already has open. No store listing or document names these hosts.
- Threads-archive keeps canonicalizing to `www.threads.net`; Platform's host change is a separate repository change.
