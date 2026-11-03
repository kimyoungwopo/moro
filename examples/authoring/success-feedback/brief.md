# Brief: two-bar success feedback

**Goal:** show a confirmed result and remain there. Original geometric study, 512×512, 60 fps, 120 frames; inspect at 128×128 and the actual intended embedding size.

| Frames | Intended visible state |
|---|---|
| 0–18 | Pale 200 px plate grows from 92% to 106%; check bars initially hidden. |
| 18–48 | Short bar fades in and settles; plate reaches 100% at 32. |
| 30–64 | Long bar follows, overshoots to 106% at 50 and settles at 64. |
| 64–119 | Stable readable check on plate. |

Only ellipse and rect are supported: this is not a check path or a trim-path reveal. Short bar: center (232,266), 48×12, rotation45; long bar: (274,258), 72×12, rotation−45. Their overlap near (249,283) needs visual inspection during the scale reveal and at final size. Bars sit above the plate; no custom rounded endpoints.

**Delivery:** play once and hold frame 119. Frame 119 is also the reduced-motion still; host supplies accessible confirmation text. This project intentionally has different start/end values and must not be advertised as seamless looping.

**QA targets:** inspect 0, 18, 30, 42, 50, 64 and 119. Plate max source bounds x150–362, y150–362; inspect check overlap and recognizability, especially at small sizes. No blinking or additional burst is intended.

**Status:** intended behavior and original editable input supplied; no exported animation or player test is claimed by this brief. Parent generates actual output and records rubric results.
