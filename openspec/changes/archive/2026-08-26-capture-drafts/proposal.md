## Why

The scaffolded extension exposes no usable capture behavior, so an explicit user action cannot yet retain the browser context that will later be submitted to Ratatoskr. The first capture slice must make the same minimized draft available from the popup and context menu without adding network or persistent host access.

## What Changes

- Add a shared capture-draft model that constructs minimized drafts from an active tab and page, link, or selection context-menu invocation.
- Add explicit ready, staged, submitted, and error presentation state for locally staged drafts; this change does not perform network submission.
- Replace the popup stub with an accessible, keyboard-operable current-tab draft preview and explicit stage action.
- Register explicit context-menu commands for page, link target, and selection capture, all of which stage the shared draft.
- Add tests covering every entry-point draft and the staging state machine.

## Capabilities

### New Capabilities

- `capture-drafts`: Explicitly stage a minimized browser capture draft from the popup or page, link, and selection context-menu commands.

### Modified Capabilities

- None.

## Impact

- Affects the manifest permissions, service worker, popup UI, shared TypeScript capture model, and tests.
- Adds the narrowly scoped `contextMenus` permission; retains `activeTab` and adds no host permissions, content scripts, storage, or network APIs.
- Does not change Platform contracts or add dependencies.
