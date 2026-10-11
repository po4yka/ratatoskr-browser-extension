## ADDED Requirements

### Requirement: Provider permalink paths match the lane grammar
The extension SHALL route an `https` permalink on a recognised host to a provider lane only when its path matches the grammar the lane's service accepts: for X `^/[A-Za-z0-9_]{1,15}/status/[0-9]{1,19}/?$`; for Instagram `^/(?:[^/]+/)?(?:p|reel|reels|tv)/[A-Za-z0-9_-]{1,64}/?$`; for Threads `^/@[A-Za-z0-9._]{1,30}/post/[A-Za-z0-9_-]{1,128}/?$`. A permalink that matches no grammar SHALL be captured as a plain URL through the generic lane, without a social member.

#### Scenario: Boundary lengths are accepted
- **WHEN** the classifier receives an X status id of 19 digits, a Threads handle of 30 characters, a Threads post code of 128 characters, an Instagram shortcode of 64 characters, or an Instagram `reels`, `tv` or username-prefixed path
- **THEN** it selects the provider and the draft carries the social member with that provider

#### Scenario: The first length beyond the boundary is refused
- **WHEN** the classifier receives an X status id of 20 digits, an X handle of 16 characters, a Threads handle of 31 characters, a Threads post code of 129 characters or an empty code, or an Instagram shortcode of 65 characters
- **THEN** it selects no provider and the draft is a plain URL capture
