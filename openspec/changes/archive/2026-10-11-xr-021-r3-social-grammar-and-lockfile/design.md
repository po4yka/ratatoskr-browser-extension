## Context

`socialRoutes` in `src/capture/draft.ts` is the extension's only routing table. XR-021 CONTRACTS.md R3-15 rule 3 fixes one grammar table that the extension, the services and (for hosts) Platform follow. The extension pattern is deliberately the stricter side where a service is looser (the X service accepts any handle and `statuses`).

## Decisions

### D1: Replace the three path expressions in place

The grammar is data in the existing table, so only the `path` expressions change; the host sets and `createDraft` are untouched. A refused path falls out of `classifySocialCapture` as `undefined`, which `socialCapture` already turns into a plain URL capture, so no new code path exists.

- X: `^/[A-Za-z0-9_]{1,15}/status/[0-9]{1,19}/?$`
- Instagram: `^/(?:[^/]+/)?(?:p|reel|reels|tv)/[A-Za-z0-9_-]{1,64}/?$`
- Threads: `^/@[A-Za-z0-9._]{1,30}/post/[A-Za-z0-9_-]{1,128}/?$`

### D2: The test holds the grammar as written-out data

The routing test lists accepted and refused URLs per provider and host as data, taken from the table, rather than re-deriving them from the implementation's regexes.

### D3: Pin the registry in `.npmrc` and test the lockfile

`.npmrc` carries `registry=https://registry.npmjs.org/`. A vitest case parses `package-lock.json` and requires every `resolved` to start with that registry and every package entry with a `resolved` to carry an `integrity`. Regenerating the lockfile keeps every `integrity`, which is the evidence the mirror served the same tarballs.

## Risks / Trade-offs

- [Some links now take the generic URL lane] -> intended: the provider lane would answer a terminal `failed` operation for them.
- [An `integrity` hash differs after regeneration] -> stop and report that package; do not commit the lockfile.
