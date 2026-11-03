# BYO AI CLI integration — v1 contract

User selected existing Codex / Claude Code tools first, not direct API-key/Ollama integration. Preserve the verified creator and palette modes. New local bridge implementation is Rust, not Python. No remote push/deploy, credential extraction, automated login, provider config edits or automatic publication.

## Product slice

Creator `/create` exposes an AI assistant panel. User selects Codex or Claude Code, writes a brief and explicitly consents to sending that brief to the selected AI provider. This first slice creates a NEW animation proposal; it does not send the current document or edit the repository. Provider-owned existing authentication is used by the official executable. Installed is not authenticated/inference verified. CLI billing/quota follows the user's actual CLI account; do not call it free or equate subscription and API billing.

AI returns CreatorProject v1, not code, shell commands or arbitrary Lottie. Both bridge and frontend validate it. Previewed proposal metadata must say provider/name/layers/duration. The explicit Apply proposal action replaces the creator document as ONE undoable edit. Existing manual work remains unchanged on generation, error, cancel or validation failure. No automatic apply or model tool execution.

## Shared HTTP contract

Rust server serves production dist and `/api/ai/*` SAME origin at loopback 127.0.0.1; default port 4174. CLI `moro-ai-bridge --web-root /path/to/dist --port 4174`. It must not bind 0.0.0.0 or tunnel. Browser fetches relative URLs (no port hardcoding, credentials/cookies/token storage). Existing static Node/Vite-only use remains useful: missing bridge shows helpful setup, not a broken editor. Vite proxy is optional parent integration, not worker assumption.

All JSON responses use `Cache-Control: no-store`, no wildcard CORS. Mutation requests require `Content-Type: application/json`, `X-Moro-Request: 1`, and when Origin exists it must exactly equal the validated loopback Host origin; reject `Sec-Fetch-Site: cross-site`. Validate Host with exact configured port. No request-controlled executable, args, directory, environment, provider URL or filesystem access. Unknown JSON request fields fail. Strict bounded request bodies and safe public errors only.

`GET /api/ai/status` → `{ok:true,providers:[{id:'codex'|'claude',label:string,installed:boolean}],scope:'installed-only'}`. It never returns email, paths, credentials, raw CLI output or a false logged-in state.

`POST /api/ai/jobs` body `{provider:'codex'|'claude',prompt:string}`. Trimmed prompt 1–4000 chars, body <=32KiB. Returns HTTP202 `{ok:true,job:{id:string,status:'running'}}`. Exactly one generation at a time; second gets HTTP409 error code `busy`. Unsupported/missing provider is a visible safe error; never silently substitute the other provider.

`GET /api/ai/jobs/:id` → `{ok:true,job:{id,provider,status:'running'|'succeeded'|'failed'|'cancelled',project?:CreatorProject,error?:{code,message}}}`. A succeeded job has a valid project only. Unknown ID HTTP404. Keep a bounded in-memory terminal job history (max16); no prompt/credential/response persistence is required.

`POST /api/ai/jobs/:id/cancel` body `{}` → `{ok:true,job:{id,status}}`. Cancels ONLY that job's owned process group; once cancellation requested, the job must not publish late success. Repeated terminal cancellation returns its actual terminal status. Timeout <=180s, stdout <=2MiB, stderr <=64KiB. Cancel/timeout/oversized stdout kill and reap owned processes; resource cleanup is separate from job completion.

Errors: `{ok:false,error:{code:string,message:string}}`. Public error text is fixed safe guidance; never forward raw stderr, prompts, local paths or credentials. No generated JS is executed.

## CreatorProject output

