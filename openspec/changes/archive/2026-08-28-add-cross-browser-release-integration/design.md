## Context

See `proposal.md` for motivation. The current build emits one Chromium-shaped `dist/` tree and one deterministic zip. Runtime code already stays behind the `chrome.*` WebExtensions surface; the material Firefox MV3 incompatibility is the background declaration, while signing also requires a stable Gecko add-on ID and current data-collection declaration. The repository has no store credentials. The workspace currently owns one task-namespaced `web-operational` Compose profile which exposes a synthetic Platform Edge origin; it is usable as a real composed dependency but is not a browser-extension-specific harness.

The existing `web-platform-operational-integration` workspace spec remains the authority for profile namespace and teardown semantics. This change does not modify that cross-repository contract or claim that the extension owns Compose resources.

## Goals / Non-Goals

**Goals:**

- Keep one runtime source and make browser differences inspectable data rather than conditionals scattered through code.
- Make build, archives, listing material, and their digest indexes reproducible on supported developer/CI hosts.
- Provide real publication code while making absent credentials an exact, safe blocker rather than a skipped success.
- Record the distinction between static/package smoke, a live composed-profile run, and actual store publication.

**Non-Goals:**

- Firefox-only product features, Safari support, Manifest V2, or compatibility shims for old package layouts.
- Provider synchronization, Platform API changes, or a new general workspace integration harness.
- Automatic store-listing mutation: descriptions and screenshots are generated for reviewed upload, while package upload/signing is automated.
- Creating store accounts, accepting distribution agreements, enabling Google 2FA, or selecting production visibility on the owner's behalf.

## Decisions

### Build one shared tree through explicit target manifests

Replace the monolithic manifest input with a shared JSON source and two small target deltas. The build command accepts only the closed targets `chromium`, `firefox`, or `all` and writes `dist/<target>/`. Chromium keeps `background.service_worker`; Firefox uses `background.scripts`, adds a stable repository-owned Gecko ID, and declares the collected website activity/content needed for explicit URL and selected-text capture. Tests compare semantic manifest sections and fail on any difference outside the compatibility allowlist.

This is preferred over maintaining complete manifest copies, which would allow permissions and CSP to drift, and over runtime browser detection, which cannot repair load-time manifest incompatibility.

### Extend the deterministic archive primitive, then inspect the archive

The existing sorted-entry/fixed-mtime zip primitive is retained and parameterized per target. `package` builds both targets, emits target-named archives plus one canonical `SHA256SUMS`, and a smoke reader inspects the archive contents and manifest. Archive validation rejects traversal paths, missing references, source maps, development endpoints/material, and target mismatches.

This is preferred over store-specific packagers for unsigned artifacts because their archive metadata is not the repository's deterministic contract. Mozilla `web-ext` is used only at the signing boundary, after the deterministic Firefox tree and zip have passed local verification.

### Generate store screenshots with a repository-owned rasterizer

A versioned listing model supplies locale strings, audited permission/privacy statements, and a small set of screenshot scenes. A Node generator draws fixed-size RGBA canvases with repository icons, fixed colors/layout, and an embedded bitmap glyph map, then writes PNG chunks with fixed filters/compression inputs. It produces per-store text/metadata and a canonical digest index.

This avoids a browser screenshot dependency, system-font drift, remote templates, and a native image dependency. The deliberate cost is a constrained visual vocabulary; store art remains synthetic and must not be presented as live deployment proof.

### Separate validation, upload, and publish mutations

`release:check` is the default and never contacts a store. `release:upload -- --store <store> --execute` is the only mutating entry point. It validates target archive digests and versions before reading credentials.

Chrome Web Store upload uses the official v2 API and OAuth refresh flow with `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, and `CWS_EXTENSION_ID`; publication is a separate explicit flag after a successful upload. Firefox listed signing/upload uses Mozilla `web-ext` with `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`, a committed Gecko ID, and generated AMO metadata. Missing inputs produce a redacted JSON blocker containing credential names only. Network calls are injectable for tests so the empty-credential path proves that no mutation occurred.

An owner-triggered workflow has separate Chromium and Firefox jobs under the protected `extension-stores` environment. Ordinary CI remains `contents: read`, never references store secrets, and runs only non-mutating checks.

### Treat composed smoke as live evidence, not as a gate fixture

The extension smoke command accepts an explicit Platform public origin, workspace root/revision, profile identifier, task namespace, and teardown-evidence path. It validates both archives, checks the live public Platform status/capability boundary through HTTP, and writes JSON evidence with artifact digests and exact observed inputs. It refuses non-loopback plain HTTP, non-synthetic credentials, missing namespace/profile/revision, failed assertions, or incomplete namespaced teardown.

The actual acceptance run uses the workspace-owned `integration/compose/web-operational.yaml` at an exact workspace revision. Compose startup and teardown stay outside extension code. Unit tests use a local synthetic HTTP server only to verify the smoke client and blocker behavior; their output is never labelled composed evidence.

### Keep evidence outside deterministic product artifacts

Generated packages/listing material live under ignored output directories and are reproduced by the gate. A reviewed Markdown evidence note records the exact command, implementation commit, workspace/profile revision, artifact digests, observed result, teardown boundary, and publication blocker. The evidence note distinguishes `local gate green`, `composed smoke passed`, `upload blocked`, and `store published`; none implies another.

## Risks / Trade-offs

- [Firefox accepts MV3 but has different background lifetime behavior] → Use an event-page declaration and reuse the already persistence-backed queue; lint/package smoke both manifests and do not claim full Firefox behavioral parity beyond exercised flows.
- [Permanent store identifiers become externally significant after first publication] → Commit one Gecko ID before publication and keep the Chrome item ID owner-supplied; changing either after publication requires an explicit product decision.
- [Generated synthetic screenshots may lag visual behavior] → Derive claims from the listing model and validate dimensions/digests, while describing screenshots as generated product illustrations rather than captured live UI.
- [Store APIs and policies change] → Keep endpoints/options isolated, pin `web-ext`, test request shapes without network, and cite current official setup instructions in release documentation.
- [The available workspace profile is Web-oriented] → Exercise only its public Platform boundary, name the exact profile, and avoid claiming capture submission or extension-in-browser E2E that the profile cannot support.
- [Live Compose smoke is expensive and host-dependent] → Keep it outside ordinary unit tests, use `build-gate` for the top-level run, require a unique namespace, and preserve exact blocker evidence when Docker or compatible revisions are unavailable.
- [Release credentials could leak through subprocess output] → Pass secrets only in the child environment, redact all child errors, disable config discovery for `web-ext`, and never serialize values.

## Migration Plan

1. Land matrix generation and update every build/package caller from `dist/` to the two explicit target directories.
2. Add deterministic listing generation, package smoke, release validation, and read-only CI coverage.
3. Run the full local gate and commit the implementation so live evidence can name an immutable implementation revision.
4. Run the task-namespaced composed smoke against the exact workspace profile and record its result and teardown evidence in a follow-up evidence commit.
5. If owner credentials are unavailable, record the exact missing names and stop before any store mutation. When credentials are later provisioned in the protected environment, run upload first and publication only through a second explicit authorization.

Rollback removes the new release workflow/scripts and restores single-target commands at the prior commit. Published store versions cannot be rolled back by git; store rollback/unpublish remains an owner action and is intentionally outside this automation.
