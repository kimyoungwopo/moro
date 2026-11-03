# Moro original showcase assets

## Provenance and reproduction

`dispatch.json` and `approved.json` are original first-party Moro artwork, authored as explicit vector coordinates and temporal keyframes in `scripts/generate-showcase.mjs`. Geometry, layout, barcode-like marks, chip circuitry, paper cuts, and choreography were created for this repository. No stock animations, traced references, private/user assets, logos, text outlines, fonts, images, expressions, external assets, or third-party geometry are used. The source and its generated JSON outputs are distributed under the repository's MIT license; the source carries `SPDX-License-Identifier: MIT`.

Regenerate only these two assets from the repository root:

```sh
node scripts/generate-showcase.mjs
```

This generator does not import or write `scripts/generate-samples.mjs`, `orbit.json`, `success.json`, or `burst.json`. All four original files were verified byte-identical to HEAD after generation. Two successive generations produced identical SHA-256 hashes for both new files. No new dependency or rendering engine is required. These are local shape-only inputs for the existing Lottie light player and document core.

## Shared visual system

Both compositions are **640 × 640**, **60 fps**, with `ip: 0`, exclusive `op: 240` (four seconds). A white, rounded 488 × 500 editorial sheet sits on an offset neutral cut edge. Minimal section rules, three folio dots, and a footer baseline frame the object without typography. Subtle shadow ellipses are flat ink with low opacity, not gradients. The canvas outside the sheet remains transparent.

Exactly five static RGBA colors are reused across fills and strokes, with teal first in document traversal:

| Color | Role |
| --- | --- |
| `#1B6C80` | Primary teal: route, card, label, success check |
| `#D79A4E` | Warm ochre: parcel, chip, rim, small accents |
| `#DDE9EC` | Mist: paper edge, rules, tape, structure |
| `#203B42` | Ink: barcode, account/receipt detail, shadow |
| `#FFFFFF` | Paper, labels, card detail, badge inset |

Colors never animate. Motion comes from authored position, rotation, scale, opacity, and trim properties. All transitions use monotone cubic temporal easing (`o: [.32, 0]`, `i: [.2, 1]`), with explicit intermediate poses rather than overshooting ease curves. Every animated property's first and final values match. Shapes are independent of fonts, branding, and real payment/account identifiers. The bar/dot marks are decorative geometry, not encoded private data.

## Dispatch — “a parcel in good hands”

An ochre folded carton occupies the lower-left hero position, balanced by a tilted white order manifest above-right. The carton has an authored trapezoid lid, contrasting tape, a white shipping label, teal destination bar, twelve ink barcode bars, fold scores, and two handling arrows. A six-node rounded itinerary passes behind the parcel and rises along the right edge; teal trim reveals it. A miniature taped parcel follows staged route waypoints. A teal scan sweep passes over the hero label. Contact-shadow compression reinforces the lift without raster effects.

| Frame | Authored event |
| --- | --- |
| 0–18 | Resting carton at `(292,342)`, rotation −3°; route/scan/courier hidden. |
| 36 | Route reveal starts; miniature courier becomes visible just after frame 30. |
| 54 | Carton lifts to `(284,310)`, −7°; manifest lifts to `(407,208)`, +10°. |
| 78–100 | Carton settles through `(294,331)` to `(292,326)`; manifest settles to `(402,216)`, +7°. |
| 82–108 | Label scan visible; sweep reaches its lower position at frame 96. |
| 132 | Route trim reaches 100%. |
| 154 | Miniature courier arrives at `(474,188)` after travelling along the bottom/right itinerary. |
| 170–190 | Courier fades; dispatched composition holds. |
| 190–218 | Route retracts and hero returns through a small settling pose. |
| 232–240 | Original resting carton pose restored; identical loop endpoint. |

Output: **11 layers**, **113,967 bytes**.

SHA-256: `aa74811ef7e1c050783b49167b6cb2e1717a85458e3c837b703a8e7018b5524d`.

## Approved — “a quiet payment confirmation”

