# Contributing

Use Node 24 (minimum 22.13) and `npm ci`. Keep changes focused and preserve document fields outside the supported color paths. Do not evaluate expressions or fetch external assets to make a fixture render.

Before submitting:

```sh
npm run example:generate
npm run build
npm run skill:sync
npm run check
npm audit
```

Use original or clearly licensed fixtures and record provenance in `fixtures/README.md`. Never attach private animation files without permission. Minimize a reproduction and remove business content first.

For UI changes, inspect desktop 1440px, tablet 1024/768px and mobile 390px, including dialogs, file replacement, invalid HEX, reduced motion and keyboard focus. Capture the actual app and record which checks were run. Physical soft-keyboard behavior requires a real device; viewport emulation is not a substitute.

For React export changes, regenerate and clean-install the standalone example: `cd examples/react`, `npm ci`, `npm run build`, then exercise all three trigger modes. Keep the code, JSON name and light-player type declaration consistent.

The approved v0.1 scope is static palette customization. Discuss format additions, cloud services, AI, keyframe editing or new dependencies before expanding the product. Good first tasks include fixture coverage, Korean documentation, error messages and accessibility.