Existing `docs/creator/CONTRACT.md` and `packages/creator-core/src/index.ts` remain authoritative. `schemas/creator-project.schema.json` supplies strict structured output for BOTH CLIs. Required fields: version=1, name, width, height, fps, durationFrames, layers. Each layer has id,name,type,x,y,width,height,fill,stroke,strokeWidth,rotation,opacity,scale,tracks. All five tracks present as arrays (empty allowed); each key has frame,value,easing. No unknown fields. AI-specific maximum20 layers, <=100 keys/track. Apply existing core bounds/unique IDs/unique sorted frames/frame<durationFrames/finite values/#RRGGBB/valid easing. Project text <=2MiB; names/IDs <=200 chars with no control characters. Root dimensions16..4096, fps1..120, duration2..3600 integer. No text, assets, images, expressions, paths or executable hooks.

Frontend calls existing `parseProject(JSON.stringify(job.project))` even after Rust validation. It must not trust TypeScript casts or the provider's schema claim.

## CLI safety

Invoke reviewed configured local executables with argument arrays and prompt on stdin; no shell interpolation. Use an EMPTY application-owned isolated working directory outside the source repository. Official CLI reads its own existing login; bridge never reads/copies credentials.

Tested installed executables: Codex CLI0.153.4 (`exec --ignore-user-config` is supported and preserves official auth), Claude Code2.1.105. Discover actual help, do not assume every user's older CLI supports these flags; fail safely with update guidance. Disable hooks, user/project settings, plugins, MCP discovery, shell/browser/image/agent tools and project-rule discovery for this structured-data worker. Codex retains read-only sandbox and never uses danger-full-access; reject tool-call/file-change items and error events, not just nonzero exits. A narrowly verified startup diagnostic is the only exception: the exact item.error message below may be classified as a known disabled-capability warning ONLY when this invocation explicitly disables code_mode_host, contains no tool/file-change events, has no other errors and returns a valid structured project:

```text
Code Mode is unavailable because code-mode host is disabled. Code mode will fail closed; enable `features.code_mode_host` and install `codex-code-mode-host`.
```

Do not match substrings, accept the `Falling back to direct tools` variant, or enable the host to obtain success. This comes from upstream rust-v0.153.4 `core/src/tools/code_mode/mod.rs::take_unavailable_warning`, which emits once for intentionally unavailable execution. Set invocation-local `suppress_unstable_features_warning=true` for skip_host_skill_discovery; do not edit user config or ignore arbitrary warnings/errors. Claude uses `--tools ''`, empty strict MCP config, empty setting sources, disableAllHooks, dontAsk, no Chrome and no session persistence; DO NOT use --bare because that disables subscription OAuth. Preserve independent authentication and inferencing evidence.

No live model request in default tests. Provider process fixtures must be clearly labeled fake CLI protocol tests and cannot count as real AI. Parent owns one bounded nonsensitive live CLI/UI smoke after adapters and policy tests pass.

## File ownership

- Rust worker: `bridge/**`, `schemas/creator-project.schema.json`, `artifacts/ai-bridge-handoff.md` ONLY. No UI/root package/config edits. Strict behavior RED→GREEN and actual Rust tests; prepare tests while toolchain is being installed, do not invent successful outputs.
- UI worker: `apps/web/src/creator/ai/**`, `tests/ai-client.test.ts`, `artifacts/ai-ui-handoff.md` ONLY. Export default `AiPanel({onApply:(project:CreatorProject)=>void})` from `ai/AiPanel.tsx`; parent wires into Creator. Scoped CSS. No root main/core/bridge/package edits. Strict behavior RED→GREEN under shared CPU guard; no live model calls.
- Parent: Rust toolchain bootstrap, integration in Creator, scripts/docs/browser tests, live provider validation, source packaging and final delivery.

## Acceptance

Actual Rust build/test + CLI protocol fixtures + frontend unit tests → real bridge HTTP security/cancellation checks → browser generated proposal does not change canvas until Apply; Apply is one Undo and actual Lottie export works → one real installed provider generation with valid project and same UI apply/export (or an exact authentication/rate-limit blocker). Retain previous52 unit/3 distribution/6 guidance/15 browser regressions. Report fixture, CLI live inference and browser/UI evidence separately. No public demo deployment.
