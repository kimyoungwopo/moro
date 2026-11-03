# Success feedback

Use a one-shot acknowledgement with a readable final hold. Start from the original [editable project](../../../examples/authoring/success-feedback/project.moro.json) and [brief](../../../examples/authoring/success-feedback/brief.md).

- Canvas: 512×512, 60 fps, 120 frames. An ellipse plate and two rotated rectangles form the mark; no text, path drawing or trim-path feature is implied.
- Plate scale moves 92→106→100 at frames 0/18/32. Reveal the bars, then settle their scale from 88 through 106 to 100.
- Preserve the shared join between the bars. Independent overshoot can open a gap: check the reveal and final pose, not only the object coordinates.
- Hold the settled result at frames 64–119. Play once and retain frame 119 in the consuming application; this event is not intended as a repeating success notification.

Export from the repository root:
```sh
node scripts/moro-create.mjs --input examples/authoring/success-feedback/project.moro.json --out success.generated.json
```

Inspect frames 0, 18, 32, 64 and 119, including the mark's joint at 128 px. Reduced-motion delivery uses still frame 119. Feedback animation does not prove an underlying transaction succeeded; trigger it only from verified application state.
