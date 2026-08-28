# Extension release and composed-smoke runbook

The release boundary has four independent results: deterministic packages, generated listing
material, a composed-profile smoke, and store upload/publication. Never use one as evidence for
another.

## Deterministic local preparation

```sh
npm run build
npm run package
npm run package:smoke
npm run store-assets
npm run release:check
```

This produces Chromium and Firefox MV3 archives plus checksum indexes under ignored output
directories. `release:check` validates both archives and listing inputs without contacting a store.

## Owner-held credentials

Chrome Web Store v2 upload requires `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`,
`CWS_PUBLISHER_ID`, and `CWS_EXTENSION_ID`. Firefox listed signing/upload through `web-ext` requires
`WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`. Values belong only in the protected
`extension-stores` GitHub environment or the owner's process environment; never put them in files,
arguments, logs, diagnostics, or committed evidence.

The setup contracts are the official [Chrome Web Store API guide](https://developer.chrome.com/docs/webstore/using-api)
and [Mozilla web-ext signing guide](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/).

```sh
npm run release:upload -- --store chromium --execute
npm run release:upload -- --store chromium --execute --publish
npm run release:upload -- --store firefox --execute
```

Chromium upload and publish are separate authorizations. Firefox `listed` signing creates/uploads the
AMO version under Mozilla's review flow. With missing credentials the command exits 2 before any
network mutation and prints a JSON blocker containing names only.

## Composed profile

While the exact task-namespaced workspace profile is running, observe its public Platform origin:

```sh
npm run workspace:smoke -- observe \
  --origin <loopback-origin> \
  --synthetic-credential <profile-fixture-credential> \
  --release-dir release \
  --workspace-root <workspace-checkout> \
  --workspace-revision <full-sha> \
  --profile integration/compose/web-operational.yaml \
  --namespace <unique-task-namespace> \
  --kind composed \
  --output release-evidence/pending.json
```

After namespaced Compose teardown, write a JSON teardown result with the same `namespace`,
`status: "passed"`, and `remaining_resources: 0`, then finalize:

```sh
npm run workspace:smoke -- finalize \
  --pending release-evidence/pending.json \
  --teardown-evidence release-evidence/teardown.json \
  --output release-evidence/composed.json
```

An absent profile, mismatched workspace revision, unreachable origin, failed assertion, or incomplete
teardown stays `blocked`. The reviewed evidence summary records exact revisions and artifact digests.
