## Why

Plan item 10 is the remaining release boundary: the extension can build and package one Chromium-shaped tree, but it cannot yet produce independently auditable Chromium and Firefox artifacts, generate reproducible store material, exercise owner-gated publication, or record a composed-workspace smoke result. Completing that boundary turns the implemented client into release-ready, truthfully verifiable deliverables without broadening browser permissions or inventing backend contracts.

## What Changes

- Build isolated `chromium` and `firefox` targets from one shared source tree, with small reviewed manifest deltas and target-specific browser compatibility settings.
- Produce byte-identical target archives and deterministic checksums from unchanged source.
- Generate store descriptions and synthetic listing screenshots deterministically from repository-owned inputs, with permission/privacy claims checked against each packaged manifest.
- Add fail-closed Chrome Web Store and Firefox Add-ons signing/upload automation whose credentials remain owner-held; when credentials are absent, emit a machine-readable blocker naming every missing secret and perform no upload.
- Add a bounded smoke harness and evidence record for the compatible workspace-composed Platform profile, without treating fixtures, a missing profile, or an unreachable deployment as live proof.
- Extend the local/hosted gate and release documentation for the build matrix, package smoke, store assets, credential boundary, and composed-profile evidence.

## Capabilities

### New Capabilities

- `extension-release-delivery`: Deterministic store material, fail-closed owner-credential publication, and truthful composed-profile smoke evidence.

### Modified Capabilities

- `build-and-packaging`: Extend the single Chromium package guarantee to isolated Chromium and Firefox MV3 targets with byte-stable archives and target-aware packaged smoke validation.

## Impact

- Affected surfaces: manifest generation, packaging scripts, store-listing assets, release/upload workflows, CI/gate commands, smoke evidence, and release/development documentation.
- No popup, options, background, content-script, storage, API-client, Platform API, or shared contract behavior changes.
- Browser permissions remain the existing audited minimum for both targets; the Firefox delta is limited to browser-declared compatibility metadata and cheap MV3 differences.
- Store credentials and signing keys stay outside git and are read only by explicitly invoked release automation or protected hosted jobs.
- Workspace owns Compose lifecycle and shared contracts; this repository owns only its compatibility smoke client and evidence format.
