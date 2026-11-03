# AI quality repair contract

Task: fix observed real-generation defects without editing generated project data to manufacture a pass. Preserve APIs/security/provider authentication and existing manual creator/palette. New backend work stays Rust; existing frontend/domain tests stay TypeScript. No new dependencies, permissions, token access, public push/deploy or unsupported path/SVG/AI-vision claims.

## Observed baseline

Original live fixtures are under ignored artifacts/ai-quality. Reuse exactly cases.json for post-fix comparison. Loader3layers is readable/basic; success4layers was clipped and check joint crossed (x/y treated as top-left); product11layers is a geometric prototype and badge too small at64px. Guided success improved after explicit center/joint instructions but was a separate brief, not a product fix. provider.rs does not currently supply the craft references. Source audit docs/ai/QUALITY-REVIEW.ko.md and artifacts/ai-quality-capability-audit.md distinguish this clearly.

## Parent-owned Rust changes

Expose a pure tested build_prompt(brief) actually used by BOTH adapters. Include bounded trusted repo craft references (composition, motion-principles, timing-easing, looping), plus explicit center coordinates/background center, bottom→top layers, percent units, check segment joint construction, target-size simplification, outgoing easing/holds and loop/event differences. Do not turn references into tools/file access. Preserve data-only worker/no host capabilities. Schema x/y and position keys document center semantics. Keep existing strict limits and explicit Apply.

Parent owns bridge/**, schema, docs, root scripts, browser tests, controlled real Codex generation, baseline comparison, packaging and final report. Child does not modify these.

## Frontend worker scope

Own ONLY apps/web/src/creator/ai/**, tests/ai-client.test.ts, tests/ai-review.test.ts and artifacts/ai-quality-ui-handoff.md. Parent has already wired AiPanel in Creator.tsx; do not edit Creator, core/player packages, root package/config or bridge.

1. Show the READY proposal in an actual exported-Lottie light-player preview BEFORE Apply. Use existing exportLottie + createPlayer and the real project. Do not implement a CSS imitation or display a success-quality badge. Preserve parseProject revalidation, explicit one-Undo Apply, cancel/stale response/session lifecycle and missing-bridge fallback.
2. Preview controls: real frame seek (accessible numeric 'Proposal frame'), Play/Pause (buttons 'Play proposal'/'Pause proposal'), and display-size selector 'Proposal size' with 64,128,512 values. Use data-testid='ai-proposal-preview' on actual player host. Starts paused, responds to reduced-motion preference; respect dirty/editor focus. Ensure square artboard without inline SVG baseline extra pixels. No auto applying preview state to editor.
3. Pure reviewProject(project, options?) helper uses existing sampleLayer, not guessed interpolation. Return bounded sample-based diagnostics and explicitly state numeric checks are not visual approval. Suggested return {warnings:[{code,layerId?,frame?,message}],sampledFrames:number,structuralOnly:true}. Return <=32 warnings, safe known messages; no untrusted HTML/rendered raw error. Options targetSize64 by default and loop intent boolean/undefined. Inspect bounded frame/key/midpoint samples; accurately include rotation/uniform scale/stroke in rect/ellipse bounds; treat both-zero-opacity endpoints as hidden reset. Report no_layers/no_visible_content/off_canvas/tiny_at_target_size/low_opacity/no_motion/loop_endpoint_mismatch as appropriate, without hard rejecting legitimate fade/offcanvas entrance/still. Do not claim full-frame/pixel or semantic checkmark recognition. Keep sampling bounded for20layers/3600frames/100keys, don't freeze typing UI.
4. Tie intent/target preview to submitted brief, not a later edited textarea; do not label a later provider selection as the proposal's original provider. If no reliable loop intent, do not call an event's unequal endpoints a defect. Use visible warning language 'Review needed' / 'No numeric issues detected' plus explicit not-an-artistic-approval text.
5. The existing brief field can be edited then Generate again (requires new consent). Make that review→adjust brief→regenerate route clear without pretending the model receives rendered images/current project. No new HTTP endpoint or hidden automatic retries/model calls. Do not silently repair source project geometry.
6. Preserve >=44px mobile controls; keyboard access, preview cleanly disposed/reloaded only when project changes, seek not regenerating JSON every tick. Scope CSS. No production mocks.

## TDD / acceptance

Strict runnable behavioral RED→GREEN; native fetch remains globalThis.fetch.bind(globalThis). Review tests include actual observed success project topology/center out-of-bounds, tiny/transparent layer, valid fade/reset, rotation/stroke bounds, normal loop and event cases, max sample limits. Tests may read original ignored artifacts only for exploration; checked-in tests must use portable minimal fixtures and no secrets/absolute user paths.

Existing base:69unit,22Rust,16browser+3distribution+6guidance. Parent owns browser tests checking visible real pre-apply SVG at frames, untouched old editor before Apply, one-Undo Apply/export, warnings, controls at390px and unchanged security. Child may run guarded scoped unit/lint/type checks, no live AI calls/full browser suite or credentials. Shared guard $HOME/.hermes/hermes-agent/.venv/bin/python $HOME/.hermes/scripts/resource_guard.py run --max-seconds 180 -- ... . Existing external Python guard is allowed, no new Python project code. Save exact RED/GREEN/check evidence and limitations in handoff; no commit/push.
