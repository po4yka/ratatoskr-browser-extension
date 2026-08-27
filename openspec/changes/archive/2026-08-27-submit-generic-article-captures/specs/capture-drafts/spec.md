## MODIFIED Requirements

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
