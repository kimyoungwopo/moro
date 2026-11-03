# Waiting loader

Use a quiet waiting state, not a percentage/progress promise. Start from the original [editable project](../../../examples/authoring/loader/project.moro.json) and [brief](../../../examples/authoring/loader/brief.md).

- Canvas: 512×512, 60 fps, 120 frames; three 24 px circles centered at x=208/256/304.
- Rest y=272; lift to y=240 at frames 26/38/50; return at 52/64/76. Hold the rest pose through 119.
- Keep the endpoints still and identical; do not simply jump a moving last frame to the first.
- Change spacing and all corresponding position keys together. Start with the existing restrained ease-in-out instead of adding arbitrary overshoot.

From the repository root, export to a fresh path:
```sh
node scripts/moro-create.mjs --input examples/authoring/loader/project.moro.json --out loader.generated.json
```

Verify actual player frames 0, 26, 38, 50, 76, 119 and the 119→0 seam; confirm the three dots remain separate at 128 px. Reduced-motion delivery uses still frame 0. The included JSON is not a built-in loading-state component or a measured performance indicator.
