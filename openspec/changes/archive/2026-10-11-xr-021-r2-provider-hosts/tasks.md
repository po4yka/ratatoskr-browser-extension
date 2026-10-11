## 1. Route the full host sets (R2-11)

- [x] 1.1 Extend `tests/social-capture-routing.test.ts` with the `threads.com` and `www.threads.com` Threads rows, the `twitter.com`, `www.twitter.com` and `mobile.twitter.com` X rows, and the non-routing rows (`threads.com.evil.example`, `nottwitter.com`, an `http://` X URL, the `threads.net` profile URL); run it and confirm it fails on the new-host assertions.
- [x] 1.2 Add the hosts to the X and Threads entries of `socialRoutes` in `src/capture/draft.ts`; rerun the file and confirm it passes.

## 2. Full validation

- [x] 2.1 Run `npm run gate` and `openspec validate --all --strict`, then archive the change; a gate run cannot start from a failing test.
