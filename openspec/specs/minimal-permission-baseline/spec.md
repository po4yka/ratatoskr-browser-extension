# minimal-permission-baseline Specification

## Purpose

Records the smallest reviewed browser-permission baseline for the extension roadmap and makes every requested permission traceable to a user-visible Ratatoskr capability.

## Requirements

### Requirement: Reviewed permission baseline

The packaged manifest SHALL request only `activeTab`, `alarms`, `contextMenus`, and `storage` as
extension permissions. It SHALL request no persistent host permissions or static content scripts in
this milestone. The `alarms` permission SHALL be used only to wake due retries for explicitly
staged local captures.

#### Scenario: Manifest permission audit

- **WHEN** the manifest is checked against the reviewed baseline
- **THEN** it contains exactly the approved permissions and no host-permission entry

### Requirement: Committed permission rationale

The repository SHALL include a committed rationale table mapping every requested permission to the applicable implementation-plan items, its user-visible purpose, and why a broader grant is not used. The table SHALL list persistent host access, cookies, history, tabs, webRequest, downloads, scripting, commands, and notifications as not requested in this milestone unless a later reviewed implementation demonstrably requires one.

#### Scenario: Permission rationale review

- **WHEN** a reviewer compares the manifest to the rationale table
- **THEN** every requested permission has a matching justification and every omitted broad grant is explicitly recorded

### Requirement: Permission additions are reviewed

The extension SHALL require a new reviewed change before adding a browser permission or a host pattern. The change SHALL justify the user-visible capability and explain why existing `activeTab` or an explicit action cannot meet it.

#### Scenario: Future feature needs broader page access

- **WHEN** a proposed feature needs a persistent host grant or another browser permission
- **THEN** the feature is blocked from adding it until its reviewed rationale is committed
