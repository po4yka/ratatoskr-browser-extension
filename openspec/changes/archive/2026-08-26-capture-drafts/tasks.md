## 1. Shared draft model

- [x] 1.1 Add `tests/capture-drafts.test.ts` with `constructs popup, page-menu, link-menu, and selection-menu drafts` plus `transitions a staged draft through ready, staged, submitted, and error`; run it and confirm its missing-module assertions fail before implementation.
- [x] 1.2 Implement the shared minimized draft constructors and staging state machine in `src/capture/`, then rerun `tests/capture-drafts.test.ts` and confirm those tests pass.

## 2. Explicit browser entry points

- [x] 2.1 Extend manifest and service-worker tests with failing assertions that the manifest requests only `activeTab` and `contextMenus` and that install registers page, link, and selection commands which stage shared drafts; run the targeted tests before implementation.
- [x] 2.2 Add the narrow manifest permissions and service-worker context-menu adapters, then rerun the manifest and worker tests and confirm they pass without host permissions or networking.

## 3. Accessible popup draft staging

- [x] 3.1 Add failing popup markup tests asserting a keyboard-operable primary stage control, URL/title/selection preview regions, and an `aria-live` state announcement; run the targeted test before implementation.
- [x] 3.2 Replace the popup stub with active-tab draft preview and explicit local staging behavior, then rerun the popup test and confirm it passes.

## 4. Integrated verification

- [x] 4.1 Run `npm run gate`, `openspec validate --all --strict`, and `openspec validate --archived`; inspect the final diff and confirm no submission networking, host permission, content script, or unrelated change was added.
