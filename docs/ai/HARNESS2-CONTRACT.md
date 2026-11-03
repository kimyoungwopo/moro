# Moro internal quality harness — frozen first slice

User authorized internal harness construction using Google Harness² after rejecting the human artwork. This slice is a working repository-local Rust runner/CLI, not another Markdown-only checklist and not an app redesign. Preserve the dirty worktree and existing AI UI/provider behavior. No commit/push/deployment/global profile/auth/AGENTS changes. No new Python project tooling. External original upstream demo may be exercised unmodified after code review, without model credentials.

## Upstream and honest adaptation

Official google-research/harness2 HEAD verified by git ls-remote:1cfe254e8d25b15f37048c3730134686abe60335. Original is Linux/Python and exposes broader editable tools/guardrails and sandbox-disabled execution. Do not inherit those permissions. Port one k=1 parallel Propose–Probe–Compose cycle into Rust: base rollout, invariant editor, domain editor, two candidate rollouts, composition editor, final rollout. Exactly4 executor rollouts +3 guidance edits = at most7 provider calls. No retries. No claim to run the original Python engine inside Moro or to guarantee artistic improvement. Preserve upstream Apache2 attribution/license and name deviations explicitly.

## Scope

- Native Rust harness runner plus opt-in CLI and trusted, bounded craft knowledge. Existing creator geometry and20-layer cap are NOT extended in this slice.
- Domains `ui-motion` and `human-character`. High-quality human-character preflight must BLOCK before any provider invocation, naming missing path/curve, grouping/parent transform and pivot capabilities. The earlier toy human must not become an approved baseline merely because it renders.
- Supported ui-motion runs return `review_required`, never `approved`. Structural/schema/renderer success is not artistic acceptance. Every final project remains a proposal; the harness never overwrites or Applies the live editor project.
- Baseline and probes use exactly the same original task; only advisory guidance is varied. All model-proposed edits are strict bounded JSON data (`rules` array, `rationale` string), not executable scripts/plugins/tool changes. No authority to mutate safety, auth, global instructions or engine constraints.
- Data-only existing provider isolation, bounded stdout/stderr/deadline/process cleanup and exact protocol rejection remain intact. Original generate/build_prompt/parse_output callers remain compatible.
- Native CLI no-provider preflight/check/report is default. A real run requires explicit `--allow-model-calls 7`, visible scope/budget and approved brief. No actual paid model run is authorized just by opening a report. Implementation verification uses explicitly identified protocol fixtures, not fabricated real-model success.

## Core interface — worker owns only harness.rs and harness tests

`bridge/src/harness.rs` exports these public names (serde camelCase structs, domain kebab-case enum):

```
Domain::{UiMotion,HumanCharacter}
Task { brief:String, domain:Domain, provider:String }
Request { task:Task, consent:bool, call_budget:usize }
KnowledgeSource { path:String, sha256:String, content:String }
OutputKind::{Project,Guidance}
trait Executor { fn invoke(&mut self,stage:&str,kind:OutputKind,prompt:&str)->Result<serde_json::Value,String>; }
preflight(task:&Task)->Result<serde_json::Value,String>
run(req:&Request,sources:&[KnowledgeSource],executor:&mut dyn Executor)->Result<Report,String>
```

Report must serialize at least `schemaVersion`, `upstream` (repo/revision/adaptation), `task`, `status`, `blockers`, `sources`, `stages`, `modelCalls`, `callBudget`, `artisticReview` (always not_reviewed), `project` (optional final), `guidance` (optional composed). Public Report can use typed structs or bounded Value for nested fields; parent CLI serializes it. Stage ids exactly `base`, `propose-invariant`, `propose-domain`, `probe-invariant`, `probe-domain`, `compose`, `final`. Each stage records kind, status and bounded validated data/error code. Raw untrusted stderr must not enter reports. Errors stop safely; preserve prior stage evidence, no automatic retry/fallback masquerading as an improved candidate.

Guidance has exactly `rules:Vec<String>` (1–8 nonempty rules, each<=500Unicode characters, total serialized<=8192UTF8bytes), `rationale:String` (1–1500characters). Export `validate_guidance(&Value)->Result<(),String>` and `GUIDANCE_SCHEMA:&str` if useful to parent provider adapter. Use existing crate::validate_project for every rollout. Never interpret model-returned quality/self-approval fields; reject unknown fields.

Core has no filesystem/provider/env access; Executor injection is the boundary. Pure TDD must prove: zero-call human block/consent/budget rejection; actual seven-stage ledger; same task retained; unknown fields/invalid projects rejected; no auto-approved art; failed executor halts without extra calls; all source text actually appears in runtime prompts; final uses composed guidance; malicious instruction-looking strings remain data and cannot mutate permissions. Use small policy/behavioral slices RED→GREEN, not compiler absence as evidence.

## Parent ownership

Parent edits lib.rs export, provider.rs and typed-output schema handling, new native CLI bin/Cargo metadata, repository knowledge files/checker, package scripts, end-to-end real subprocess fixtures, full regression/portable source archive and delivery. Worker must NOT modify those. Parent provider adapter invokes same isolated official CLI, with Guidance schema for editor phases and original project schema for rollouts.

CLI commands: preflight (zero model calls), run (explicit7-call consent), report inspection and explicit review-based lesson export. All writes are create-new and bounded; no overwrite/auto-promote. Lesson records preserve domain, exact composed rules and source report evidence; they do not become global instructions or get silently injected into future calls. User review remains a separate gate. SHA256 source/report fingerprints are computed by a reviewed fixed OS hashing utility (macOS shasum/Linux sha256sum) or incumbent Node crypto; no handwritten cryptography/new dependency is needed. Store exact knowledge snapshots, not just file paths.

## Acceptance

- Upstream source mapping and safe original deterministic demo, distinct from native port evidence.
- Real native runner + CLI and actual CLI-protocol fixture exercise; deliberately fake provider produces real validated projects, portable JSON reports and all7stage transcripts. No live-model or aesthetic improvement claim from fixtures.
- Human high-quality request exits blocked with0calls and an actionable capability explanation. Invalid consent/budget/guide/schema fail before paid work. No default provider calls or live-editor mutations.
- Full current app/browser/Rust regression after integration; inspect changed source/archive contents and do not exclude existing work. Deliver functioning source ZIP plus reports and concise limitations. UI for comparing/adopting inside the app and curve/rig engine support are future scope, not silently claimed implemented.
