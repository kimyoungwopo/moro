# Brief: geometric product placement

**Goal:** a typography-free rectangular product lifts, lands on a tray and earns a small feedback dot. It is an interaction illustration, not a functional clickable product or a branded rendering. Original shape-only project, 512×512, 60 fps, 180 frames; inspect at 256×256 and final embedding size.

| Frames | Phase / intended pose |
|---|---|
| 0–18 | Start: product at (176,232), rotation0, fully visible. Quiet card and tray stay fixed. |
| 18–50 | Lift/travel: y206 and rotation−8 at 32, then (256,240), rotation4 at 50. |
| 50–70 | Settle: y260 at 60, then y254 and rotation0 at 70; product bottom meets tray top at y290. |
| 70–112 | Hold: subject remains settled; dot reveals at 82 and settles scale100 at 94. |
| 112–124 | Reset preparation: product and dot fade to opacity0. |
| 124–154 | Hidden reset: product returns to (176,232) by 146; dot scale returns to90. |
| 154–166 | Reveal initial pose. |
| 166–179 | Quiet start hold before wrap to0. |

All animated properties have matching values at frame0 and179. Product x176/y232/rotation0/opacity100 and dot opacity0/scale90 match at both ends; no visible moving reset is intended. Layers bottom→top: card, tray, product, dot. No fonts, images, paths, color animation or parenting.

**Reduced motion:** use settled frame90 without autoplay/repetition; host supplies accessible state text. In normal playback, explicitly enable loop in the host. Project JSON contains no loop or reduced-motion flag.

**QA targets:** seek 0, 32, 50, 60, 70, 90, 112, 124, 146, 166, 178, 179 and wrap to0; inspect contact/overlap, reveal without a flash and dwell length. Static card bounds x92–420/y124–388 contain the intended moving geometry; verify continuous motion and scale in the real player rather than relying only on this claim.

**Status:** phase plan and original editable input supplied. Actual CLI export, export-player agreement and host reduced-motion behavior require parent verification; no rendered-quality claim here.
