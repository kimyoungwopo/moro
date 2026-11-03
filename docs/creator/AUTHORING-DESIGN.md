# Authoring design: a small production loop

This layer aims to improve decisions in real generated animations, not enlarge the instruction library. Craft recommendations are original suggestions to evaluate, not guaranteed drawing rules or invented quality benchmarks.

## Start with a pose contract
A brief names the message, display context, phase frames, visible settled state, loop/event behavior and reduced-motion still. Use [the recipe index](../../skills/lottie-authoring/references/recipes.md) to choose an editable source. Avoid turning every surface into a moving accent. The separate showcase files remain export-format demonstrations, not supported editable CreatorProjects.

## Quality rubric
Record **pass / fail / not checked**, evidence frame/path and a corrective action for each row. Do not average failures into an arbitrary quality score.

| Gate | Evidence required |
|---|---|
| Message and visual end state | Start and settled stills at intended display size; identify the state without narration. A success mark must remain legible and connected. |
| Composition and bounds | Inspect extrema, rotation/scale overlaps, stroke and layer stacking; no accidental crop or overlap. Numeric bounds are a screen-space check, not proof of pleasing composition. |
| Timing and easing | Seek phase boundaries and intermediate frames; outgoing key easing behaves as intended; settle reaches a stable hold. |
| Loop seam / event hold | For loops, inspect endpoint values and repeated playback across N−1→0; for events, stop at confirmed pose without unwanted replay. |
| Reduced motion | Actual host disables autoplay/repetition and can present the brief's still; information survives without motion. Project JSON itself has no reduced-motion flag. |
| Export–player agreement | Generate via real CLI; load those exact bytes into the real light player; compare creator preview and export at beginning, middle, extrema and end, not a CSS imitation. |
| Editability and provenance | Reopen `project.moro.json`, change a key, regenerate to a new path; retain exact supported schema and original/licensed source record. |

## Evidence boundary
Numeric inspection can establish allowed ranges and matching endpoint values. It cannot establish attractive motion, recognizability, accessible host playback or real renderer agreement. Mark those pending until observed. Compare more than one display size before claiming suitability for a small button/icon. Treat broader player compatibility as unverified unless those players were actually exercised.

[Compatibility](../../skills/lottie-authoring/references/lottie-compatibility.md) separates valid present operations from possible advanced techniques. [Reference provenance](REFERENCES.md) separates inspected research from copied materials. The frozen [contract](CONTRACT.md) wins if guidance drifts.
