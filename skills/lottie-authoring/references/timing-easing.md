# Timing and easing

Contract semantics: frames are integers `0..durationFrames−1`; `fps` sets time units; `op=durationFrames` is exclusive. Easing is on the **outgoing** key, not the destination. Use `linear`, `ease-in`, `ease-out`, or `ease-in-out` exactly. Do not invent Bezier fields, spring parameters or hold easing.

- `linear`: even travel or explicit constant-speed rotation; acceleration changes abruptly at a held endpoint.
- `ease-out`: leave promptly, arrive softly; useful for a reveal or arrival.
- `ease-in`: build speed; useful for a departure.
- `ease-in-out`: start and arrive softly; useful for an isolated bounce or return.

These names select the core's deterministic cubic timing. Do not replace them with assumed CSS or power formulas in a second preview. Compare the core sample to the actual Lottie player.

A hold is two equal-valued keys at its beginning and end (or the last key held thereafter). Before first/after last key the nearest value is held. A single-key track is constant, overriding the static field. Different properties may have different key grids; x/y export is separated to preserve them.

Suggested starting point: reserve more frames for recognition/hold than for a tiny overshoot. In the success recipe, reveal starts at 18, settle ends at 64, and the confirmed pose holds through 119. This is an authored choice, not a universal duration standard.

Completion: inspect integer phase boundaries and intermediate frames; confirm the easing selected on the preceding key actually controls the intended segment.
