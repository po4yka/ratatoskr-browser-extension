## Context

See [proposal.md](proposal.md) for motivation and [the capture-drafts delta spec](specs/capture-drafts/spec.md) for required behavior. The MV3 scaffold currently has a popup, a service worker, and no browser permissions or capture data model.

## Goals / Non-Goals

**Goals:**

- Use one pure TypeScript model to construct and transition page, link, and selection drafts from browser-shaped inputs.
- Keep popup and service-worker adapters thin and explicit.
- Request only `activeTab` and `contextMenus`, with no host permissions.
- Give the popup accessible, truthful state feedback.

**Non-Goals:**

- Submission, device credentials, storage persistence, idempotency, a message protocol, content scripts, provider work, or backend contract changes.
- Treating a locally staged draft as a delivered capture.

## Decisions

### Pure shared model with browser-shaped adapter inputs

The shared module will accept a minimal tab context and a discriminated page/link/selection invocation, returning only the draft fields each entry point is authorized to supply. It will also own the pure state transition rules. The popup and service worker will translate Chrome API values into these inputs.

Keeping the model free of `chrome.*` makes mocked entry-point tests direct and avoids coupling UI state to MV3 worker lifetime. Putting construction separately in each surface would drift payload semantics and duplicate validation.

### Active-tab and context-menu APIs only

The popup will query its active tab only while the popup is open. The worker will use the menu callback's tab and menu data. This uses `activeTab` and `contextMenus`, avoiding tabs and persistent host permissions. Selection comes only from the explicit menu payload in this slice; the popup does not inject a content script to discover a selection.

### Truthful four-state display

The presentation model supports `ready`, `staged`, `submitted`, and `error`. Popup and context-menu actions can create `ready`, transition to `staged`, or enter `error`. `submitted` is reserved for a future delivery adapter's acceptance signal and is rendered distinctly but has no local trigger, so this slice cannot falsely represent a local stage as Platform acceptance.

### Minimal vanilla DOM popup

The existing no-framework popup remains vanilla TypeScript and HTML. It will use semantic form controls, a visible focus indicator, and an `aria-live` status region. A framework would add a dependency and architecture choice not needed for the first interactive surface.

## Risks / Trade-offs

- [MV3 worker suspension loses an in-memory context-menu presentation state] → This milestone shares construction and staging rules but makes no durability guarantee; the queue/idempotency milestone will persist submitted work before network activity.
- [Popup cannot see arbitrary page selection without a content script] → The popup preview displays selection only if an allowed active-tab read supplies it; explicit selection context-menu capture remains available without host permissions.
- [Browser API shapes differ across targets] → Keep the adapter boundary narrow and unit-test the browser-independent model; compatibility adapters are deferred until the cross-browser milestone.

## Migration Plan

1. Update the manifest permission baseline and register the three menu commands on install.
2. Add the shared model and tests before adapters.
3. Replace the popup stub with the accessible draft preview and local staging behavior.
4. Rollback removes the new permission, menu registrations, popup behavior, and model together; no remote or persisted data exists in this change.
