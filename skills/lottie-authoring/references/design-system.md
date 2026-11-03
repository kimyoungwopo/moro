# Moro motion design system

Purpose: compact, readable geometric UI motion, not miniature poster illustration. This bounded reference is actual planner input. Root DESIGN.md describes the app chrome; it is not a substitute for these animation rules.

## Display target is a design input

Use the submitted `Design target: Npx` as final display width, NOT the canvas dimensions. Canvas width512 does not mean the viewer sees512px. If no explicit display target exists, use64px for compact UI feedback. A different display target is allowed when clearly requested.

Let W be canvas width, T target display width, and U=W/T. Convert a target-pixel requirement to canvas geometry by multiplying by U. Project defaults for this restrained style:
- Meaningful stroke/filled check-bar thickness >=3 target pixels: thickness >=3*U.
- Completion badge diameter/short side >=10 target pixels: size >=10*U. Use >=12*U when the badge contains an internal two-bar check. A2px dot is not a readable completion badge.
- Main product/hero short side >=24 target pixels: size >=24*U.
- Safe edge inset >=3*U and clear separation >=2*U, measured after scale/rotation/stroke.
These are design defaults for this style, not universal accessibility or aesthetic standards. Do not force a3-dot loader to use24px dots: small repeated dots are not a main product/hero.

At W512/T64: bar24, simple badge80, checked badge96, hero192, safe inset24 canvas pixels. At small size simplify decoration, reduce object count and enlarge the important confirmation rather than shrinking a detailed512px scene. Do not hide the completion mark behind another layer or put the badge outside the safe inset. Reserve badge space during composition, not after the hero fills the frame.

## Shape language and palette

Use #1B6C80 for the focal mark, #203B42 for restrained structure, #E8F1EE for support, white for the sheet. Do not merge same-tone overlapping shapes accidentally. No text or external assets unless the schema later supports them.

Rect cornerRadius is static canvas pixels, null/0 means square, and must be <=min(width,height)/2. Ellipse uses null/0. Rounded cards use a restrained radius; check bars use exactly thickness/2 to form capsules, not square-ended rotated blocks. Do NOT round every rectangle: full backgrounds remain square. Keep scale100/opacity100 for a normal visible object.

## Confirmation silhouette

A check is one asymmetric V silhouette, not an X, plus, detached slash or overlapping tails. Use the canonical compact-feedback recipe, shared endpoints and capsule bars. Keep both bars' geometry static; reveal their opacity with identical timing and move/scale the plate, not each arm around a separate center. Rounded bars must share fill and have strokeWidth0 to avoid dark seams. Leave a clear stable final pose.

## Acceptance before output

Compare the settled mark, actual contact pose and largest motion extent at the selected display size. Verify the numeric dimensions against U, explicit layer order, clear contact, safe bounds and final hold. Host rendering—not the data-only planner—checks actual pixels. Do not claim a render, visual approval or guaranteed quality. A model output that ignores these minima remains a defect to correct, not an approved result because its JSON is valid.
