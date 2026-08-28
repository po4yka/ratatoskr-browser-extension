## MODIFIED Requirements

### Requirement: Build produces an installable unpacked extension
Running the build SHALL produce separate `chromium` and `firefox` distribution directories. Each directory SHALL contain a valid Manifest V3 manifest named for the Ratatoskr browser extension together with every referenced service worker, popup, options, localization, style, and icon asset, so each target is loadable by its declared browser family without missing files.

#### Scenario: Build output completeness
- **WHEN** the build matrix runs from a clean checkout and both output trees are checked against their manifests
- **THEN** each manifest parses with `manifest_version` 3, identifies Ratatoskr, contains every referenced file, and passes the target-specific packaged smoke checks (test: `tests/cross-browser-build.test.ts`)

### Requirement: Repackaging is byte-stable
Packaging the built extension into Chromium and Firefox distributable archives SHALL be deterministic: the same source tree packaged repeatedly SHALL produce byte-identical target archives and checksum metadata through fixed entry ordering, fixed entry timestamps, and canonical metadata serialization independent of wall-clock time or filesystem metadata.

#### Scenario: Golden determinism check
- **WHEN** the package matrix runs twice over unchanged source in separate processes
- **THEN** the two Chromium archives match byte for byte, the two Firefox archives match byte for byte, and both checksum manifests are identical (test: `tests/package-determinism.test.ts`)

## ADDED Requirements

### Requirement: Browser manifest differences are isolated and audited
The build SHALL derive both target manifests from one shared manifest source plus explicit target deltas. A target delta MUST NOT add a permission, host permission, externally connectable surface, remote-code allowance, or capture behavior without a matching reviewed permission and security baseline.

#### Scenario: Firefox delta stays compatibility-only
- **WHEN** the manifest matrix test compares the generated Chromium and Firefox manifests
- **THEN** their behavioral permissions, host access, CSP, action, commands, background entry, and extension pages are equal, and the only differences belong to the checked compatibility allowlist (test: `tests/cross-browser-manifest.test.ts`)

### Requirement: Packaged artifacts are smoke-validated
The release gate SHALL inspect the contents of each produced archive rather than accepting a successful zip command as proof. It SHALL reject missing referenced files, path traversal entries, unlisted development material, source maps, remote executable code, and a manifest whose target identity differs from the archive name.

#### Scenario: Both release archives pass packaged smoke
- **WHEN** the packaged-extension smoke runs against the Chromium and Firefox release archives
- **THEN** both archives pass manifest/reference, forbidden-entry, CSP, target-identity, and permission checks, and the smoke reports the digest it inspected (test: `tests/packaged-extension-smoke.test.ts`)