A tilted teal payment card leads the composition: inset perimeter, warm chip with original circuit lines, geometric issuer rules, grouped account dots, a two-part payment emblem, and a minimal contactless mark. Behind it, a narrow paper receipt lifts into view with an original serrated cut, three item/amount rules, a divider, and a total. Two quiet circular guide rings organize the negative space. A gold-rimmed teal/white badge pops at lower-right and a real two-leg teal check draws via Lottie trim paths. Three restrained confirmation flecks and a geometric status capsule complete the sequence.

| Frame | Authored event |
| --- | --- |
| 0–18 | Card rests at `(268,323)`, −7°; receipt lower at `(391,342)`, +5°. |
| 54 | Card lifts to `(260,284)`, −13°; shadow compresses. |
| 64 | Receipt reaches `(395,288)`, +9°, revealing its item structure. |
| 82–106 | Card settles through −5° to `(268,294)`, −8°; receipt settles to `(393,298)`, +6°. |
| 86–112 | Badge fades/pops from 82% scale to 110%, lifting to `(418,390)`. |
| 94–130 | Check trim draws from 0% to 100% along `(-22,-1) → (-6,15) → (26,-19)`. |
| 136–190 | Badge settles to 100% at `(418,396)`; fully drawn check holds. |
| 190–222 | Check retracts while badge fades and card/receipt return. |
| 234–240 | Card restores its exact first pose; identical loop endpoint. |

Output: **11 layers**, **128,191 bytes**.

SHA-256: `738be33d3a2f97300acd85dd2a6a02daeba3f0dd363d8c8db56f382dcd648707`.

## Executed TDD and verification

Each sample was implemented as a separate end-to-end RED → GREEN slice. Commands ran under the shared CPU resource guard:

```sh
$HOME/.hermes/hermes-agent/.venv/bin/python \
  $HOME/.hermes/scripts/resource_guard.py run --max-seconds 180 -- \
  npm exec vitest run tests/showcase.test.ts
```

1. **Dispatch RED:** `1 failed (1)`, expected `ENOENT` opening `apps/web/public/samples/dispatch.json`; guard return code **1**.
2. **Dispatch GREEN:** `1 passed (1)`; guard return code **0**. Real generated content then passed the behavior assertions, not merely existence.
3. **Approved RED:** `1 failed | 1 passed (2)`, expected `ENOENT` opening `apps/web/public/samples/approved.json`; guard return code **1**.
4. **Approved GREEN:** `2 passed (2)`; guard return code **0**.
5. **Regression:** guarded `npm exec vitest run` returned **3 files passed, 29 tests passed**, guard return code **0**. `npm exec eslint tests/showcase.test.ts` and `npm exec tsc -- --noEmit` also completed without diagnostics.

`tests/showcase.test.ts` proves both documents parse within the document-core byte/complexity budgets; expose the exact five static palette groups with teal first; contain no external resources, fonts, text layers, gradients, or expressions; contain only finite numbers; and include genuinely changing transform and shape-trim keyframes. It checks all animated endpoints for loop equality and ordered key times. The approved test additionally checks the check's actual two-leg geometry, a partially drawn intermediate frame, and the fully drawn hold.

For every integer frame **0–240 inclusive**, the tests evaluate the authored temporal Beziers and layer transforms, enclosing every rectangle/ellipse, path vertex, and Bezier control point with stroke padding. All transformed geometry stays within a conservative **12 px canvas inset**, including hidden layers. This is numerical geometry safety, not a screenshot-based appearance judgment. The tests also recolor teal through `parseDocument`/`setColor`/`recolor`/`exportJson`, assert that only the exact registered RGB paths change while alpha and every other field remain identical, and verify unchanged source bytes and exact reset behavior.

**Parent integration follow-up:** actual browser captures exposed the background groups occluding the parcel label, manifest and card details. A new stacking regression test failed first, then the layer serializer was corrected to reverse authored back-to-front shape groups. The three showcase tests now pass; the final complete unit suite has 30 passing tests. Actual desktop captures after the correction show the barcode, label, manifest, chip, receipt and success badge. Real app interaction footage records both samples, palette changes, comparison and export. These runtime observations are separate from the generator numerical proofs.  Suggested frames: dispatch **0, 54, 96, 154, 190, 239**; approved **0, 54, 94, 110, 136, 190, 239**. Runtime appearance is separate from the passing structural/numerical proof.
