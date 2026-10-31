# Local validation record

Validated on 2026-10-31 using Node 24.12.0 and the local built app at 127.0.0.1:4173. This records checks actually run; it is not a claim of public deployment or physical-device certification.

## Automated checks

`npm run check` passes with the shipped rules unchanged:

- ESLint 10.14.0, including React hook rules.
- Strict TypeScript checks for web/core and generated React example.
- 24 Vitest tests: nested/precomposition exact RGB mapping, alpha/opacity/gradient/animated/unknown-field preservation, frozen source and isolated original bytes, path/before/after command records, undo/redo/reset, JSON reimport, byte/depth/node/timing limits, invalid JSON, external assets and expression diagnostics, three original samples, React output variants.
- Vite production build and generated React example build.
- Standalone skill assets match the build and core bundle.
- Three Node distribution tests: app and standalone servers really serve JS/fonts and `/docs`, apply local CSP, reject path traversal; CLI exports matching JSON/TSX/declaration, refuses overwrite and blocks expressions.
- `npm audit`: 0 vulnerabilities, including development dependencies. The standalone React example also reports 0 after clean install.

The React example was separately installed with its own `npm ci` and built with its own `npm run build`. Root-generated example files were produced by the same exporter used in the app. A GitHub Actions workflow is included; remote execution results are separate from this local validation record.

## Browser acceptance

Browser actions used the actual local app in the in-app Chromium browser, not mocked UI results.

| Check | Observed result |
|---|---|
| Sample entry | Orbit loader loaded without an account; all three samples render as real SVG Lottie animations |
| Edit and compare | Changing `#1B6C80` to `#C4242A` changes edited SVG properties only; original stays unchanged |
| Shared frame | Original and edited SVG transform matrices match at the paused shared playhead |
| Picker transaction | Apply creates one undo step; Undo restores prior color; Cancel and Escape restore prior palette and focus to the opening swatch |
| Replacement | Modified sample/file changes show a replacement confirmation; Keep editing retains the document |
| Export round trip | Actual downloaded `Orbit_loader.moro.json` reopens and renders the changed red properties |
| Blocked files | External image/font and expression fixtures show diagnostics, disable preview/edited export, retain original-download action |
| Network boundary | CDP Network events recorded zero new requests during blocked external/expression file imports; no URL from those fixtures was requested |
| Invalid input | Malformed JSON shows an error and keeps the previous document |
| Complex fixture | Nested/precomposition static color, gradient and animated-color fixture renders; only the static color appears in the palette |
| Mobile chooser/export | File chooser and actual JSON download work at 390px emulated width |
| Reduced motion | App and generated examples initially pause; explicit keyboard play works; generated hover does not auto-start in reduced motion |
| React triggers | Actual standalone example shows autoplay running, hover entry play/exit pause, and click/tap button play/pause |
| Mobile compare | Original/Edited switch preserves the frame |
| Responsive widths | 1440, 1024, 768, 390 and 969px: scrollWidth equals viewport width, no page horizontal overflow |
| Mobile targets | Menu 44×44; Export height44; background options height44; comparison tabs height44; modal/error close controls44×44 |

Screenshots in the local ignored `.impeccable/review/` folder cover these viewport sizes plus comparison, React export and a viewport-only mobile picker. `docs/demo.gif` is a sequence of actual desktop editing captures, not a rendered mockup. The static UI detector returned no findings.

The independent finish review found one material issue: undersized mobile touch targets. Its follow-up ship verdict scores that fix resolved; it does not represent a new whole-surface audit. A malformed full-page modal screenshot was replaced with a valid viewport capture before scoring.

## Limits and unfinished external checks

- Physical iOS/Android soft-keyboard, native color-well UI and low-end-device performance were not tested. Viewport emulation and keyboard/focus checks do not establish those results.
- Browser acceptance was performed interactively and recorded here; these flows are not automated in CI. CI currently runs lint/types/unit/distribution/build checks.
- Input budgets are conservative implementation caps exercised with synthetic fixtures, not device-certified performance thresholds.
- Render support for arbitrary third-party Lottie documents is not universal. Unsupported external assets/expressions are blocked, and unsupported player features may produce a separate preview error without discarding color history.
- UI localization is English/Korean for main controls; sample descriptions, technical diagnostics and `/docs` remain English. No claim of complete localization is made.
- The user subsequently requested source publication at https://github.com/kimyoungwopo/moro. No hosted demo, name/domain/trademark clearance or promotion has been performed. MIT is the user's first-party license choice; dependency/font license notices are bundled.
