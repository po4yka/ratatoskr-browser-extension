## 1. Cross-browser manifest and build matrix

- [x] 1.1 Add `tests/cross-browser-manifest.test.ts` (`keeps Firefox deltas compatibility-only`) and `tests/cross-browser-build.test.ts` (`builds complete Chromium and Firefox trees`); run them before implementation and confirm they fail because target manifests/directories do not exist, while asserting equal permissions/CSP/UI entries and complete target references.
- [x] 1.2 Split the manifest into shared plus Chromium/Firefox deltas and update `scripts/build.mjs` for the closed target matrix; run the two tests from 1.1 and existing manifest/build tests until they pass.

## 2. Deterministic target packaging and archive smoke

- [x] 2.1 Extend `tests/package-determinism.test.ts` (`reproduces both target archives and SHA256SUMS`) and add `tests/packaged-extension-smoke.test.ts` (`rejects unsafe or target-mismatched archives`); run them before implementation and confirm failures identify the missing matrix/checksum/smoke behavior.
- [x] 2.2 Parameterize deterministic packaging, emit canonical target archives/checksums, and implement archive-content smoke validation; run both tests from 2.1 plus existing package/build tests until they pass.

## 3. Deterministic store-listing assets

- [x] 3.1 Add `tests/store-listing-assets.test.ts` (`reproduces target descriptions, PNG screenshots, and checksum index`) and run it before implementation; confirm it fails because the listing source/generator/outputs do not exist and retain assertions for fixed PNG dimensions, locale, manifest-matched permission claims, and prohibited claims.
- [x] 3.2 Add the versioned listing model and dependency-free deterministic PNG/text generator, then run the test from 3.1 twice in isolated output directories and confirm byte-identical results.

## 4. Owner-gated signing and upload automation

- [x] 4.1 Add `tests/release-upload.test.ts` with `missing credentials lists exact names without a request`, `dry-run never mutates a store`, and request-shape tests for Chrome Web Store v2 and Mozilla `web-ext`; run it before implementation and confirm failure is the absent release module, not a live network call.
- [x] 4.2 Implement non-mutating release validation, redacted blocker JSON, Chrome OAuth/v2 upload with separately authorized publish, and Firefox listed signing/upload using pinned `web-ext`; run the tests from 4.1 and a credential-empty CLI invocation, verifying no secret value or network mutation appears.
- [x] 4.3 Add `tests/release-workflow-policy.test.ts` (`separates read-only CI from owner-authorized store jobs`) and run it before workflow implementation; confirm it fails because no protected manual release workflow exists.
- [x] 4.4 Add separate Chromium and Firefox manual release jobs under the `extension-stores` environment with `contents: read`, store-scoped secret exposure, pre-upload artifact verification, and no pull-request publication path; run the policy test from 4.3 until it passes.

## 5. Workspace-composed smoke and evidence

- [x] 5.1 Add `tests/workspace-smoke.test.ts` with `records exact live inputs and artifact digests` and `refuses missing profile, unreachable origin, non-synthetic credentials, and incomplete teardown`; run it before implementation against a local synthetic HTTP server and confirm the missing smoke module is the failure reason.
- [x] 5.2 Implement the bounded live smoke/evidence writer and CLI, clearly labelling synthetic-server tests as fixture evidence; run the tests from 5.1 and verify fixture output can never carry a passing `composed` evidence kind.
- [x] 5.3 Run the workspace-owned `integration/compose/web-operational.yaml` at exact compatible revisions under `build-gate` with a unique task namespace, exercise the smoke CLI against its public Platform origin, tear down only that namespace, and record reviewed composed evidence. This external lifecycle cannot start from an in-repository failing test because Docker, sibling revisions, live ports, and teardown are environment-owned inputs; the committed evidence must instead name the exact command, revisions, digests, assertions, and teardown result.

## 6. Gate and release documentation

- [x] 6.1 Extend `tests/gate-parity.test.ts` (`documents every new build, package, listing, release-check, and package-smoke gate command`) and existing permission/readme assertions; run them before documentation/script updates and confirm they fail on the old single-target command list and pending plan-item wording.
- [x] 6.2 Update `package.json`, CI, `DEVELOPMENT.md`, README/status/implementation-plan text, permission analysis, testing/release documentation, and `.gitignore` for the new matrix and evidence boundaries; run the tests from 6.1 until documentation, scripts, and hosted gate are in parity.

## 7. Acceptance, blocker evidence, and final validation

- [x] 7.1 Run the non-mutating release check and then the explicit credential-empty upload command for both stores; because owner secrets are external inputs, this evidence cannot start from a failing test. If credentials are absent, record exactly `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`, `WEB_EXT_API_KEY`, and `WEB_EXT_API_SECRET` as missing without values; if provisioned, record observed upload/signing results separately from publication.
- [x] 7.2 From a clean generated-output state run `npm ci --frozen-lockfile`, `npm run gate`, `openspec validate --all --strict`, and `openspec validate --archived`; inspect the final diff and generated archives/listings, and mark complete only when both target digests reproduce, packaged smoke passes, composed evidence is truthful, credential state is recorded, and all gates are green.
