# Rig lab: real AI generation acceptance

Status: implementation, not verified.

## Scope and owner
Parent owns integrated verification, actual one-call Codex generation, recording, raw-response provenance and delivery. Backend and UI work are local reversible edits; no commit/push/deploy, dependencies, login changes, root AGENTS.md write or overnight schedules.

## Frozen API
- `POST /api/ai/v2/jobs` with EXACT fields `{provider:"codex"|"claude",prompt:string,consent:true}`. Nonempty trimmed prompt <=4000 Unicode scalars. No base project, repository, file or contextual upload. Missing/false consent is rejected before provider resolution.
- Response uses existing `{ok:true,job:{id,status:"running"}}` shape.
- Reuse existing `GET /api/ai/jobs/:id` and `POST /api/ai/jobs/:id/cancel` (body `{}`). Success job contains untouched validated `project` version 2. Shared single admission slot with v1/harness, retaining ownership through cleanup.
- Both official CLIs stay data-only, isolated empty cwd, no tools/host/hooks/MCP/plugins/code, bounded output/timeout and process-group cancellation. Existing v1/guidance protocol stays unchanged.
- A distinct server-controlled provider-compatible schema may weaken schema-only cross-field constraints, NEVER the authoritative native v2 validator. No output migration, repairs or manually generated fallback.

## UI
Rig lab gains explicit AI generation panel. Status check is installed-only, never an inference. Empty/closed/refresh opens no jobs. Show official account billing/auth ownership, brief-only transmission and object-motion experimental scope; human quality remains unapproved. Submission explicitly confirms one provider request. Display actual running/error/review state and cancel. Candidate is parsed and export-tested BEFORE preview; preview is independent of current document. Candidate only enters the editor on explicit Apply. Closing/discard/failure/cancel/malformed/stale/no-op/export-budget failure must leave document/Undo unchanged. Parent checks current serializeProjectV2 against frozen request snapshot synchronously and rejects during gestures. One Apply = one Undo. Save/fresh reopen/export use existing v2 UI.

## Acceptance
1. Offline Rust fixtures prove v2 provider schema/prompt, native validation, admission/cancel and v1 compatibility; never resolve a live provider in tests.
2. Browser fixtures prove generate/running/review/Apply/Undo, failure/cancel, stale rejection, no implicit jobs, save/reopen/export and tight mobile layout. Fixture results are NOT live AI proof.
3. After offline gates, user-authorized actual Codex request runs ONCE through the shipped Rig lab button. No manual artwork, old examples, import or response repairs. Preserve visible brief, HTTP submit/job response, exact returned project, downloaded editable document and Lottie.
4. Record empty editor -> input -> real request -> running -> returned preview -> explicit Apply -> playback -> save/export. Preserve real wait (or label speed-up if produced); inspect encoded frames. Verify returned project equals downloaded document and Lottie equals core export. Deliver recording + actual result + original provenance.
5. Report live request failure honestly; no substitute fixture or manual result. Live Claude auth is not assumed repaired. Artistic/human approval remains separate from technical gates.
