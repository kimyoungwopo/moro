# Moro local BYO-AI bridge

Rust synchronous loopback HTTP server with one asynchronous owned CLI job. macOS/Linux only (POSIX process groups/nonblocking pipes). No Node/Python production service; no auth management, API-key configuration, automatic apply, or remote exposure.

```sh
cargo test --manifest-path bridge/Cargo.toml --locked
cargo check --manifest-path bridge/Cargo.toml --locked
cargo build --manifest-path bridge/Cargo.toml --locked --bin moro-ai-bridge
bridge/target/debug/moro-ai-bridge --web-root /absolute/path/to/dist --port 4174
```

Use the existing approved resource guard/private Rust environment on the development workstation. Open `http://127.0.0.1:4174/create`. It also accepts the exact `localhost:4174` Host, but binds only IPv4 loopback. Never tunnel this service. The web root must contain `index.html`; normal hashed JS/CSS and `/create` are served from that canonical root, with no filesystem traversal or symlink escape.

`--codex-bin /absolute/reviewed/official/codex` and `--claude-bin /absolute/reviewed/official/claude` are **operator-only startup configuration**, never HTTP fields. Default paths resolve `codex`/`claude` once from the startup PATH. Review the installed executable; do not point production at test fixtures. Provider status means path installed only, not valid authentication or inference. Official CLI authentication stays with that CLI. Environment is cleared except HOME, PATH, TMPDIR, CODEX_HOME, CLAUDE_CONFIG_DIR and TLS certificate paths; API keys, base URLs, hook/plugin/agent environment flags are not inherited.

Jobs use empty private application-owned directories outside the repository and prompt stdin. Help is capability-checked before model invocation; unsupported flags/unknown events fail safely. Codex uses read-only sandbox, ignore-user-config/rules, ephemeral mode, schema JSONL and explicit tool/plugin/MCP/hook feature disabling. Claude uses empty tools/MCP/settings sources, disabled hooks/skills/Chrome, dontAsk and no persistence; it never uses `--bare` or automated login. Exact installed help was inspected for Codex0.153.4 and Claude2.1.105. Future CLI changes require review. The only Codex diagnostic exception is the exact contract-approved disabled code-mode-host startup message, once, with host explicitly disabled, no other errors/tool events, and valid structured output.

All model results pass independent strict Rust CreatorProject validation (including relational unique IDs, sorted unique frames and frame < duration); the schema alone cannot express these relational rules. Frontend must still run its core validator. Errors never return raw CLI output, prompts, environment or paths. Request JSON <=32KiB; prompt1–4000 trimmed Unicode scalar values; stdout2MiB; stderr64KiB; whole generation deadline180s including capability help. No prompt/output files are persisted; temporary schema and cwd are removed after each worker.

Cancellation marks the job cancelled immediately but retains the single-flight slot until process-group kill, root-child wait/reaping and workspace cleanup finish. No late success is possible. Terminal jobs max16. A retained worker JoinHandle is joined before replacement/shutdown. SIGTERM/SIGINT request shutdown, close new job creation, cancel work and join its cleanup; SIGKILL/crash cannot guarantee OS cleanup. Descendants that deliberately escape the owned process group are not a general OS sandbox guarantee; CLI tools must remain disabled.

`fake-cli-protocol-fixture` is a Rust test executable built for integration tests. It performs **no model inference** and must not be distributed as the production bridge. Tests use actual loopback sockets and owned local processes, including process-tree cancellation/timeouts/reaping; they do not prove official-provider authentication, model availability or UI acceptance. Parent integration owns bounded live inference and browser apply/undo/export acceptance.

Public limitations: no cross-origin/Vite proxy setup is assumed, no TLS/IPv6/remote deployment, no durable history, no authentication repair. tiny_http uses four bounded application request workers but no per-body socket deadline; a same-user local process can tie up workers by sending incomplete bodies (not a hardened public HTTP service). CLI-owned auth refresh may still occur inside official CLI behavior. Installed Claude authentication was independently reported by parent to fail inference with OAuth401; errors classify `needs_login`, not success. No worker retries/login are performed.
