# Developing Ratatoskr Browser Extension

> Status: Implemented  
> Last reviewed: 2026-08-26

The first scaffold exists: a Manifest V3 project with stubbed service-worker, popup, and options
surfaces, lint/typecheck/test/build tooling, a strict extension-pages CSP, deterministic zip
packaging verified by a golden test, and `.github/workflows/ci.yml` running the gate below.
Device pairing and the Platform API client are not implemented. Explicitly staged capture drafts
are persisted in a bounded local queue with idempotency and MV3 retry recovery; the queue retries
until a later Platform-client milestone supplies the authenticated submitter.

## Intended toolchain

TypeScript, WebExtensions/Manifest V3, a minimal UI framework/build tool, browser storage APIs, generated Platform API client, Web Crypto where needed, unit/browser automation tests, lint/typecheck, and deterministic packaging for Chromium and Firefox-compatible targets where feasible.

## Code size limits

`eslint.config.js` carries the size limits beside `package.json`, as
`ratatoskr-workspace/docs/QUALITY_GATES.md` requires: file length, function length, cyclomatic
complexity, and parameter count, all at severity `error`. The values are the fleet TypeScript
standard from that document; raising one is a measured change recorded there, never a silent bump.

`ratatoskr-workspace/docs/QUALITY_GATES.md` holds the numbers the repositories with code use today, the command that measured each one, and the limits that were rejected with the reason. Read it before you choose numbers, then measure this tree. Each limit is set at the worst case the tree already has, so that the check fails on a regression and not on work that has not been done yet.

## Workflow

1. Require an explicit user action for every capture.
2. Request the smallest possible permission and host scope.
3. Minimize payload to URL, selected text, note, capture metadata, and explicit options.
4. Persist queue state before network work and use idempotency.
5. Test service-worker suspension/restart, hostile pages/messages, permission changes, offline retry, and data clearing.

The first scaffold PR must document exact install/build/typecheck/test/package/load-unpacked commands. No provider cookie or password is ever required.

## Commands

Install once per clone (Node LTS line pinned by `.nvmrc`):

```bash
npm ci --frozen-lockfile
```

The product gate runs these commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run package
```

`npm run gate` chains those five in order. Build output goes to `dist/`, packaged archives to `release/`; both are deterministic, so rebuilding an unchanged tree reproduces byte-identical files. Load the unpacked extension in Chromium via `chrome://extensions` with Developer mode enabled, choosing `dist/` as the unpacked directory.

`tests/gate-parity.test.ts` compares this command list with `package.json`, so the two cannot drift apart silently.

## What a clone needs before you plan a change

A change is planned with OpenSpec, which is a CLI a clone installs for itself. Use the version
`.github/workflows/openspec.yml` pins, so your terminal and the gate answer the same:

```bash
npm install --global @fission-ai/openspec@1.10.0
```

Cross-repository behaviour lives in a store, and registering one is per-machine state that no
repository can turn on for you — the same kind of step as `git config core.hooksPath .githooks`:

```bash
git clone git@github.com:po4yka/ratatoskr-workspace.git <path>
openspec store register <path> --id ratatoskr-workspace
```

`openspec doctor` reports whether both are in place.
