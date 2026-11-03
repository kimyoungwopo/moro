# Claude official CLI login handoff — scoped contract

## Scope
Add a reusable Claude connection/login control to all existing AI provider surfaces: creator AI, creator Harness, Rig v2, Studio v3. Keep app account-free. Official Claude Code owns authentication and credentials. No logout, credential extraction, token/API-key/code input in Moro, automatic login, provider setting edits, dependency installs, live inference, commit/push/deploy, or animation changes. Preserve all accumulated dirty work. Root AGENTS.md is protected; do not write it.

Installed evidence: Claude Code 2.1.105; `claude auth login --help` supports `--claudeai` (subscription, default), `--console`, `--sso`; `claude auth status --help` supports `--json` (default). We choose only `auth login --claudeai`, never API billing fallback. Official references: https://code.claude.com/docs/en/authentication and https://code.claude.com/docs/en/cli-reference . Login may require a browser and a code pasted in the user's visible terminal. Moro must never accept or capture those values.

## Exact HTTP contract
Existing Host/Origin, Content-Type and X-Moro-Request security remains unchanged.

`GET /api/ai/auth/claude/status` ->200:
```
{ "ok":true,"provider":"claude","installed":true,"state":"signed_in","loginMethod":"terminal","scope":"cli-reported","inferenceVerified":false }
```
state enum: not_installed|signed_in|signed_out|unknown|cli_update_required. loginMethod: terminal|manual. Only allowlisted fields; no email/account/org IDs, CLI stdout/stderr, auth URLs, tokens, private executable/config paths. Status uses bounded official CLI `auth status --json` in an empty owned working directory and the same allowed HOME/CLAUDE_CONFIG_DIR context as generation. No inference/network probe. A CLI-reported login is not proof that an expired token or the next generation works. Nonzero+loggedIn=false is signed_out; conflicting/malformed/oversize/timed-out output is unknown, never success.

`POST /api/ai/auth/claude/login` requires exactly `{ "consent":true }` with JSON Content-Type and X-Moro-Request:1. Reject unknown/duplicate fields, arbitrary provider/URL/command/email inputs, missing/false consent before any process or terminal launch. No GET side effects. Success202:
```
{ "ok":true,"provider":"claude","handoff":"terminal_requested","authenticationVerified":false }
```
This means only that a terminal handoff was requested, never login success. Errors:400 invalid_request/consent_required;409 busy/auth_handoff_pending;503 provider_unavailable;501 manual_login_required;502 terminal_handoff_failed;504 terminal_handoff_unconfirmed. Generic safe messages only.

## Native handoff
New native/backend work is Rust. macOS uses the fixed `/usr/bin/osascript` with a static reviewed AppleScript and a literal, safely quoted official CLI command passed as an argv value (no browser-controlled command or URL). The visible Terminal runs `cd / && <reviewed canonical Claude executable> auth login --claudeai`; preserve a configured CLAUDE_CONFIG_DIR via literal safe quoting so the same profile is used. No setup-token/logout/console flags. Browser/terminal are user-owned once handed off; never capture terminal authentication stdout or kill/close that terminal. Other OS defaults to explicit manual command copy rather than pretending automatic support. No files under user credentials are read by Moro. Handle shell metacharacters/newlines in trusted paths/config safely and test quoting/rejection.

Allow an explicit trusted-startup `--auth-handoff-bin /reviewed/executable` override to exercise the launcher protocol with an offline fixture; never accept it from HTTP or auto-select a fixture. No new dependencies. Default is fixed native launcher. Report fixture handoff tests separately from a real OS authentication handoff (not authorized to execute during automated QA).

Serialize login dispatch atomically with all existing Jobs admissions using a short RAII auth reservation; reject if generation/cancellation cleanup is active and reject generation while dispatch is reserved. Do not hold Jobs mutex across a subprocess; get/cancel reads stay responsive. Release on all failures/shutdown. Keep a 30-second native cooldown against duplicate terminal launches; unknown handoff outcomes must not auto-retry. Bounded wrapper capture and process-group cleanup apply only to owned launcher processes, not the user terminal. Startup is not login, mounting a widget is not login.

## Shared frontend
Use apps/web/src/ai-auth/{client.ts,ClaudeConnection.tsx,auth.css} or a similarly scoped shared folder. Render when Claude is selected, below each provider selector; pass the existing generation-active state to disable authentication actions while it runs. Do not alter document/session/Undo or auto-send a brief. Read-only status refresh is explicit, not an inference call.

Login button -> disclosure/consent dialog -> explicit checkbox and confirm -> one POST -> terminal_requested notice -> user completes official browser/terminal -> explicit status refresh. Cancel/Escape/duplicate click/unmount must not launch or late-update another component. Use proper native browser fetch receiver and strict response validation; show safe Korean errors and command-copy/manual fallback `claude auth login --claudeai`. No URLs/tokens in localStorage/sessionStorage/cookies/IndexedDB. Clipboard copies only this fixed public command after explicit click.

Copy distinguishes CLI login information from real inference availability. Even signed_in can expire; keep a re-login option. Clearly disclose the Terminal/browser opens on the machine running the local bridge, may request macOS Automation approval, official CLI owns auth, no project/brief is transmitted by login, selected provider's account/quota applies.

## Verification / ownership
Backend worker owns bridge/src/{auth.rs,main.rs,lib.rs,jobs.rs}, new bridge/tests/auth* and support fixtures. Frontend worker owns new shared UI/client/CSS, four narrow call-site insertions, new tests/claude-auth* and e2e/claude-auth*; no backend/docs/global scripts. Parent owns contract, README/notices/distribution integration, guarded full tests/builds, actual native HTTP/UI fixture E2E, captures and delivery.

TDD: record a real missing-behavior RED first, then minimal GREEN per slice; missing imports are bootstrap evidence only. Use unchanged shared $HOME/.hermes/scripts/resource_guard.py for heavy tests/builds, no nested guards. Outer HOME unchanged; isolated QA HOME only in guarded child. Rust env: RUSTUP_HOME=$HOME/.local/share/moro-rust/rustup CARGO_HOME=$HOME/.local/share/moro-rust/cargo PATH prepend that cargo/bin. Never install/update tools or run a real auth login/model call during tests. Official browser account completion remains user action.

Required cases: signed-out/in/unknown/malformed/status timeout/private-field redaction; offline bridge/manual OS; zero-call canceled/malformed/cross-origin requests; no automatic mount login; one-confirm one launch; no private stderr/code/URL leakage; cooldown/concurrent login/generation shared admission; safe executable/config quoting; unchanged document+Undo across all auth outcomes; all four surfaces; mobile320/390 and desktop. Parent must exercise genuine native HTTP handlers with fixture CLI/launcher, not only intercepted browser responses. Real account login/inference stays explicitly unverified unless the user completes it.
