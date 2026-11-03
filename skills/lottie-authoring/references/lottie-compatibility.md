# Current compatibility contract

`docs/creator/CONTRACT.md` is authoritative; this is the authoring quick reference, not a claim that every integration test has passed.

## Exact data shape
Project: `version:1`, `name`, `width`, `height`, `fps`, `durationFrames`, `layers`.
Layer: `id`, `name`, `type`, `x`, `y`, `width`, `height`, `fill`, `stroke`, `strokeWidth`, `rotation`, `opacity`, `scale`, `tracks`.
Key: `{frame, value, easing}`. `tracks` contains only `x`, `y`, `scale`, `rotation`, `opacity` arrays. Use unique layer IDs; unique sorted key frames.

| Field | Bound |
|---|---|
| Project width/height | Integer 16–4096 px |
| fps / durationFrames | Integer 1–120 / 2–3600 |
| Layers / keys | At most 100 layers; 100 keys per property |
| Layer type / dimensions | `rect` or `ellipse`; dimensions 1–4096 |
| x/y / rotation | −8192..8192 / −3600..3600 degrees |
| scale / opacity | 1–1000 percent uniform / 0–100 percent |
| strokeWidth / colors | 0–100 / `#RRGGBB` |
| Key frame | Integer 0..durationFrames−1 |
| Easing | `linear`, `ease-in`, `ease-out`, `ease-in-out` |

All numbers finite. No metadata/brief/loop flags inside project JSON; keep the brief in its paired Markdown file. Use opacity 0 to hide: scale 0 is invalid. Geometry dimensions, colors and strokes are static; only the five transform/opacity properties animate.

## Advanced possibilities ≠ current support
Custom paths and trim paths, separate-axis scaling, rounded corners, masks/mattes, gradients, animated paint, text/fonts, SVG import, parenting/precompositions, expressions, image/audio assets, arbitrary Bezier editors, physics/spring easing and state machines may be valid approaches in other tools or a future implementation. They are not accepted CreatorProject authoring operations today. A two-rectangle check is a deliberately limited construction, not a supported path-drawing feature. Do not smuggle advanced Lottie fields into the project or hand-edit exporter output and call it editable.

Completion: validate the real project with the canonical CLI, then inspect the actual player output. Passing schema validation alone proves neither rendering nor cross-player compatibility.
