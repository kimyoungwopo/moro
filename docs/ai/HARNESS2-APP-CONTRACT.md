# Harness² app integration contract

Status: implementation scoped 2026-11-01. Existing native CLI, 64 Rust / 121 frontend / 20 browser baseline and source archive verified before starting. This is a new local work slice after the expired 07:00 operation; do not restart old schedules. No public commit/push/deploy, actual model inference, auth/config changes or protected instruction-file writes.

## Scope and ownership

Connect the existing bounded Rust harness to the existing creator. Parent integrates Creator.tsx and owns acceptance/delivery. Backend worker owns bridge implementation/tests only. UI worker owns apps/web/src/creator/harness/** and tests/harness-*.test.ts only. Engine feasibility audit is read-only. Do not change the rect/ellipse engine or unblock human-character as a side effect. A functioning review UI does not prove artistic improvement.

## HTTP contract (existing same-origin/loopback/header/body protections)

- POST `/api/ai/harness/preflight`: exact `{provider:'codex'|'claude', brief:string, domain:'ui-motion'|'human-character'}`. Trimmed nonempty brief, <=4000 characters. Zero provider calls. Reply `{ok:true,preflight:{status:'ready'|'blocked',blockers:string[],artisticReview:'not_reviewed',modelCalls:0,callBudget:7}}` (additional bounded capability metadata permitted).
- POST `/api/ai/harness/jobs`: the same fields plus literal `consent:true,callBudget:7`. Unknown fields, snapshots, alternate budgets/false consent rejected before provider activity. Human domain blocked before provider resolution. Reply 202 `{ok:true,job:{id,status:'running',provider,kind:'harness'}}`.
- GET `/api/ai/jobs/:id`: existing envelope, harness jobs add `kind:'harness'`, optional `stage` (known seven stage ID), terminal succeeded `report` holding the existing `harness::Report` JSON. No file paths from browser, arbitrary source packs, code or tools.
- POST `/api/ai/jobs/:id/cancel` with `{}`: shared cancellation. Existing process-group cleanup remains authoritative; normal/harness jobs share one admission slot, held until cleanup finishes. One job never has more than seven invocations, no retries, each bounded to existing 180s or a smaller remaining overall limit.
- Existing normal-generation API stays compatible. New panel must not fall back from harness to ordinary generation. Explicit configured fixture binaries only in offline tests, empty/disposable provider PATH/HOME; never discover installed real CLIs in fixture tests.

## Frontend contract

`HarnessPanel.tsx` default export props `{currentProject: CreatorProject; onApply:(project:CreatorProject,baseProject:CreatorProject)=>unknown}`. Component/client lives inside creator/harness. Parent supplies a synchronous latest-project guard and existing history commit. No direct access to parent history or mutation of currentProject.

Opening/checking/preflight/polling never invokes provider inference. User separately consents to up to seven official CLI requests and the brief/target display context being sent; no editor project/repository upload. Changing brief/domain/provider/target invalidates preflight and consent. Run only a matching ready preflight with consent; backend revalidates. Snapshot the current editor locally at submit (not sent). Stale editor state disables adoption; no-op proposal consumes no Undo.

Validate reports and each candidate with the real frontend parser before preview/apply. Successful review contains four selectable project stages: base, probe-invariant, probe-domain, final. Display descriptive stage evidence, local deltas and guidance as untrusted text, never a quality score/automatic winner/artistic approval. Use the existing Lottie ProposalPreview for the selected candidate and enable manual candidate selection. Explicit Apply replaces the editor in one edit; one Undo restores previous project. Failed/cancelled/malformed/late output changes neither document nor Undo. Closing/unmount cancels owned pending run safely. No automatic lesson injection.

Offer a local JSON report download after review; identify fixture evidence as fixture-only in tests/delivery, never as actual inference. Mobile 390px/320px and desktop must remain usable, reduced-motion-safe, with bounded polling and provider errors visible without exposing raw diagnostics.

## Acceptance

TDD on backend request validation/admission/cancel/report and frontend validation/selection/stale/no-op. Offline real HTTP->explicit fake protocol provider->native seven-stage harness->app preview/selection->Apply->save/export->independent Lottie player->one Undo. Verify human zero calls, nonconsent zero calls, change-in-flight stale guard, cancel/failed invalid report preservation and mobile overflow. Run full lint/types/unit/build/skill/distribution/guidance/Rust/E2E after integration. Deliver source ZIP with actual entry/hash/integrity verification and result document. Keep engine capability/character art limitations explicit.
