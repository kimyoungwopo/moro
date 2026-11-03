---
name: lottie-authoring
description: Use when authoring editable Moro Lottie animations.
version: 1.0.0
author: Moro contributors
license: MIT
metadata:
  hermes:
    tags: [lottie, motion, authoring]
    related_skills: []
---

# Lottie authoring

## Use and boundary
Create an original shape-only CreatorProject, then export through Moro's real core. For existing-file recoloring use `skill/SKILL.md` instead. This repository skill is documentation, not a globally installed agent hook. Craft recommendations are design suggestions, not quality guarantees.

## Workflow
1. Write a brief: communication goal, canvas, event or loop, phase frames, visible end state and reduced-motion still. Done when each phase has an observable purpose.
2. Check [compatibility](references/lottie-compatibility.md) against `docs/creator/CONTRACT.md` (the schema authority). Choose a [recipe](references/recipes.md) and edit its original `examples/authoring/*/project.moro.json`. Done when the project uses only the contract fields and bounds.
3. Refine [composition](references/composition.md) and [motion](references/motion-principles.md); consult [timing](references/timing-easing.md) or [looping](references/looping.md) only when needed. For compact UI, use the [design system](references/design-system.md), [motion contract](../../MOTION.md) and [rounded check/badge recipe](recipes/compact-feedback.md). Name the final display size separately from canvas size; do not miniaturize a512px scene without checking the real target. Done when important poses, phase boundaries and any reset are explicit.
4. From the repository root after `npm ci`, run the canonical CLI below into a fresh output path. A project file is not an exported animation. Done only when the actual command succeeds and output is present.
5. Open the exported bytes in the actual light player, seek the brief's poses and compare them with the creator preview. Apply the rubric in `docs/creator/AUTHORING-DESIGN.md`. Done when results, limitations and any remaining failures are recorded, not merely when JSON parses.

```sh
node scripts/moro-create.mjs --input examples/authoring/loader/project.moro.json --out loader.generated.json
```

The CLI refuses overwrite; preserve evidence or choose a new destination. `--validate` is check-only, not proof of rendering. The parent integration owns generated example outputs and runtime/loader checks; the authored inputs alone carry no export/player verification claim.

## Common pitfalls
- No path drawing, trim paths, text, expression or imported Lottie round-trip editing is implied by these recipes. A check uses two rotated capsule rectangles with explicit cornerRadius=thickness/2; old rectangles remain square unless authored otherwise.
- A layer's `tracks` override its static property; change keys, not only the base number.
- Matching endpoint poses alone does not make a smooth loop; inspect the seam and its surrounding frames.
- A scaled rectangle remains a rectangle. Shape construction suggestions cannot guarantee recognizability at every display size.

## Completion checklist
- [ ] Editable project and brief agree; static reduced-motion pose is specified.
- [ ] Real CLI output and actual player agree at start, extrema, settle, hold and end.
- [ ] Bounds, layer order, loop seam/event hold, and target-size readability checked.
- [ ] Provenance and intended-versus-verified status recorded; no gallery assets or proprietary bundles included.
