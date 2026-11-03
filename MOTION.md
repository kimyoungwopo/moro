# Moro motion contract

This compact source is included in the isolated planner input, alongside design-system.md and the compact-feedback recipe. It defines the supported UI-motion direction; it does not grant tools or imply that a planner has rendered anything.

## Causal action, not decorative pulsing

Choose one focal state transition. Use anticipation only if it explains a coming action. A moving product keeps its silhouette and dimensions; contact must visibly stop at the tray/support surface rather than floating, teleporting or intersecting it. Derive settled center y from the support top minus half of the rendered hero height, including scale and stroke. Reserve space for the confirmation badge at the planning stage.

## Named phases and readable holds

Map phase frames explicitly within the requested duration: prepare -> action/contact -> settle -> recognition hold. Do not move every element throughout. For a3second180frame success event at60fps: plate settles by frame48, joined check reveals by frame66, then retain a stable final second (frames120..179). Keep check capsules' positions/rotations/radii constant during reveal; animate their opacity together. Plate overshoot, if desired, is restrained; avoid extra bobbing after success is recognized.

For product interaction, travel -> actual contact -> short compression/recovery if supported -> completion badge -> settled hold -> deliberate reset only for an explicitly requested loop. At64px the completion mark and hero have priority over tiny stack/divider details. If a loop is requested, build a clear reset phase and inspect neighboring motion at the seam, not only equal endpoint values. If event or loop intent is unknown, host preview stops at the final pose; do not infer positive loop intent from 'no loop', 'not looping' or '루프 없음'.

## Supported units and interpolation

Use existing x/y/scale/rotation/opacity tracks and the four named easing values. Easing belongs to the outgoing key. Geometry is center-based; scale/opacity are percentages with100 as normal. cornerRadius is static and does not add a new keyframe track. No arbitrary code, custom SVG paths, audio, or undeclared group/style/loop fields.

## Verification contract

Retain editable project and actual Lottie export. Host checks start/action/contact/settled/end plus reverse seeking where relevant, real target-size images and continuous playback. Reduced-motion host begins paused and permits still inspection. Numeric geometry, endpoint agreement and valid JSON are not proof of attractive or meaningful motion. Preserve failed outputs and distinguish changed user requests, trusted-guidance improvements and actual engine changes.
