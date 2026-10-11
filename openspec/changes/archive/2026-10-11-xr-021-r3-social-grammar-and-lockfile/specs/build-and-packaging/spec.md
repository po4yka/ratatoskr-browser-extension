## ADDED Requirements

### Requirement: The lockfile resolves from the public npm registry
`package-lock.json` SHALL resolve every package from `https://registry.npmjs.org/` and carry an `integrity` for each resolved package, and the repository SHALL pin `registry=https://registry.npmjs.org/` in `.npmrc`, so that `npm ci` works on any machine with access to the public registry.

#### Scenario: No third-party mirror URL in the lockfile
- **WHEN** the lockfile is parsed
- **THEN** every `resolved` value starts with `https://registry.npmjs.org/` and every such entry has an `integrity`
