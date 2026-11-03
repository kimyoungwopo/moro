# Canonical compact feedback recipe

Use this recipe for rounded, connected checks and meaningful completion badges. It is trusted design construction, not permission to run code. Compute the values into CreatorProject data; never return this pseudocode or extra fields.

## Rounded check construction

For a centered success plate on a512x512 canvas, a usable example is A=(168,252), J=(232,316), B=(356,192). At target64 use common thickness24 (3 target pixels), cornerRadius12, strokeWidth0, common teal fill. For other canvas sizes fit and recenter the endpoint layout inside the available plate/artboard, respecting BOTH width and height; do not blindly scale y by width on a non-square canvas. Choose thickness from W/target and recompute segment length/angle from the final endpoints. Keep points inside the support plate plus the safe edge inset.

For endpoints P,Q:
- dx=Q.x-P.x, dy=Q.y-P.y.
- layer x=(P.x+Q.x)/2, y=(P.y+Q.y)/2.
- A and J (or J and B) are centerline endpoints, the CENTERS of the rounded end caps, not the outer tips of the filled rectangle.
- width=sqrt(dx*dx+dy*dy)+thickness, height=thickness. Overall capsule width includes the two half-thickness cap radii. Do not use only endpoint distance as overall width: that insets the cap centers and leaves a scalloped/notched shared join.
- rotation=atan2(dy,dx)*180/pi.
- cornerRadius=thickness/2, scale100, opacity100 when settled.

The short segment is A->J, the long segment J->B. Both cap centers meet at the SAME J; the normal round cap extends half a thickness around J, but no separate arm tail crosses it. Capsules overlap only around the common rounded join. Do not separately scale/rotate either bar during reveal. On an inner badge, scale the same connected construction to fit INSIDE the badge while retaining visible strokes; enlarge the badge rather than drawing subpixel check arms. Use a light mark on a dark badge or dark mark on a light plate, not identical-tone hidden ink.

This construction can be represented by supported rect layers with cornerRadius. It does not require unvalidated SVG or a new path schema. Old square rectangles stay square by default.

## Product badge at the intended size

For512 canvas /64px final display: hero short side >=192, simple badge >=80, badge WITH internal check >=96. Reserve safe space within [24,488] for all settled visible extents. If these elements no longer fit with multiple stacks/dividers, remove secondary details; do not shrink the hero or badge to satisfy a busy layout. Align the main product with the tray at contact, then show the badge in reserved clear space with a genuine hold. Completion must be communicated by its shape, not color alone.

## Stable output

Background (square cornerRadius0/null) first, support plate/tray next, hero next, badge/support and its internal mark last. All five tracks remain arrays. Layers need no parent/group feature. Preserve joined mark geometry during opacity reveal. Apply a normal resting scale100/opacity100 after entrance. Treat this as a starting recipe to adapt to the brief, not a claim that every generated check is visually approved.
