# social-capture-routing Specification

## Purpose
TBD - created by archiving change xr-021-r2-provider-hosts. Update Purpose after archive.

## Requirements

### Requirement: Provider permalink hosts match the fleet host sets
The extension SHALL route an `https` post permalink to the X lane when its host is one of `x.com`, `www.x.com`, `mobile.x.com`, `twitter.com`, `www.twitter.com` or `mobile.twitter.com`, and to the Threads lane when its host is one of `threads.net`, `www.threads.net`, `threads.com` or `www.threads.com`, provided the path matches the provider's post permalink grammar. It SHALL NOT route a host that merely contains or ends with one of these names, a non-`https` URL, or a profile URL.

#### Scenario: Current Threads and legacy X hosts reach their lanes
- **WHEN** the classifier receives a post permalink on `threads.com`, `www.threads.com`, `twitter.com`, `www.twitter.com` or `mobile.twitter.com`
- **THEN** the Threads hosts select `threads` and the X hosts select `x`

#### Scenario: Look-alike hosts, plain http and profiles stay generic
- **WHEN** the classifier receives `https://threads.com.evil.example/@ratatoskr/post/Cx1AbcDefGh`, `https://nottwitter.com/ratatoskr/status/1`, an `http://` X permalink, or the profile URL `https://threads.net/@ratatoskr`
- **THEN** none of them selects a provider

### Requirement: Provider permalink paths match the lane grammar
The extension SHALL route an `https` permalink on a recognised host to a provider lane only when its path matches the grammar the lane's service accepts: for X `^/[A-Za-z0-9_]{1,15}/status/[0-9]{1,19}/?$`; for Instagram `^/(?:[^/]+/)?(?:p|reel|reels|tv)/[A-Za-z0-9_-]{1,64}/?$`; for Threads `^/@[A-Za-z0-9._]{1,30}/post/[A-Za-z0-9_-]{1,128}/?$`. A permalink that matches no grammar SHALL be captured as a plain URL through the generic lane, without a social member.

#### Scenario: Boundary lengths are accepted
- **WHEN** the classifier receives an X status id of 19 digits, a Threads handle of 30 characters, a Threads post code of 128 characters, an Instagram shortcode of 64 characters, or an Instagram `reels`, `tv` or username-prefixed path
- **THEN** it selects the provider and the draft carries the social member with that provider

#### Scenario: The first length beyond the boundary is refused
- **WHEN** the classifier receives an X status id of 20 digits, an X handle of 16 characters, a Threads handle of 31 characters, a Threads post code of 129 characters or an empty code, or an Instagram shortcode of 65 characters
- **THEN** it selects no provider and the draft is a plain URL capture
