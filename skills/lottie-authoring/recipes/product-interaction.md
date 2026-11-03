# Geometric product interaction

Use a restrained movement into a receiving tray. Start from the original [editable project](../../../examples/authoring/product-interaction/project.moro.json) and [brief](../../../examples/authoring/product-interaction/brief.md).

- Canvas: 512×512, 60 fps, 180 frames; card, tray, rectangular product and feedback ellipse.
- Read the starting pose at 0–18, travel at 18–50, settle at 50–70 and hold at 70–112.
- Hide/reset/reveal during 112–179. Resetting visible geometry is a continuity defect; compare opacity and position together around the seam.
- Adapt geometry and keyframes together. Do not describe this shape study as a photoreal product illustration or implemented click interaction.

Export from the repository root:
```sh
node scripts/moro-create.mjs --input examples/authoring/product-interaction/project.moro.json --out interaction.generated.json
```

Inspect frames 0, 18, 50, 70, 90, 112, 179 and the next frame 0. Verify object stacking, tray contact, hold readability and reset concealment at target size. Reduced-motion delivery uses settled still frame 90. See the [design rubric](../../../docs/creator/AUTHORING-DESIGN.md) before claiming visual approval.
