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
