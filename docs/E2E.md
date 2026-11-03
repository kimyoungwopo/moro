# Reproducible browser regression checks

## Install and run

Use Node >=22.13 (CI uses Node 24). From the repository root:

```sh
npm ci
npx playwright install chromium
npm run check
npm run test:e2e
```

On Linux, install Chromium and its OS dependencies with:

```sh
npx playwright install --with-deps chromium
```

`@playwright/test` is pinned exactly to **1.64.1**, selected from the npm registry's stable `latest` metadata, not an assumed future version. Its metadata requires Node >=20 and depends on `playwright@1.64.1`. The project's stricter Node requirement still applies. Installation and subsequent `npm audit --json` reported **0 vulnerabilities** across all severities.

If the bundled Chromium executable is missing but Google Chrome is already installed locally, use the explicit opt-in below (CI does not use this override):

```sh
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

## Server ownership and isolation

`test:e2e` first type-checks the browser tests/configuration, then runs Playwright. Playwright builds the real production app and owns a Vite preview process bound strictly to **127.0.0.1:4187**. `--strictPort` and `reuseExistingServer: false` deliberately fail if the port is occupied: the suite never tests a pre-existing app, silently picks another port, or takes over someone else's server. Resolve a port collision only with the owning operator's permission, then rerun the same command.

Set `MORO_E2E_PORT=14187 npm run test:e2e` to select a different task-owned port when the default is occupied; integer ports 1024–65535 are accepted. This is a shipped override, not silent reuse or takeover.

Tests run in Chromium, serially with one worker, without retries, and each gets a fresh browser context. No account, backend, deployment, public URL, external send, or repository write is required. The GitHub assertion checks the link's exact `href`; it does not navigate away or call GitHub.

Failure screenshots and traces are written under ignored `e2e/.results/`. To inspect a trace:

```sh
npx playwright show-trace e2e/.results/<failed-test-directory>/trace.zip
```

Run individual coverage using the normal script:

```sh
npm run test:e2e -- e2e/workbench.spec.ts
npm run test:e2e -- e2e/growth.spec.ts
npm run test:e2e -- --repeat-each=3
```

## Coverage

Existing-behavior regression tests (`baseline:`):

1. Load the default sample and real SVG player; edit a static HEX color; compare original versus edited paint and exactly matching paused transform matrices; undo/redo; save a real browser JSON download to disk; parse its actual bytes and RGB values; reimport that same path through the native file input and real dirty-document replacement confirmation; verify the rendered color and fresh history.
2. Import a renderable Lottie fixture containing an expression; verify diagnostics, disabled playback/edited download, original-download availability, absent preview, and no expression execution marker.
3. Import malformed JSON after an edit and confirm the previous document, edited palette, usable preview, and undo history survive.
4. At a 390×844 viewport, keyboard-open the picker, change its preview, cancel via Escape and Cancel, verify restored HEX/focus/clean history, and check page overflow in single and compare views.
5. Emulate reduced motion before loading; observe the frame staying at zero over twelve actual animation frames; explicitly keyboard-start playback.

New-growth contracts (`growth:`):

1. Accessible `Palette presets` group with Lagoon and Ember buttons; changes affect the palette; Lagoon is exactly one undo step, redo restores it, Ember produces a different palette.
2. First sample button and initially loaded heading are Parcel dispatch, with a real rendered SVG.
3. GitHub link targets `https://github.com/kimyoungwopo/moro` exactly.

Assertions use rendered UI roles, real file input/downloads, and SVG paint rather than mocked player or API responses. Player mount synchronization is awaited with exact-equality polling; transforms are not rounded or compared with a relaxed tolerance.

## Local evidence and limits (2026-10-31)

The historical `docs/VALIDATION.md` manual checks are not reused as evidence for this suite.

- The original snapshot's five baseline browser tests passed; the same three growth tests failed for the intended missing contracts (no Palette presets group; Orbit loader instead of Parcel dispatch; no GitHub link).
- The integrated production build passed all **8 browser tests** in **10.1 s**, then the final `test:e2e` script (including its TypeScript gate) passed **16/16** with `--repeat-each=2` in **19.8 s**, using the already-installed bundled Chromium; no browser download was needed locally.
- Local canonical port 4187 was already occupied by an unrelated Python server. The normal configuration correctly refused reuse. Verification used a temporary diagnostic configuration on loopback port **14187**, with otherwise the same production build, browser, tests, and strict ownership rules. This does not establish a successful canonical-port run. The diagnostic configuration is not shipped.
- Initial missing-control RED was blocked by that port collision and then a diagnostic working-directory setup error. By the time those were resolved, the parent UI was integrated. The original-snapshot failures above are a **post-integration sensitivity replay**, not a claim that behavioral browser RED preceded implementation.
- An initial integrated run was 7 passing / 1 failing because comparison was asserted before the newly mounted original player synchronized. Waiting for exact equality fixed the test race; no production change or weakened matrix assertion was used.
- The new browser tests/configuration pass their dedicated TypeScript check. The root `npm run check` kept its original gate chain: 29 unit tests and both production builds passed, but `skill:check` reported unsynced parent-owned generated UI/showcase assets, so that invocation did not reach distribution tests. Sync those assets and rerun the existing gate before declaring the whole check green.

Parent final integrated run after the shape-stacking repair: `MORO_E2E_PORT=14187 npm run test:e2e` passed **8/8 in 13.0 s**, exit 0, using the shipped port override. `npm run check` passed completely with **30 unit tests, 3 distribution tests**, both builds and synchronized skill assets. Logs are in the task-local ignored artifacts directory.

CI now runs browser dependency installation and `npm run test:e2e` after the unchanged `npm run check`. Existing audit and separately clean-installed React example build steps remain. Remote CI has not been executed as part of this work.

Emulated viewport and keyboard checks are not physical-device/native soft-keyboard certification. Tests do not establish arbitrary third-party Lottie compatibility or comprehensive accessibility/security certification.
