## Why

The repository is in architecture bootstrap: it holds intent documents but no code, no toolchain and no gate, so nothing about the planned extension is verifiable. `docs/IMPLEMENTATION_PLAN.md` item 1 calls for the first vertical slice — a scaffold that makes build, test, lint, typecheck and packaging real before any capture behaviour exists.

## What Changes

- Add a TypeScript Manifest V3 project at the repository root: background service worker, popup, and options surfaces stubbed as minimal entry points.
- Declare a strict extension-pages CSP in the manifest (script-src 'self'; object-src 'self') with a test that fails if remote code, eval or inline script sources are ever allowed.
- Add strict TypeScript configuration, ESLint flat config carrying the fleet size limits (per `ratatoskr-workspace/docs/QUALITY_GATES.md`), and Vitest unit tests run by `npm run test`.
- Add deterministic zip packaging: fixed entry order and timestamps, byte-stable across rebuilds, verified by a golden test that packages twice and compares checksums.
- Add `.github/workflows/ci.yml` running the full product gate (install, lint, typecheck, test, build, package), matching the command list recorded in DEVELOPMENT.md, in the same style as the other Ratatoskr repositories.
- Document exact install/build/typecheck/test/package/load-unpacked commands in DEVELOPMENT.md and update README status from "no code" to the truth.
- No capture logic of any kind: the stubs do not read tabs, pages, selections, storage or network.

## Capabilities

### New Capabilities

- `build-and-packaging`: observable guarantees of the first scaffold — an installable unpacked build whose manifest is valid and minimally permissioned, a CSP that admits no remote or evaluable code, byte-identical repackaging, and a gate whose commands cannot silently drift from the documented list.

### Modified Capabilities

## Impact

- New files only; no existing behaviour is modified. Root gains `package.json`, lockfile, `tsconfig.json`, `eslint.config.js`, Vitest config, `src/` (manifest + stub entries), `assets/icons/`, `scripts/build.mjs`, `scripts/package.mjs`, and `.github/workflows/ci.yml`.
- The fleet gate (`fleet.yml`) begins enforcing its manifest rules on this repository: a tracked `package.json` requires the tracked `eslint.config.*` (added here), and a manifest requires `ci.yml` that runs a test command (added here).
- Dependencies are dev-only and pinned through a committed lockfile: esbuild (bundling), fflate (deterministic zip), eslint + typescript-eslint, typescript, vitest, @types/chrome (types only). None affects manifest permissions.
