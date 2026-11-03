# Editable authoring examples

Original shape-only CreatorProjects; each directory pairs `brief.md` with `project.moro.json`. These are editable input data, unlike the separate export-format showcase files. Geometry uses only rect/ellipse and no external assets, fonts or expressions.

| Example | Intent | Playback | Reduced-motion pose |
|---|---|---|---|
| [loader](loader/brief.md) | Quiet waiting rhythm | Loop 0–119 | Frame 0 |
| [success-feedback](success-feedback/brief.md) | Show confirmed state | Play once, hold 119 | Frame 119 |
| [product-interaction](product-interaction/brief.md) | Place a geometric product on a tray | Loop 0–179 | Frame 90 |

After `npm ci`, from the repository root:

```sh
node scripts/moro-create.mjs --input examples/authoring/loader/project.moro.json --out examples/authoring/loader/animation.json
node scripts/moro-create.mjs --input examples/authoring/success-feedback/project.moro.json --out examples/authoring/success-feedback/animation.json
node scripts/moro-create.mjs --input examples/authoring/product-interaction/project.moro.json --out examples/authoring/product-interaction/animation.json
```

Outputs must come from the actual exporter; the guidance author did not hand-author `animation.json`. Parent integration owns generation and player checks. Existing output paths are refused rather than silently overwritten; use fresh destinations for revisions. Commands are the canonical interface, not evidence that this checkout has already passed them.

Open/save the project for editability; load the generated animation in the actual player for delivery checks. Looping, autoplay and reduced-motion still selection belong to the host, not extra project fields. Follow [the rubric](../../docs/creator/AUTHORING-DESIGN.md); the paired briefs describe intended behavior, not a claim of visual verification. All these inputs are original first-party MIT material; provenance is recorded in [REFERENCES](../../docs/creator/REFERENCES.md).
