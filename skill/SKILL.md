---
name: lottie-studio
description: Recolor static Lottie fill and stroke colors locally with the Moro web workbench or CLI, compare versions, and export JSON plus a React wrapper. Use for Lottie palette customization; not generation, SVG editing, keyframes, native 3D, or video export.
---

# Moro Lottie workbench

Use the bundled local app for interactive palette changes, synchronized comparison and export. It needs Node.js 22.13+ and has no account, upload service or API key.

Start the web workbench, resolving the command relative to this skill folder:

```sh
node scripts/serve.mjs
```

Open the printed `http://127.0.0.1:4173/` URL. If occupied, use another local port via `PORT=4174`. Do not stop an unrelated process. `/docs` explains the supported format. Three original starter samples are bundled.

For deterministic recoloring:

```sh
node scripts/recolor.mjs --input /absolute/animation.json --map '#1B6C80=#C4242A' --out /absolute/animation.moro.json
node scripts/recolor.mjs --sample orbit --map '#1B6C80=#C4242A' --out /absolute/animation.moro.json --react
```

`--sample` accepts `orbit`, `success`, or `burst`. Repeat `--map` for more colors. A source HEX that represents multiple distinct float RGB groups is rejected as ambiguous; use the web UI to select those groups individually. Outputs never overwrite an existing file. `--react` adds `MoroAnimation.tsx` and `lottie-light.d.ts` beside the JSON; install `lottie-web@5.13.0`, React, and enable TypeScript `resolveJsonModule`.

Only static shape fill/stroke RGB values change. Preserve unknown fields, alpha, opacity, animated colors, gradients and timing. Original source bytes remain available in the browser. Expressions, external assets and unsupported embedded image types block preview and edited export; never evaluate expressions or fetch external assets to work around this. File limits are 2 MB, 100,000 JSON nodes, 64 nesting levels, 8192 px, 1–240 fps, 18,000 frames and 10 minutes.

Browser edits live in tab memory until export. Changing a modified file requires confirmation in the UI. Do not promise persistent autosave. Playback settings affect the preview and generated React wrapper, not Lottie JSON. Reduced-motion environments start paused.

This is the v0.1 color-customization workflow. Legacy generation and SVG/keyframe features are not part of this version. Keep work local unless the user explicitly requests publication.
