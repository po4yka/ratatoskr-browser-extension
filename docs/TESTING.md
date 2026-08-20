# Browser Extension testing strategy

Required tests:

- URL/kind classification, canonicalization, selected-text/title size and hostile Unicode/HTML.
- Popup/context-menu/action flows and external-write confirmation.
- Content-script/runtime sender/message validation and no credential access.
- Durable queue across service-worker stop/restart, offline, timeout, duplicate submit, retry/cancel/revoke.
- Device pairing/refresh/revoke and no-secret logs/storage export.
- Permission grant/denial/removal and capability degradation.
- CSP/no-eval/no-remote-code, dependency audit, deterministic package contents.
- Browser automation on Chromium and supported Firefox path.
- Workspace extension -> Platform -> article/social/GitHub operation flow.

Tests use local mock Platform and synthetic pages; no real provider session or private site fixture.

## Test-first

A change is planned before it is built, and the plan is a task list in which behaviour arrives in
pairs: one task adds a failing test, the next makes it pass. `openspec/config.yaml` carries that
rule, which is what puts it into every planning and implementation request rather than only into this
document.

The loop:

1. Write the test the scenario names. Run it. Confirm it fails, and read the failure — a test that
   fails because it does not compile has proved nothing about the behaviour.
2. Write the smallest change that makes it pass. Run it again.
3. Refactor only once it is green, adding no test and changing no behaviour.

Two checks stand behind this, and neither of them can see the order:

- `openspec validate --archived`, in `.github/workflows/openspec.yml`, fails when a change was
  archived with a task left unticked.
- A step in `.github/workflows/fleet.yml` fails when this repository holds a manifest and a `ci.yml`
  that never runs a test.

`ratatoskr-workspace/docs/QUALITY_GATES.md` records why the order itself is not checkable, rather
than leaving the gap to be discovered.
