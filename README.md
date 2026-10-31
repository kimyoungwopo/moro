# Moro

Recolor Lottie animations and bring them into your app. A local-first, account-free workbench built with React and TypeScript.

![Actual local editing capture](docs/demo.gif)

**Try locally:** [Moro workbench](http://127.0.0.1:4173/) · [Docs](http://127.0.0.1:4173/docs)

Source: [kimyoungwopo/moro](https://github.com/kimyoungwopo/moro). No public hosted demo is deployed. Moro is a working name.

## Quick start

Node.js 22.13+ is required (Node 24 is used for validation).

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173/`. For the production build:

```sh
npm run build
npm run serve
```

Stop a prior server on that port before starting another, or use `PORT=4174 npm run serve`. The server binds to loopback only. The static build supports `/` and `/docs`; other hosts must map `/docs` to `index.html`.

## Workflow

1. Start with Orbit loader, Success check or Reaction burst, or open your Lottie JSON.
2. Change static colors with HEX inputs or the color picker. A picker Apply is one undo step; Cancel restores the prior palette.
3. Enable Compare to view both versions at a shared frame. On mobile, switch Original / Edited without changing the playhead.
4. Export JSON, or download the matching JSON, React component and light-player type declaration.

React export uses `lottie-web@5.13.0`. Place all three files together, enable TypeScript `resolveJsonModule`, and import `MoroAnimation.tsx`. Autoplay, loop, speed, hover/focus and click/tap behavior live in the wrapper; JSON retains its source timing. All modes include a play button and respect reduced motion on initial load. See the [working generated example](examples/react/README.md).

## Support and preservation

- Static shape fill/stroke RGB changes, including nested groups and precompositions.
- Exact RGB grouping: negative zero normalizes to zero; different float values remain separate even if their displayed HEX matches.
- Alpha, opacity, animated colors, gradients, unknown fields and timing are preserved.
- Original download retains source bytes. Edited export operates on a copy; the player also receives a clone.
- Inputs: JSON up to 2 MB, 100,000 nodes, 64 nesting levels, 8192 px dimensions, 1–240 fps, 18,000 frames and 10 minutes. These are conservative local limits, not universal Lottie limits.
- External images/fonts, expressions and unsupported embedded image formats block preview and edited export. Embedded PNG/JPEG/WebP/GIF are allowed. Original download stays available.
- Not included: dotLottie, SVG editing, keyframes, generation, native 3D, GIF/MP4 export or cloud persistence.

## Local processing

Files are parsed in browser memory. There is no upload endpoint, external font request, telemetry or API key. Only the language preference is persisted. Export before closing or refreshing; unsaved edits are not recoverable. The local production server also applies a same-origin content security policy.

## Development

```sh
npm run check              # lint, types, unit tests, builds, skill sync check
npm audit
npm run samples:generate   # regenerate the three original samples
npm run example:generate   # regenerate React files from the real exporter
npm run skill:sync         # refresh standalone skill after a production build
```

Source lives in `apps/web`, `packages/document-core`, and `packages/player-adapter`. Tests and original fixtures are in `tests` and `fixtures`. [Validation evidence and limits](docs/VALIDATION.md) distinguish automated checks, browser checks and untested physical-device behavior.

### Codex skill

The self-contained skill remains named `lottie-studio` and displays **Moro — Lottie colors**. It includes the built local editor, original samples, a standalone Node server, and deterministic recoloring CLI.

```sh
npm run build
npm run skill:sync
npm run skill:install
```

The installer refuses to overwrite an existing skill. Back it up first or pass `-- --dest /absolute/new-folder`. See [skill instructions](skill/SKILL.md).

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). First contributions: fixtures, translations, actionable file errors and accessibility. First-party code and starter animations are MIT licensed. Self-hosted IBM Plex fonts use SIL OFL; see [third-party notices](THIRD_PARTY_NOTICES.md) and `apps/web/public/licenses`.
