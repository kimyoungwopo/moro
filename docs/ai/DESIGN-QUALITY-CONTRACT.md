# Design-quality repair contract — 2026-10-31

Scope: solve the observed tiny completion badge and angular check joints, not merely list limitations. Preserve palette/editor, original files, no-tools isolation, explicit Apply/one Undo. No commit/push/deploy/auth changes. New native support stays Rust; existing TS stays TS. Parent owns integration, model QA, rendering, delivery.

## Geometry extension (worker core owns)

- `CreatorLayer.cornerRadius?: number | null`, static only. Missing/null/0 retains old square geometry. Rect finite0..min(width,height)/2. Ellipse accepts only missing/null/0; reject positive values. Reject negative/nonfinite/oversized/unknown fields.
- Export rect `rc.r.k = cornerRadius ?? 0`. Do not change old project serialization or global rectangle appearance. Copies, edits, parse/reopen/CLI preserve value. Include the field in update APIs.
- AI JSON schema: cornerRadius REQUIRED nullable number (strict-provider schema), description of dynamic max and ellipse null. Native Rust validator accepts legacy exact14 fields OR those plus this known optional field; it never fills or mutates returned source. New schemas/model generation use the new field; old persisted projects stay readable.
- Core worker owns packages/creator-core/src/**, tests/creator-core.test.ts (or new focused file), schemas/creator-project.schema.json, bridge/src/lib.rs, bridge/tests/validation.rs. Does NOT touch provider.rs or prompt.rs.

## Frontend integration (worker UI owns)

- Rect-only inspector `Corner radius` with valid bounds, parsed through existing immutable history; one Undo and save/reopen/export. Never coerce old background into rounded rectangles. Ellipse has no positive radius control. CornerRadius null/missing displays0.
- AI panel adds `Target display size`64/128/512 before Generate (default64). Visible disclosure that selected size is sent with the brief; changing size clears consent and active generation disables it.
- Target context is plain bounded brief data, e.g. `Design target: 64px (final display size, not canvas dimensions).\n\n<original>`. Keep API/job shape unchanged. Complete outgoing string <=4000; no truncation. Show actual remaining brief limit. Submitted brief contains the exact sent text and proposal review initially uses that submitted target, not later edits.
- Add pure helper/tests for this bounded composition. Keep session/provider isolation, apply/undo/cancellation intact. Do not claim screenshots/warnings are automatically sent.
- UI worker owns apps/web/src/creator/Creator.tsx, creator.css if required, apps/web/src/creator/ai/** and its new/focused tests. Does not edit e2e; parent owns browser tests.

## Parent design/motion work

- Preserve existing root DESIGN.md tokens; add a link from root to bounded generation-specific skills/lottie-authoring/references/design-system.md. Root describes app UI, not an unlimited planner payload.
- Add MOTION.md as a real compact motion-reference source, plus a canonical rounded-check/badge recipe with explicit geometry, target-pixel-to-canvas conversion, named phases and hold/loop rules. No invented aesthetic scores.
- Actually embed those bounded references in provider::build_prompt and test real adapter subprocess delivery, keeping prompt <24000 bytes. No extra execution permissions or file access.
- For the supported compact UI direction, check/bar thickness >=3 target pixels and completion badge >=10 target pixels; hero >=24 target pixels. These are deliberate project defaults, not universal laws. Geometry scales with canvas/selected target. A badge must include a readable completion mark, not only a tiny colored dot. Simplify at64 rather than miniaturize512 composition.
- Check uses correct midpoint/atan2 segments, rounded bars radius=thickness/2, shared join, no extra crossing tail; keep geometry static while plate/opacity animates.

## Acceptance

1. Behavioral RED→GREEN for radius validation/export and target context, then full existing suites. Child must write logs and handoff to artifacts/design-core-handoff.md or artifacts/design-ui-handoff.md.
2. Native SVG radius rendering, inspector undo/save/reopen and mobile, consent/target-size forwarding tested in browser. Model fixture tests explicitly labeled.
3. Same original success/product user brief strings regenerated via actual Codex with selected display target64 and new trusted design guidance. Preserve original AI outputs and comparison evidence. Any new target context disclosed separately from unchanged user brief.
4. Actual64px start/settled stills, bounds, continuous video, native playback and human visual review. Neither numeric pass nor a hand-authored recipe proves model quality. If output still fails, repair the narrow cause and report the remaining failure, not generic 'all high quality'.
5. Deliver playable before/after, current source and editable examples; report no remote publication. Do not close on finished child handoff or docs alone.
