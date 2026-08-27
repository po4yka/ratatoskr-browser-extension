## Purpose

Provides explicit, idempotent generic-article delivery with an immediate save path and recoverable
operation tracking while keeping Platform's operation truth and result ownership authoritative.

## ADDED Requirements

### Requirement: Staged article drafts submit through the existing Platform capture boundary
The extension SHALL submit an explicitly staged draft only after an explicit quick-save or
tracked-save action. It SHALL send the draft URL and its stable local idempotency key to Platform's
capture endpoint, SHALL retain that key for retry and restart recovery, and SHALL NOT send titles,
selected text, page bodies, browser credentials, or hidden page data through that endpoint.

#### Scenario: A delivery retry retains the same Platform operation identity
- **WHEN** an already queued staged draft is retried after a retryable transport failure
- **THEN** the extension resends its original idempotency key and treats Platform's returned
  operation identifier as the same capture rather than creating another user capture

### Requirement: Quick save remains an immediate queued action
The extension SHALL offer quick save as an explicit link-only submission mode. It SHALL present a
queued indicator once local durable delivery succeeds and SHALL NOT wait for extraction or analysis
completion or infer completion from elapsed time.

#### Scenario: Quick save is locally queued before Platform answers
- **WHEN** the user selects quick save for a staged article draft while Platform is unavailable
- **THEN** the extension presents the draft as queued for delivery and does not display a completed
  analysis or operation-progress panel

### Requirement: Tracked save presents recoverable Platform operation truth
The extension SHALL offer tracked save as an explicit mode. Once Platform accepts the capture, it
SHALL persist the operation identifier and poll the authenticated operation endpoint until a
terminal snapshot is observed. It SHALL restore a tracked operation after service-worker restart,
apply only a snapshot newer than the rendered snapshot, and render Platform status, display stage,
and progress without inventing a stage vocabulary.

#### Scenario: Polling recovers after worker restart
- **WHEN** a tracked capture was accepted before worker suspension and its operation later reaches
  a terminal state
- **THEN** a restarted worker reads the persisted operation identifier, resumes polling, and presents
  that terminal snapshot

### Requirement: Terminal tracked outcomes are qualified and actionable
The extension SHALL expose a web-reader deep link only for a succeeded tracked snapshot containing
a `content.document` result with a valid `document:` target. It SHALL render a partial result only
with its warnings, and SHALL render failed or cancelled snapshots with safe error guidance. It SHALL
offer an explicit retry only when Platform marks the terminal unsuccessful snapshot retryable; that
retry SHALL create a new local capture identity and idempotency key.

#### Scenario: A completed document opens the reader
- **WHEN** a succeeded tracked snapshot contains `content.document` targeting `document:article-1`
- **THEN** the extension presents the deployment's `/documents/article-1` reader link

#### Scenario: A retryable failure is retried explicitly
- **WHEN** a tracked snapshot is failed and declares itself retryable
- **THEN** the extension renders a retry action that queues a new capture rather than presenting the
  failed operation as running
