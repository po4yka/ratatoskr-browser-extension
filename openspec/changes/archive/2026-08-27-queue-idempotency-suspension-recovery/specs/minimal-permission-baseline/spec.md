## MODIFIED Requirements

### Requirement: Reviewed permission baseline

The packaged manifest SHALL request only `activeTab`, `alarms`, `contextMenus`, and `storage` as
extension permissions. It SHALL request no persistent host permissions or static content scripts in
this milestone. The `alarms` permission SHALL be used only to wake due retries for explicitly
staged local captures.

#### Scenario: Manifest permission audit

- **WHEN** the manifest is checked against the reviewed baseline
- **THEN** it contains exactly the approved permissions and no host-permission entry
