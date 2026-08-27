# accessible-localizable-surfaces Specification

## Purpose

Makes the popup and options surfaces operable and understandable with keyboard and assistive technology while keeping all user-visible text ready for additional locales.

## Requirements

### Requirement: Every interactive surface meets the accessibility baseline

The popup and options page SHALL use a declared document language, one main landmark and heading hierarchy, programmatically associated labels and descriptions, semantic groups for related choices, native keyboard-operable controls, named confirmation dialogs, visible focus indicators, and polite or assertive live regions for state changes according to urgency. Opening a dialog SHALL place focus inside it, closing it SHALL restore focus to its invoker, and a destructive action SHALL never depend on color, pointer input, or timing alone.

#### Scenario: Automated accessibility checklist passes

- **WHEN** the committed accessibility checklist inspects every popup and options control, status region, mode group, queue region, operation panel, and confirmation dialog
- **THEN** it reports every required language, landmark, name, relationship, keyboard, focus, and live-region check as passing

#### Scenario: Keyboard user completes a confirmation

- **WHEN** a keyboard user opens a destructive-action dialog, moves through its controls, and cancels it
- **THEN** the dialog closes without action and focus returns to the button that opened it

#### Scenario: Dynamic state is announced without stealing focus

- **WHEN** pairing, queue, operation, revoke, clear, or diagnostics state changes asynchronously
- **THEN** the relevant live region announces the concise localized result while focus remains on the user's current control unless a dialog transition requires restoration

### Requirement: User-visible strings are externalized

The extension SHALL resolve manifest, popup, options, confirmation, status, error, queue, operation, and accessibility text through stable message identifiers in a packaged source-language catalog. Markup and behavior code SHALL NOT contain user-visible English or Russian fallback sentences, and missing required messages SHALL fail a committed localization-readiness check. Adding a later locale SHALL require only a new catalog and SHALL NOT require behavior-code changes.

#### Scenario: Localization-readiness check covers packaged surfaces

- **WHEN** the localization-readiness test scans the manifest, popup and options markup, and their behavior entry points
- **THEN** every user-visible string reference resolves to the source catalog and no inline English or Russian UI sentence remains

#### Scenario: Source catalog drives dynamic status

- **WHEN** a queue, pairing, diagnostics, revoke, or clear result needs a parameterized status message
- **THEN** the UI renders the catalog message with escaped substitutions rather than constructing an English sentence in behavior code
