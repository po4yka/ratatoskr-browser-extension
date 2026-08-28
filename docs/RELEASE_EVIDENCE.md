# Plan item 10 release evidence

Evidence date: 2026-08-28 (Asia/Tbilisi). Each row is independent; no row implies another.

| Boundary | Result | Observed evidence |
| --- | --- | --- |
| Chromium deterministic package | Passed locally | `ratatoskr-browser-extension-0.1.0-chromium.zip`, SHA-256 `893af77942651358d136858a4e1006a9bea2d3c58d60fc17e3ff31a8627a8524` |
| Firefox deterministic package | Passed locally | `ratatoskr-browser-extension-0.1.0-firefox.zip`, SHA-256 `23e263b8a3150f445df1197807b154ba0d97393b4b8e53f8951a95927b6e498a`; official `web-ext lint` 0 errors, 0 warnings |
| Store material | Passed locally | Six generated description, metadata, and PNG files plus deterministic `SHA256SUMS` |
| Store dry-run | Passed locally | Both reviewed request plans validated; no network mutation |
| Store upload/signing | Blocked before network | Owner credentials absent; exact names below |
| Composed workspace smoke | Passed locally | Extension `bd02e036c6279e04811962085f7b1c03a13eb0b0` against workspace `ee9a915ce956e717459d59763a9482ed32232416`; namespace `extension011`; public status, capabilities, both packages, and zero-resource teardown passed |
| Full repository gate | Passed locally | Clean `npm ci --frozen-lockfile`; `npm run gate` with 46 test files / 92 tests; strict OpenSpec 12/12 and archived 9/9 |
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

No credential value was read, logged, or persisted. Upload, signing, and publication remain
blocked. Hosted CI is evaluated separately after integration and push.

## Composed workspace smoke

The smoke used committed extension revision
`bd02e036c6279e04811962085f7b1c03a13eb0b0` and the workspace-owned
`integration/compose/web-operational.yaml` profile at workspace revision
`ee9a915ce956e717459d59763a9482ed32232416`. Its pinned sibling inputs were:

- contracts `ad5a9ba7cad05b0ce992e0d21a5c4e22e185f799`;
- Platform `12ce8cc387d12b087fe0785256808897bd7ac7b2`;
- Web `856d224969067a8a26c02bb5171d93858cd62d8a` from a temporary clean detached worktree.

With those exact context/revision environment variables, the lifecycle commands were:

```sh
build-gate -- docker compose --project-name ratatoskr-extension011 \
  --file integration/compose/web-operational.yaml \
  up --detach --build --wait --wait-timeout 600

npm run workspace:smoke -- observe \
  --origin http://127.0.0.1:32790 \
  --synthetic-credential web012-owner-credential \
  --release-dir release \
  --workspace-root /Users/po4yka/GitRep/ratatoskr-workspace \
  --workspace-revision ee9a915ce956e717459d59763a9482ed32232416 \
  --profile integration/compose/web-operational.yaml \
  --namespace extension011 --kind composed \
  --output release-evidence/pending.json

docker compose --project-name ratatoskr-extension011 \
  --file integration/compose/web-operational.yaml \
  down --volumes --remove-orphans

npm run workspace:smoke -- finalize \
  --pending release-evidence/pending.json \
  --teardown-evidence release-evidence/teardown.json \
  --output release-evidence/composed.json
```

Observed assertions: Platform `/v1/status` was `operational`, `/v1/capabilities` returned a
capability array, package smoke reproduced both digests above, and final evidence was
`kind=composed,status=passed`. Docker label queries after teardown found zero containers, volumes,
or networks for `ratatoskr-extension011`; eight pre-existing unrelated Ratatoskr containers
remained running. The temporary Web worktree was clean and removed after teardown.
