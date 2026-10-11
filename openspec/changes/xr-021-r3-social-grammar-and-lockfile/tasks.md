## 1. Permalink grammar table (R3-15 rule 3)

- [x] 1.1 Extend `tests/social-capture-routing.test.ts` with table-driven boundary cases per provider and host (X 19 and 20 digits, 16-character handle; Threads 30 and 31-character handle, 128 and 129-character code, empty code; Instagram `p`, `reel`, `reels`, `tv`, username-prefixed, 64 and 65-character shortcode) and the draft assertions (accepted: social member with provider; refused: plain URL capture); run it and confirm it fails on the boundary assertions.
- [x] 1.2 Replace the three `path` expressions in `socialRoutes` with the R3-15 patterns; rerun the file and confirm it passes.

## 2. Lockfile from the public registry

- [x] 2.1 Add `tests/lockfile-registry.test.ts` (`every_resolved_url_is_on_the_public_npm_registry`, `the_repository_pins_the_registry`); run it and confirm it fails on the 452 mirror URLs and the missing `.npmrc`.
- [x] 2.2 Add `.npmrc`, regenerate `package-lock.json` against the public registry, confirm no `integrity` changed, rerun the test and confirm it passes.

## 3. Documentation and validation

- [ ] 3.1 State the grammar table in `README.md` and the public registry in `DEVELOPMENT.md`; documentation cannot start from a failing test.
- [ ] 3.2 Run `npm run gate` and `openspec validate --all --strict`, then archive the change; a gate run cannot start from a failing test.
