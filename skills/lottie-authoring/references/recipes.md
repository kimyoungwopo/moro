# Recipes → editable projects

All recipe numbers are authored starting points within the frozen contract, not tested aesthetic benchmarks. Run from the repository root; see the paired briefs for exact poses. Examples use static colors, rect/ellipse geometry and the five permitted keyframe properties only.

| Recipe | Project / layers | Key beats | Delivery |
|---|---|---|---|
| Waiting loader | `examples/authoring/loader/project.moro.json`; 3 ellipses | 120 frames, 60 fps; y=272→240→272; peaks at 26/38/50; all rest by 76 through 119 | Loop; reduced-motion frame 0 |
| Success feedback | `examples/authoring/success-feedback/project.moro.json`; plate ellipse + 2 rect bars | 120 frames, 60 fps; plate scale 92→106→100 at 0/18/32; bars opacity 0→100 then scale 88→106→100; final hold 64–119 | Once, hold 119; reduced-motion frame 119 |
| Product interaction | `examples/authoring/product-interaction/project.moro.json`; card, receiving tray, product rect, feedback ellipse | 180 frames, 60 fps; start 0–18, lift/travel 18–50, settle 50–70, hold 70–112, hide/reset/reveal 112–179 | Loop; reduced-motion settled frame 90 |

Success/check limitation: no stroke reveal or check path. The short bar centered (232,266), 48×12 at 45°, overlaps the long bar centered (274,258), 72×12 at −45°. They join near (249,283). Recheck the join at display size and during independent scale reveals; a malformed join is not fixed by calling it a check.

Product scene uses no typography, logo or font assets. The moving rectangular product reaches a static tray, then an ellipse appears as feedback. It is a geometric interaction study, not an accurate product illustration or an implemented click handler.

Detailed procedures: [loader](../recipes/loader.md), [success](../recipes/success-feedback.md), [product interaction](../recipes/product-interaction.md).

To adapt: copy a project to a new path, keep exact fields, change the brief first, then change geometry and keys together. Export to a fresh `animation.json` using `node scripts/moro-create.mjs --input <project> --out <output>`. Do not copy the separate hand-authored showcase JSON into an editable-project slot. Run the design rubric after actual export; these source recipes alone are not player-QA evidence.
