# capture-drafts Specification

## Purpose

Provide a single, explicit, minimized capture draft experience for page, link, and selected-text browser actions before delivery is implemented.

## Requirements

### Requirement: Explicit entry points construct a minimized capture draft

The extension SHALL construct a capture draft only after the user opens the popup and chooses its stage action or invokes an extension context-menu command. A page draft SHALL use the active page URL and title; a link draft SHALL retain the link target and source page URL; a selection draft SHALL retain the source page URL, title, and selected text. Each draft SHALL record its entry-point kind and SHALL NOT contain page bodies, cookies, browsing history, hidden browser traffic, or credentials.

#### Scenario: Popup stages the current page
- **WHEN** the user stages the current supported tab from the popup
- **THEN** the displayed draft contains that tab's URL and title and identifies the page entry point

#### Scenario: Page context menu stages the current page
- **WHEN** the user invokes the page context-menu command on a supported page
- **THEN** the staged draft contains the menu tab's URL and title and identifies the page entry point

#### Scenario: Link context menu preserves both URLs
- **WHEN** the user invokes the link context-menu command
- **THEN** the staged draft contains the link target as its capture URL and the invoking page as its source-page URL

#### Scenario: Selection context menu preserves only explicit selection text
- **WHEN** the user invokes the selection context-menu command
- **THEN** the staged draft contains the invoking page metadata and the menu-provided selection text without page content

### Requirement: Draft staging communicates truthful local state

The extension SHALL present the capture draft as ready before it is locally staged, staged after the
explicit stage action succeeds, queued after an explicit delivery action durably records it for
Platform submission, submitted only when a delivery integration reports Platform acceptance, and
error when draft construction, staging, or delivery fails. It SHALL distinguish quick-save queued
state from tracked-save operation progress and SHALL NOT present a local stage or queue record as
backend submission or completion.

#### Scenario: Explicit stage succeeds without submission
- **WHEN** a valid draft is staged from the popup or context menu
- **THEN** its presentation state becomes staged and does not claim that Ratatoskr accepted it

#### Scenario: Explicit quick save queues delivery
- **WHEN** the user selects quick save for a valid staged draft
- **THEN** its presentation state becomes queued locally and does not claim extraction or analysis
  completed

#### Scenario: A delivery integration reports acceptance
- **WHEN** a delivery integration reports Platform acceptance for a staged draft
- **THEN** the presentation state becomes submitted and a tracked-save presentation may display the
  returned operation status

#### Scenario: Draft construction fails
- **WHEN** an entry point lacks the required tab or menu context
- **THEN** its presentation state becomes error with actionable local guidance and no draft is staged

### Requirement: Popup exposes the current-tab draft accessibly

The popup SHALL obtain only the active tab context available through the explicit popup action and SHALL show the URL, title, and any available explicit selection text in its draft preview. Its primary stage action SHALL be reachable and operable with the keyboard, and its state announcement SHALL be exposed to assistive technology.

#### Scenario: Keyboard user stages a popup draft
- **WHEN** a keyboard user focuses and activates the popup's primary stage action
- **THEN** the current-tab draft stages and the popup announces the staged state

#### Scenario: Popup cannot read the active tab
- **WHEN** the browser does not provide a usable active-tab context
- **THEN** the popup displays the error state and does not request broader permissions

### Requirement: Context-menu capability remains narrowly permissioned

The extension SHALL expose explicit page, link, and selection context-menu commands. It SHALL request only `activeTab` and `contextMenus` for this feature and SHALL NOT add host permissions, persistent content scripts, history, cookies, web-request access, or submission networking.

#### Scenario: Manifest permission review
- **WHEN** the extension manifest is inspected for this feature
- **THEN** it includes `activeTab` and `contextMenus` and contains no host permissions
