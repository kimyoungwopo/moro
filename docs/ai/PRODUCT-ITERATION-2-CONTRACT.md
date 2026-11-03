# Moro product iteration2 — generate, revise, reuse

Authorized2026-10-31: user clarified 'MORO 제품' after asking to develop further. Local implementation only; no commit/push/deployment/auth/global settings changes. Preserve all existing dirty-tree work, palette mode, data-only provider isolation, explicit Apply, one Undo and manual file save/export.

## Scope and ownership

Parent: TS context helpers/client/session/AiPanel, Creator integration, loop-intent fix, e2e, final real-model flow and delivery. Backend worker: bridge/src/{lib,main,jobs,provider}.rs and bridge/tests/**, with handoff artifacts/iteration2-backend-handoff.md. Library worker: NEW apps/web/src/creator/library/**, tests/library*.test.ts and public/authoring/** only; handoff artifacts/iteration2-library-handoff.md. No overlap. Use behavioral RED→GREEN before production code. Heavy suites use existing shared resource guard, never nested. No new dependencies or Python project tooling.

##1. Explicit contextual AI refinement

Keep legacy POST `{provider,prompt}` unchanged for new motion. Refinement sends `{provider,prompt,baseProject,contextConsent:true}`. Reject incomplete/false context consent, extra fields, invalid context before CLI execution. `baseProject` is CreatorProject with max20layers/all five tracks arrays, canonical compact JSON <=65536 UTF8 bytes; raw request body max131072bytes. Return clear `invalid_context` / `context_too_large` / `context_consent_required` codes. No current project/repository/binary uploaded by default.

Native bridge accepts the new explicit fields and uses contextual prompt for both actual provider adapters while preserving existing `generate`/Jobs.start signatures as wrappers for tests/callers. Add `provider::generate_with_context(provider,exe,prompt,Option<&Value>,cancel,timeout)` and analogous job start path. Validate context before starting job and before provider invocation. Compose context as quoted/serialized DATA, never file access or permission. Ask to preserve unrequested geometry/layer IDs/timing and return only complete valid CreatorProject. No token/profile changes; native result validation/output schema stays same. Do not echo baseProject in job DTOs/logs. Keep cancellation/limits/late-result protections. Existing new-generation input semantics unchanged; contextual input must retain exact supplied prompt text apart from existing validation.

Frontend `AiClient.start` and `AiSession.generate` get an OPTIONAL fourth argument `{project:CreatorProject,consent:true}`. Client validates/canonicalizes snapshot and bounds before HTTP. Context serializer adds missing empty transform arrays but does not change geometry; does not mutate current document. Context is part of visible consent, not appended silently to user brief. Active session retains submitted baseProject and context state. Request still includes the existing visible target-size header.

AI panel mode defaults 'New motion'; alternate 'Refine current project' requires nonempty supported current project and a distinct checkbox label `I agree to send this brief and the current project to the selected AI provider.` Changing mode/provider/target/brief clears consent. Show what is sent and20layer/64KiB limit. No automatic request or Apply. Before Apply, show added/removed/changed layers + changed project settings, and block contextual Apply if the current document differs from submitted base. Parent rechecks freshness in apply handler. Content comparison is key-order independent and treats absent/empty tracks and absent/null/0 radius as equivalent defaults; name/order/timing/actual values remain significant. One Undo restores pre-Apply project.

##2. Local library

NEW module `apps/web/src/creator/library/store.ts` exports:
```
type SaveMotionInput = {project:CreatorProject;origin:'ai'|'editor';provider?:'codex'|'claude';brief?:string};
saveMotion(input:SaveMotionInput):Promise<SavedMotion>;
listMotions():Promise<SavedMotion[]>;
removeMotion(id:string):Promise<void>;
```
SavedMotion has stable id, version1, createdAt and those validated input fields. Store validated JSON project copies in IndexedDB, never localStorage or tokens. Max12 entries, reject capacity explicitly; DO NOT automatically evict/delete older user data. Handle unavailable/quota/transaction failures honestly and preserve editor work. Validate read records; malformed entries never execute. Keep save source attribution: AI proposal origin'ai', manually edited current document origin'editor'. Pure policy helpers tested without new fake-IDB dependency; parent tests actual browser IndexedDB persistence/deletion.

NEW `MotionLibrary.tsx` default component props `{currentProject:CreatorProject,onOpen:(project:CreatorProject,origin:'example'|'saved')=>boolean,onClose:()=>void}`. Native dialog, scoped CSS, Examples/Saved sections, save current project action, clear errors/loading,44px controls/mobile. `onOpen` returns false on parent's unsaved-work cancellation; keep modal then. Deletion requires user's native confirm. Close/Escape restores parent's normal flow. Parent topbar only adds 'Motion library', not a wall of redundant actions. AI proposal separately has 'Save proposal locally', with success only after transaction completes.

##3. Genuine AI examples

Bundle actual previously generated ai-chick and ai-confetti project JSON plus real poster PNG under apps/web/public/authoring/. Source: examples/authoring/ai-chick/project.moro.json and ai-confetti/project.moro.json; posters from research/moro-ai-character-20261031/poster.png and moro-ai-confetti-20261031/poster.png. Source is actual generated data; no external assets. Label examples 'Previously AI-generated example — opening this does not call AI'. Fetch/validate on user click, use parent onOpen callback. Never silently load a preset as a new AI run. Poster is only a thumbnail; actual editor uses real exported Lottie.

##4. Loop intent

Regression from actual chick brief: '4초 루프...중간에 한 번 눈을 깜빡...처음과 마지막자세같이' must mean loop, not event. Explicit no-loop negation wins, but incidental '한 번 눈깜빡' must not veto an explicit loop request. Preserve existing conservative ambiguous/negative tests.

## Parent acceptance

- Run full regression on integrated candidate and actual browser390/1440 flows. No lint weakening.
- Library: examples -> actual project -> local save -> reload -> reopen -> delete confirmation; no AI POST from opening example/library.
- Refine: context absent by default, context consent gate, validated full-project payload, stale base blocks Apply, diff actual fields, oneUndo. Fixture tests explicitly labeled.
- One bounded REAL Codex refinement of the previously AI-generated chick: request only larger wing greeting, preserving face/body/palette. Record original -> consent -> actual model -> raw proposal -> diff -> explicit Apply -> export -> Undo. No manual output repair or template substitution. If model changes unrequested parts, disclose diff; do not claim semantic success from protocol alone.
- Deliver current source/archive + actual demo/proofs, list exact counts and remaining limitations. Child handoff is not task completion; parent must consume and exercise it in this active work slice.
