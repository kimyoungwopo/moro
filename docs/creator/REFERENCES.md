# Reference map and provenance

## Read only what the task needs

| Question | Authoring source |
|---|---|
| Where do I start? | [Skill router](../../skills/lottie-authoring/SKILL.md) → brief → project → real CLI → player |
| How do I stage readable shapes? | [Composition](../../skills/lottie-authoring/references/composition.md) |
| What should move, and why? | [Motion principles](../../skills/lottie-authoring/references/motion-principles.md) |
| Which key controls this segment? | [Timing/easing](../../skills/lottie-authoring/references/timing-easing.md) |
| How does the reset disappear? | [Looping](../../skills/lottie-authoring/references/looping.md) |
| What is accepted today? | [Compatibility](../../skills/lottie-authoring/references/lottie-compatibility.md); [contract](CONTRACT.md) is authority |
| Which original input can I edit? | [Recipes](../../skills/lottie-authoring/references/recipes.md), [example index](../../examples/authoring/README.md) |
| What proves delivery quality? | [Design rubric](AUTHORING-DESIGN.md) |

## Provenance ledger

| Record | Inspected material / status | Use and limits |
|---|---|---|
| MORO-CONTRACT | Repository `docs/creator/CONTRACT.md` and `PRODUCT.md`, read during authoring | Exact project/API scope and preservation of palette mode. Contract describes implementation requirements, not independent proof of implementation. |
| LF-REA-20261031 | Local research `lottiefiles-rea-20261031/REA-REPORT.ko.md`, sections 1–6 inspected; analysis date 2026-10-31 KST | Prior public-service static REA, not fresh browser testing. Report separates editable Creator envelope from deployment Lottie and distinguishes Editor handoff from persistence. Applied only as a product-boundary lesson: project save ≠ animation export. |
| MORO-CRAFT-01 | This skill's composition/motion/timing/looping guidance | Original authored suggestions. No external benchmark, quality score, user study or universal timing standard is claimed. |
| MORO-EXAMPLES-01 | `examples/authoring/{loader,success-feedback,product-interaction}/project.moro.json` and paired briefs | Original geometric projects authored for Moro under the repository's first-party MIT license; no gallery asset, font, image, expression or proprietary bundle copied. Parent integration generates and verifies any `animation.json`. |

The local REA report is outside this source tree (`../research/lottiefiles-rea-20261031/REA-REPORT.ko.md` relative to the repository). It may be absent in a fresh checkout; it is a provenance record, not a build/runtime dependency. Its evidence identifier is `ev_94b0b4157df87253e504ae612a5a96ddcdd3617cd26136db128d673c7baec03f`. The report explicitly limits semantic coverage and excludes browser login/upload/save execution. This authoring work inspected the report, not proprietary source or a recovered original repository; it does not re-certify the report's underlying extraction.

No LottieFiles JS/CSS bundle, private API protocol implementation, gallery animation, branding or extracted asset is included in this authoring layer. Names identify research provenance, not affiliation. No live external research was needed for the original craft suggestions. Any future imported technique/asset needs a separate source, license, adaptation and verification record before inclusion.
