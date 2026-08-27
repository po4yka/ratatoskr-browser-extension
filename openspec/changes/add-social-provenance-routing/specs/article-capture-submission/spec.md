## MODIFIED Requirements

### Requirement: Staged article drafts submit through the existing Platform capture boundary
The extension SHALL submit an explicitly staged generic-article draft only after an explicit
quick-save or tracked-save action. It SHALL send the draft URL and its stable local idempotency key
to Platform's generic capture endpoint, SHALL retain that key for retry and restart recovery, and
SHALL NOT send titles, selected text, page bodies, browser credentials, or hidden page data through
that endpoint. A draft recognized as a supported social permalink SHALL use the social-capture
route instead and SHALL NOT be submitted as a generic article.

#### Scenario: A delivery retry retains the same Platform operation identity
- **WHEN** an already queued staged generic-article draft is retried after a retryable transport
  failure
- **THEN** the extension resends its original idempotency key and treats Platform's returned
  operation identifier as the same capture rather than creating another user capture

#### Scenario: A social permalink does not enter generic article capture
- **WHEN** a staged draft is classified as a supported social permalink
- **THEN** the extension does not send it to the generic article capture endpoint or represent its
  outcome as article extraction
