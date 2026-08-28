# Plan item 10 release evidence

Evidence date: 2026-08-28 (Asia/Tbilisi). Each row is independent; no row implies another.

| Boundary | Result | Observed evidence |
| --- | --- | --- |
| Chromium deterministic package | Passed locally | `ratatoskr-browser-extension-0.1.0-chromium.zip`, SHA-256 `893af77942651358d136858a4e1006a9bea2d3c58d60fc17e3ff31a8627a8524` |
| Firefox deterministic package | Passed locally | `ratatoskr-browser-extension-0.1.0-firefox.zip`, SHA-256 `23e263b8a3150f445df1197807b154ba0d97393b4b8e53f8951a95927b6e498a`; official `web-ext lint` 0 errors, 0 warnings |
| Store material | Passed locally | Six generated description, metadata, and PNG files plus deterministic `SHA256SUMS` |
| Store dry-run | Passed locally | Both reviewed request plans validated; no network mutation |
| Store upload/signing | Blocked before network | Owner credentials absent; exact names below |
| Composed workspace smoke | Pending | Must be run against the exact workspace profile after the implementation commit |
| Full repository gate | Passed locally | Clean `npm ci --frozen-lockfile`; `npm run gate` with 46 test files / 92 tests; strict OpenSpec 12/12 and archived 8/8 |
| Shipped dependency audit | Passed locally | `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities |
| Full development dependency audit | Blocked externally | Configured SafetyCLI advisory endpoint returned HTTP 400; no success claimed |

## Store credential blocker

The explicit credential-empty command exited 2 before any store request:

```sh
env -u CWS_CLIENT_ID -u CWS_CLIENT_SECRET -u CWS_REFRESH_TOKEN \
  -u CWS_PUBLISHER_ID -u CWS_EXTENSION_ID \
  -u WEB_EXT_API_KEY -u WEB_EXT_API_SECRET \
  npm run release:upload -- --store all --execute
```

Missing Chrome Web Store credentials: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`,
`CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`.

Missing Mozilla Add-ons credentials: `WEB_EXT_API_KEY`, `WEB_EXT_API_SECRET`.

No credential value was read, logged, or persisted. Upload, signing, publication, hosted CI, and
live deployment remain unverified.
