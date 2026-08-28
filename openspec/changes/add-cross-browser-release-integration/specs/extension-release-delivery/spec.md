## Purpose

Defines the reproducible store material, owner-gated publication boundary, and truthful composed-workspace evidence required to release the browser extension.

## ADDED Requirements

### Requirement: Store-listing material is deterministic and truthful
The repository SHALL generate target-ready store descriptions and synthetic listing screenshots from versioned inputs. Repeating generation from unchanged inputs SHALL produce byte-identical outputs, and every permission or privacy claim SHALL agree with both packaged manifests.

#### Scenario: Store assets reproduce exactly
- **WHEN** the listing pipeline runs twice from unchanged source
- **THEN** the Chromium and Firefox descriptions, screenshots, and checksum index are byte-identical and pass dimension, format, locale, permission-claim, and prohibited-claim validation (test: `tests/store-listing-assets.test.ts`)

### Requirement: Publication is explicit and fails closed without owner credentials
Store signing and upload SHALL run only after an explicit publish invocation, SHALL read secrets exclusively from the process credential environment, and SHALL never print or persist secret values. If any credential required for a selected store is absent, automation SHALL perform no network mutation, exit unsuccessfully, and emit a machine-readable blocker listing the exact missing credential names and the selected store.

#### Scenario: Missing credentials produce an exact blocker
- **WHEN** publication is requested for Chromium and Firefox with an empty credential environment
- **THEN** no upload or signing request occurs, the command fails, and its blocker lists every required Chrome Web Store and Mozilla Add-ons credential name without any credential value (test: `tests/release-upload.test.ts`)

#### Scenario: Dry-run validates artifacts without publishing
- **WHEN** release automation runs in its default non-publishing mode over both packaged targets
- **THEN** it validates artifact digests, version alignment, store identifiers, and credential schema while making no store mutation (test: `tests/release-upload.test.ts`)

### Requirement: Composed-workspace smoke evidence has a truthful provenance boundary
The repository SHALL provide a smoke command that targets an explicitly supplied, task-namespaced workspace-composed Platform origin using synthetic credentials only. A successful evidence record SHALL bind the tested extension artifacts, repository revision, workspace revision/profile, public origin, observed checks, and teardown result; a fixture, mock, absent profile, unreachable origin, or incomplete teardown MUST be recorded as blocked and MUST NOT be labelled as a passing composed smoke.

#### Scenario: Compatible composed profile records passing evidence
- **WHEN** both packaged targets are validated against a running compatible workspace profile and the profile is torn down successfully
- **THEN** the evidence record identifies both artifact digests and exact revisions, reports every smoke assertion as passed, and reports namespace-safe teardown (test: `tests/workspace-smoke.test.ts` plus the recorded composed-profile run)

#### Scenario: Missing composed profile remains a blocker
- **WHEN** the smoke command cannot resolve or reach the requested workspace profile
- **THEN** it exits unsuccessfully and records the exact missing profile input or failed public check without fabricating passing evidence (test: `tests/workspace-smoke.test.ts`)

### Requirement: Hosted release jobs preserve least privilege
Hosted automation SHALL keep ordinary CI read-only and SHALL isolate publication behind a manually authorized release job/environment. The publication job SHALL build and verify artifacts before requesting credentials, SHALL expose only the selected store's secrets to that store step, and SHALL not publish from pull requests.

#### Scenario: CI and release workflow permissions remain separated
- **WHEN** workflow policy tests inspect hosted automation
- **THEN** pull-request and main CI have read-only repository permissions and no store secret references, while publishing exists only behind an explicit owner-authorized release trigger (test: `tests/release-workflow-policy.test.ts`)
