## Purpose

Guarantees that the first scaffold of the extension is verifiable: a build anyone can load unpacked, a manifest that stays minimally permissioned and strictly sandboxed, packaging whose output does not change when the source does not, and a product gate that cannot drift from its documented command list.

## ADDED Requirements

### Requirement: Build produces an installable unpacked extension
Running the build SHALL produce a distribution directory containing a valid Manifest V3 manifest named for the Ratatoskr browser extension, together with every file that manifest references (service worker entry, popup entry, options entry, icons), so the directory loads unpacked in Chromium without warnings about missing assets.

#### Scenario: Build output completeness
- **WHEN** the build command runs from a clean checkout and the distribution directory is checked against the manifest
- **THEN** the manifest parses as JSON with `manifest_version` 3 and the product name Ratatoskr, and every path the manifest references exists inside the distribution directory (test: `tests/build-artifacts.test.ts`)

### Requirement: Manifest permissions stay minimal
The manifest SHALL request no permissions while no implemented feature needs one, and any future permission addition MUST be a deliberate, reviewed act captured by an updated baseline.

#### Scenario: Permission baseline unchanged
- **WHEN** the permission snapshot test reads the manifest's requested permissions and host permissions
- **THEN** both are empty, and the test names itself as the place to update when a reviewed feature justifies more (test: `tests/manifest.test.ts`)

### Requirement: Strict content security policy with no remote code
The manifest SHALL declare an extension-pages content security policy that allows scripts and objects only from the extension's own origin, and SHALL NOT allow `unsafe-eval`, `unsafe-inline`, or any remote host, so no remotely hosted or evaluable code can run in extension pages.

#### Scenario: CSP forbids remote and evaluable code
- **WHEN** the CSP test parses the declared extension-pages policy
- **THEN** script-src and object-src are `'self'`, and no directive value contains `unsafe-eval`, `unsafe-inline`, or a remote origin (test: `tests/manifest-csp.test.ts`)

### Requirement: Repackaging is byte-stable
Packaging the built extension into a distributable archive SHALL be deterministic: the same source tree packaged repeatedly SHALL produce archives with identical bytes, through fixed entry ordering and fixed entry timestamps independent of wall-clock time or filesystem metadata.

#### Scenario: Golden determinism check
- **WHEN** the package command runs twice over the same build output, in separate processes
- **THEN** both produced archives have identical SHA-256 digests (test: `tests/package-determinism.test.ts`)

### Requirement: Documented gate cannot drift from real scripts
DEVELOPMENT.md SHALL record the exact command list the product gate runs, and the repository SHALL carry a parity test that fails whenever that recorded list diverges from the scripts actually defined in package.json, in the same spirit as the fleet-wide workflow-vs-document comparison.

#### Scenario: Gate command list matches package scripts
- **WHEN** the parity test extracts the fenced shell command list from DEVELOPMENT.md and compares it with the corresponding package.json scripts
- **THEN** every documented command resolves to a defined script with the same invocation, and every gate script appears in the documented list (test: `tests/gate-parity.test.ts`)
