## Why

The extension routes a permalink to a provider lane when its host and a loose path pattern match, but the lane's own service applies a stricter grammar: X admits status ids of 1 to 19 digits, Threads handles of 1 to 30 characters and post codes of 1 to 128, and Instagram admits `reels`, `tv` and username-prefixed paths that the extension never routed. Platform checks only the host, so the extension is the only gate: it promises a lane that then answers a terminal `failed` operation. Separately, `package-lock.json` resolves 452 of 460 packages from a third-party mirror, so `npm ci` fails on any machine that cannot reach it. This change applies the one grammar table of XR-021 CONTRACTS.md section R3-15 and moves the lockfile to the public npm registry (XR-021 round 3).

## What Changes

- **BREAKING (routing)**: a link whose path the lane would refuse (a 20-digit X status id, a 16-character X handle, a 31-character Threads handle, a 129-character Threads post code, a 65-character Instagram shortcode) is now captured through the generic URL lane instead of the provider lane.
- Instagram routes `/p/`, `/reel/`, `/reels/` and `/tv/` with an optional username segment and shortcodes of 1 to 64 characters.
- X routes status ids of 1 to 19 digits; Threads routes handles of 1 to 30 characters and post codes of 1 to 128.
- The repository pins `registry=https://registry.npmjs.org/` in `.npmrc` and the lockfile resolves every package from that registry with unchanged `integrity` hashes.
- README and `DEVELOPMENT.md` state the grammar table and the registry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `social-capture-routing`: the path grammar per provider.
- `build-and-packaging`: the lockfile resolves from the public registry.

## Impact

- `src/capture/draft.ts`, `tests/social-capture-routing.test.ts`, new `tests/lockfile-registry.test.ts`, `.npmrc`, `package-lock.json`, `README.md`, `DEVELOPMENT.md`.
- No manifest permission change. Platform's host check and the services' grammars are the reference and are unchanged.
