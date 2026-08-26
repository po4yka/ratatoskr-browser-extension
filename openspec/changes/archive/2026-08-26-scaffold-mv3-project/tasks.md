## 1. Toolchain skeleton (configuration; no behaviour to test yet)

- [x] 1.1 Add root npm package: `package.json` with scripts `lint`, `typecheck`, `test`, `build`, `package`, `gate`; `.nvmrc` pinning the Node LTS line; commit the generated lockfile. No failing test possible: configuration and generated files. Verify: `npm ci --frozen-lockfile && npm run gate` exits non-zero only because gate steps are not all implemented yet, and each script name resolves.
- [x] 1.2 Add strict `tsconfig.json` (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, verbatimModuleSyntax) covering `src/**` and tests. No failing test possible: compiler configuration. Verify: `npm run typecheck` exits 0 on the stub tree once 2.x lands.
- [x] 1.3 Add `eslint.config.js` carrying the four fleet size rules at error severity (`max-lines` 200 skipBlankLines/skipComments, `max-lines-per-function` 120, `complexity` 8, `max-params` 2) plus typescript-eslint strict base, referencing QUALITY_GATES.md for each number. No failing test possible: linter configuration. Verify: `npm run lint` exits 0 on the tree that exists at that point.

## 2. Manifest baseline

- [x] 2.1 Add `tests/manifest.test.ts` ("manifest is valid MV3 named Ratatoskr", "permission baseline stays empty"): reads `src/manifest.json`, asserts parseable JSON, `manifest_version === 3`, name starts "Ratatoskr", `permissions` absent/empty, `host_permissions` absent/empty. Confirm it fails with "no such file or directory: src/manifest.json" before writing the manifest — the stated reason, not a compile error.
- [x] 2.2 Add `src/manifest.json` (MV3, name Ratatoskr, version 0.1.0, background service worker entry, action popup, options page, declared extension-pages CSP, icons) and committed icon PNG fixtures under `assets/icons/`. Verify: `npx vitest run tests/manifest.test.ts` passes.

## 3. Strict CSP

- [x] 3.1 Add `tests/manifest-csp.test.ts` ("CSP forbids remote and evaluable code"): parses `content_security_policy.extension_pages`, asserts script-src and object-src are exactly `'self'` and no directive contains `unsafe-eval`, `unsafe-inline`, or a remote origin. Confirm it fails against the manifest from 2.2 only if the policy is wrong; if 2.2 already wrote the correct CSP, this pair's failure step is satisfied by temporarily asserting first against a draft without the CSP key — run and record the observed failure reason either way.
- [x] 3.2 Ensure `src/manifest.json` declares `"content_security_policy": {"extension_pages": "script-src 'self'; object-src 'self'"}`. Verify: `npx vitest run tests/manifest-csp.test.ts` passes.

## 4. Build

- [x] 4.1 Add `tests/build-artifacts.test.ts` ("build output completeness"): runs `node scripts/build.mjs` in a child process with output into a temp dir, then asserts exit 0, manifest copied, service worker / popup / options entries exist, and every path referenced by the built manifest exists in the output dir. Confirm it fails with "Cannot find module .../scripts/build.mjs" before implementing — the stated reason.
- [x] 4.2 Implement `scripts/build.mjs`: esbuild bundle of the three TypeScript entries to fixed output names (IIFE, minify off for reviewability), copy manifest + static assets verbatim into `dist/`. Verify: `npx vitest run tests/build-artifacts.test.ts` passes and `npm run build` populates `dist/`.

## 5. Deterministic packaging

- [x] 5.1 Add `tests/package-determinism.test.ts` ("golden determinism check"): builds once into a temp dir, runs `node scripts/package.mjs` twice in separate child processes over it, asserts both zips exist, are non-empty, and have equal SHA-256 digests; also asserts zip local-header timestamps decode to the pinned epoch. Confirm it fails with "spawn .../scripts/package.mjs ENOENT" before implementing — the stated reason.
- [x] 5.2 Implement `scripts/package.mjs`: fflate zip over the dist directory, entries sorted by path, per-entry mtime pinned to the constant epoch, fixed external attributes, pinned compression level; writes `release/ratatoskr-browser-extension-<version>.zip`. Verify: `npx vitest run tests/package-determinism.test.ts` passes, including across two separate processes.

## 6. Gate documentation and parity test

- [x] 6.1 Add `tests/gate-parity.test.ts` ("documented gate cannot drift"): extracts the fenced shell block marked as the command list from DEVELOPMENT.md, maps each documented command to its package.json script, and fails when any documented command has no matching script or any gate script is missing from the list. Confirm it fails because DEVELOPMENT.md carries no command list yet — the stated reason.
- [x] 6.2 Update DEVELOPMENT.md with the exact install/build/typecheck/test/package/load-unpacked/gate commands matching the scripts. Verify: `npx vitest run tests/gate-parity.test.ts` passes.

## 7. CI workflow (configuration; verified by inspection and push, not a unit test)

- [x] 7.1 Add `.github/workflows/ci.yml`: SHA-pinned checkout + setup-node (`.nvmrc`), minimal `contents: read` permissions, concurrency group, timeout, `npm ci --frozen-lockfile`, then the gate commands in DEVELOPMENT.md order, then a self-check step comparing its own `- run:` lines with DEVELOPMENT.md's list. No failing test possible: CI executes only on the remote. Verify locally: `node -e` YAML sanity parse, action SHAs resolve, and the parity test still passes since the doc list is unchanged.

## 8. Status truth and full gate

- [x] 8.1 Update README.md bootstrap-status lines and DEVELOPMENT.md status header to state the scaffold exists (manifest, worker/popup/options stubs, toolchain, deterministic packaging, ci.yml). Documentation task; verified by reading.
- [x] 8.2 Run the full product gate end to end on a clean checkout state: `rm -rf node_modules dist release && npm ci --frozen-lockfile && npm run gate`, plus `openspec validate --all --strict` and `openspec validate --archived`; confirm byte-stable repackaging evidence from the golden test output. This is the integration verification spanning all tasks above.
