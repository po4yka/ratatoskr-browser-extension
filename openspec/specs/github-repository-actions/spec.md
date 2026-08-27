# github-repository-actions Specification

## Purpose

Lets an explicit browser capture recognize a GitHub repository and safely use GitHub Catalog preview and action contracts without exposing provider credentials or overstating partial results.

## Requirements

### Requirement: Repository drafts are classified conservatively

The extension SHALL recognize a GitHub repository only from an HTTPS `github.com` repository-root URL with one owner and one repository path segment. It SHALL preserve the original captured URL, derive only the contract-valid preview URL needed for routing, and SHALL treat credentials, ports, query strings, fragments, sub-resources, lookalike hosts, and unsupported schemes as non-repository captures.

#### Scenario: Repository-root URL creates GitHub intent

- **WHEN** an explicit page or link draft contains `https://github.com/owner/repository/`
- **THEN** the draft preserves that original URL and carries `https://github.com/owner/repository` as its GitHub preview URL

#### Scenario: GitHub sub-resource remains outside the repository flow

- **WHEN** an explicit draft contains a GitHub issues, pull, tree, blob, release, query-bearing, fragment-bearing, credential-bearing, or lookalike-host URL
- **THEN** the draft carries no GitHub repository intent

### Requirement: Preview is gated by current GitHub capability

The extension SHALL request a metadata preview only when Platform's authenticated capability document contains a non-stale `github` service document that advertises repository preview. It SHALL offer only the action modes contained in both the service capability document and the preview response, and SHALL show a truthful unavailable state without generic submission when GitHub is absent, stale, malformed, or no longer capable.

#### Scenario: Healthy GitHub service offers a metadata preview

- **WHEN** a repository draft is active and the current non-stale GitHub capability advertises preview
- **THEN** the popup displays the contract-validated repository identity, description when present, stargazer count, primary language when present, and only the available action modes

#### Scenario: Missing GitHub service disables repository actions

- **WHEN** a repository draft is active and the capability document has no healthy GitHub preview capability
- **THEN** the popup explains that GitHub actions are unavailable and neither previews nor submits the repository through the generic article path

### Requirement: Track and star require immediate explicit confirmation

The extension SHALL require a visible confirmation dialog immediately before each `track` action and before each `star` action. The star dialog SHALL identify the external GitHub write and acting connected account reference. A cancelled, dismissed, stale, or mismatched confirmation SHALL produce no action request, and confirmation SHALL never be remembered for another mode or repository.

#### Scenario: Track without confirmation has no effect

- **WHEN** the user selects `track` but cancels or dismisses its confirmation dialog
- **THEN** no repository action request is sent

#### Scenario: Star confirmation names the external effect

- **WHEN** the user selects `star` for a preview that advertises a connected account and confirms the dialog naming that account and external GitHub write
- **THEN** exactly one star request is created for that preview target with fresh confirmation evidence and an idempotency key

#### Scenario: Star lacks account capability

- **WHEN** a preview has no connected account reference or does not advertise `star`
- **THEN** the extension does not offer an actionable star confirmation

### Requirement: Repository actions preserve component truth

The extension SHALL submit the exact preview target, selected mode, opaque confirmation evidence reference, and stable idempotency key through the authenticated GitHub action boundary, with the connected account reference present only for `star`. It SHALL validate and display the metadata, provider-star, and desired-backup component outcomes independently and SHALL preserve `partial`, `failed`, `accepted`, `refused`, `already_applied`, and `skipped` meanings without collapsing them into completed backup or overall success.

#### Scenario: Provider star succeeds and backup policy fails

- **WHEN** the action response reports metadata succeeded, provider star succeeded, desired backup failed, and aggregate partial
- **THEN** the popup reports the metadata and star successes, the desired-backup failure reason, and a partial aggregate without claiming backup completion or rolling back the star

#### Scenario: Desired backup is accepted but not verified

- **WHEN** the action response reports desired backup accepted
- **THEN** the popup states that backup policy was accepted and does not state that backup completed or was verified

#### Scenario: Malformed aggregate is refused

- **WHEN** an action response's aggregate contradicts its component outcomes or contains an unknown component status or reason
- **THEN** the extension rejects the response as invalid and displays no fabricated success

### Requirement: GitHub flow adds no browser privilege

The GitHub repository flow SHALL use the existing extension-page-to-worker boundary, paired Platform device credential, and HTTPS endpoint. It SHALL NOT receive a GitHub credential, call GitHub directly, add a host permission, or read cookies, history, page storage, hidden traffic, or page DOM.

#### Scenario: Packaged permission audit remains unchanged

- **WHEN** the manifest and packaged extension are inspected after GitHub actions are added
- **THEN** the reviewed permission and host-permission snapshots are unchanged
