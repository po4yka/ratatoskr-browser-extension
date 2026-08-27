# Browser permission rationale

This table is the reviewed permission baseline for implementation-plan items 1–9. Any
manifest permission or host-pattern addition requires a new reviewed change that names the
user-visible capability and explains why `activeTab` or an explicit action is insufficient.

| Permission | Plan items | User-visible purpose | Why this is minimal |
| --- | --- | --- | --- |
| `activeTab` | 2, 3, 4, 6, 7, 8 | Lets an explicit popup or menu action read the current tab's URL and title. | Access is temporary and tied to a user gesture; it avoids persistent page access and `tabs`. |
| `alarms` | 4, 6 | Wakes retry delivery only for an explicit, locally retained capture after its persisted backoff delay. | MV3 workers cannot retain timers across suspension; it schedules no page monitoring, provider work, or browser-wide polling. |
| `contextMenus` | 2 | Offers explicit page, link, and selection save actions. | It is limited to the three shipped user-initiated menu entries. |
| `storage` | 4, 5, 6, 9 | Persists the local queue, registered-device state, bounded operation status, and user settings. | Extension-local storage is the narrow browser capability for durable MV3 state; it grants no page or host access. |
| `optional_host_permissions` | 5, 6 | Lets an explicit pairing action and its queued capture reach the user-entered Ratatoskr HTTPS origin. | The manifest declares HTTPS only; the options page requests only that exact origin, never persistent page access. |

## Not requested in this milestone

| Permission or grant | Reason |
| --- | --- |
| `host_permissions` | Pairing requests an optional exact HTTPS origin instead; no persistent page access is granted. |
| `cookies`, `history`, `tabs`, `webRequest`, `downloads` | Ratatoskr never captures provider sessions, browsing history, hidden traffic, or downloaded files. |
| `scripting` and static `content_scripts` | The protocol has no registered page presence or injection. A future explicit extraction feature requires its own permission and privacy review. |
| `commands`, `notifications` | Keyboard shortcuts and notifications are not implemented yet; each will be requested only with its user-visible feature. |
