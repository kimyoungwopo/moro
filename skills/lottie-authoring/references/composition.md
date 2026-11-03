# Composition: build a readable pose first

Authoring suggestions, not guaranteed quality rules. Start with a still at the intended display size before adding keys.

- **Hierarchy:** one dominant action, one supporting surface, then optional accents. Remove an accent if it competes with the message.
- **Safe area:** reserve space for the most expanded/rotated pose, including stroke. A centered layer is not necessarily inside the canvas.
- **Construction:** positions refer to centers, shapes are centered on anchor `[0,0,0]`; a rotated rectangle rotates about its own center. Use overlapping pieces for joins rather than relying on exact edge contact.
- **Depth:** `layers` is bottom→top. Put receiving surfaces behind moving objects and feedback marks above their plate.
- **Color:** static `#RRGGBB` fill/stroke only. Differentiate moving subject and support by tone and size; the examples' teal palette is a choice, not a required theme.

For a rect with dimensions w,h, rotation θ and uniform scale s/100, conservative half-extents are `(abs(w*cosθ)+abs(h*sinθ))*s/200` and `(abs(w*sinθ)+abs(h*cosθ))*s/200`, plus half the scaled stroke. For ellipses, the enclosing rect gives a conservative bound. Check between keys too: easing and scale overlap can produce larger poses than a single key suggests.

Completion: inspect full canvas and target-size stills at all extrema. A two-bar check must read as a check, not a chevron or broken corner; revise overlap and lengths if needed. Rounded rectangles, custom paths and typography are outside the current model.
