# Brief: three-dot waiting loop

**Goal:** communicate waiting, not estimated completion. Original geometric study, 512×512, 60 fps, 120 frames; use at an intended 128×128 preview and inspect smaller use separately.

| Frames | Intended visible state |
|---|---|
| 0–10 | Three 24 px dots rest at y272, centers x208/256/304. |
| 10–76 | Dots rise to y240 with staggered peaks at 26/38/50 and return at 52/64/76. |
| 76–119 | All dots rest; quiet seam returns to frame 0. |

Layer order is left, middle, right; no overlap is intended. Each y track starts and ends at 272; other properties stay static. No track reaches beyond frame 119. Loop is selected in the host, not stored in the project. Reduced-motion alternative: frame 0, no autoplay/repetition, with accessible waiting text supplied outside the artwork.

**QA targets:** inspect 0, 26, 38, 50, 76, 118, 119 and the wrap to 0; conservative source bounds x196–316 and y228–284. Judge stagger rhythm and quiet-seam dwell in real playback; numeric equality is not a smoothness guarantee.

**Status:** intended poses and original editable input supplied. Export generation and actual player/target-size/reduced-motion-host checks belong to parent integration; no rendered quality claim here.
