use std::{io::{Read, Write}, net::{TcpListener, TcpStream}, os::unix::fs::PermissionsExt, path::PathBuf, process::{Child, Command}, time::{Duration, Instant}};
use serde_json::{json, Value};
const STATUS: &str = "/api/ai/auth/claude/status";
const LOGIN: &str = "/api/ai/auth/claude/login";
const MUTATE: &str = "Content-Type: application/json\r\nX-Moro-Request: 1\r\n";
struct Server { child: Child, port: u16, root: PathBuf }
impl Drop for Server { fn drop(&mut self) { unsafe { libc::kill(self.child.id() as i32, libc::SIGTERM); } let _ = self.child.wait(); let _ = std::fs::remove_dir_all(&self.root); } }
impl Server {
    fn start(cli: &str, launcher: Option<&str>, installed: bool) -> Self { Self::start_context(cli, launcher, installed, None) }
    fn start_context(cli: &str, launcher: Option<&str>, installed: bool, config: Option<&str>) -> Self {
        let port = TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
        let root = std::env::temp_dir().join(format!("moro-auth-http-{}-{port}", std::process::id()));
        std::fs::create_dir(&root).unwrap();
        std::fs::write(root.join("index.html"), "Offline auth fixture").unwrap();
        for (name, script) in [("claude 'fixture;$", cli), ("launcher", launcher.unwrap_or("exit 97"))] {
            let p = root.join(name);
            std::fs::write(&p, format!("#!/bin/sh\n{script}\n")).unwrap();
            std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o700)).unwrap();
        }
        let exe = root.join(if installed { "claude 'fixture;$" } else { "not-installed" });
        let mut command = Command::new(env!("CARGO_BIN_EXE_moro-ai-bridge"));
        command.args(["--web-root", root.to_str().unwrap(), "--port", &port.to_string(), "--codex-bin", env!("CARGO_BIN_EXE_fake-cli-protocol-fixture"), "--claude-bin", exe.to_str().unwrap()]);
        if launcher.is_some() { command.arg("--auth-handoff-bin").arg(root.join("launcher")); }
        let config = config.map(PathBuf::from).unwrap_or_else(|| root.join("profile ' ;$(x)"));
        if config.as_os_str().is_empty() { command.env_remove("CLAUDE_CONFIG_DIR"); } else { command.env("CLAUDE_CONFIG_DIR", config); }
        let child = command.env("HOME", &root).env("USER", "offline-fixture-user").env("ANTHROPIC_API_KEY", "OFFLINE_MUST_NOT_REACH_CLI").env("CLAUDE_CODE_OAUTH_TOKEN", "OFFLINE_MUST_NOT_REACH_CLI").env("TMPDIR", &root).env("PATH", "").env_remove("CODEX_HOME").spawn().unwrap();
        let mut s = Self { child, port, root };
        let until = Instant::now() + Duration::from_secs(3);
        while TcpStream::connect(("127.0.0.1", port)).is_err() {
            assert!(s.child.try_wait().unwrap().is_none(), "bridge exited before listening");
            assert!(Instant::now() < until); std::thread::sleep(Duration::from_millis(10));
        }
        s
    }
    fn request(&self, method: &str, path: &str, headers: &str, body: &str) -> (u16, Value) { request(self.port, method, path, headers, body) }
    fn calls(&self, file: &str) -> String { std::fs::read_to_string(self.root.join(file)).unwrap_or_default() }
}
fn request(port: u16, method: &str, path: &str, headers: &str, body: &str) -> (u16, Value) {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
    stream.set_read_timeout(Some(Duration::from_secs(8))).unwrap();
    write!(stream, "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\nContent-Length: {}\r\n{headers}\r\n{body}", body.len()).unwrap();
    let mut out = String::new(); stream.read_to_string(&mut out).unwrap();
    (out.split_whitespace().nth(1).unwrap().parse().unwrap(), serde_json::from_str(out.split_once("\r\n\r\n").unwrap().1).unwrap())
}
#[test]
fn external_top_level_entry_navigation_works_without_opening_cross_site_api() {
    let s = Server::start(SIGNED_IN, None, true);
    let raw = |method: &str, path: &str, headers: &str| {
        let mut stream = TcpStream::connect(("127.0.0.1", s.port)).unwrap();
        stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        write!(stream, "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\nContent-Length: 0\r\n{headers}\r\n", s.port).unwrap();
        let mut text = String::new(); stream.read_to_string(&mut text).unwrap();
        (text.split_whitespace().nth(1).unwrap().parse::<u16>().unwrap(), text)
    };
    let nav = "Sec-Fetch-Site: cross-site\r\nSec-Fetch-Mode: navigate\r\nSec-Fetch-Dest: document\r\n";
    for path in ["/", "/create", "/create/", "/rig", "/rig/", "/studio", "/studio/", "/studio?from=external"] {
        let (code, text) = raw("GET", path, nav);
        assert_eq!(code, 200, "external document navigation must open {path}");
        assert!(text.contains("Offline auth fixture"));
    }
    assert_eq!(raw("HEAD", "/studio", nav).0, 200);
    for path in [STATUS, LOGIN, "/api/ai/status", "/api/ai/jobs", "/not-an-entry", "/assets/private.js"] {
        assert_eq!(raw("GET", path, nav).0, 403, "cross-site access remains blocked: {path}");
    }
    for headers in [
        "Sec-Fetch-Site: cross-site\r\nSec-Fetch-Mode: cors\r\nSec-Fetch-Dest: document\r\n",
        "Sec-Fetch-Site: cross-site\r\nSec-Fetch-Mode: navigate\r\nSec-Fetch-Dest: iframe\r\n",
        "Sec-Fetch-Site: cross-site\r\n",
    ] { assert_eq!(raw("GET", "/studio", headers).0, 403); }
    assert_eq!(raw("GET", "/studio", &format!("{nav}Origin: https://other.invalid\r\n")).0, 403);
    assert_eq!(raw("GET", "/studio", &format!("{nav}Host: other.invalid\r\n")).0, 403);
    assert_eq!(raw("POST", "/studio", nav).0, 403);
    assert_eq!(s.calls("cli-calls"), "", "entry navigation must not probe CLI or authenticate");
    assert_eq!(s.calls("launcher-calls"), "");
}

#[test]
fn claude_keychain_status_keeps_os_user_identity_without_forwarding_credentials() {
    let cli = r#"
if test -n "$ANTHROPIC_API_KEY" || test -n "$CLAUDE_CODE_OAUTH_TOKEN"; then exit 96; fi
if test "$3" = --help; then printf '%s' '--json --claudeai'; exit 0; fi
if test "$USER" = offline-fixture-user; then
 printf '%s' '{"loggedIn":true,"authMethod":"claude.ai"}'
else
 printf '%s' '{"loggedIn":false,"authMethod":"none"}'; exit 1
fi
"#;
    let s = Server::start(cli, None, true);
    let (code, value) = s.request("GET", STATUS, "", "");
    assert_eq!(code, 200);
    assert_eq!(value["state"], "signed_in", "preserve non-secret USER for the official CLI keychain lookup, but not credential environment variables");
    assert_eq!(value["inferenceVerified"], false);
    assert!(!value.to_string().contains("offline-fixture-user"));
    assert!(!value.to_string().contains("OFFLINE_MUST_NOT_REACH_CLI"));
}

const SIGNED_IN: &str = r#"printf '%s\n' "$*" >> "$HOME/cli-calls"
if test "$3" = --help; then printf '%s' '--json --claudeai'; exit 0; fi
printf '%s' '{"loggedIn":true,"authMethod":"claude.ai","email":"PRIVATE_EMAIL","orgId":"PRIVATE_ORG","url":"https://private.invalid/code"}'
printf 'PRIVATE_STDERR' >&2
"#;
#[test]
fn status_reports_only_cli_claim_without_private_fields() {
    let s = Server::start(SIGNED_IN, None, true);
    assert_eq!(s.calls("cli-calls"), "", "startup is not an auth probe");
    let (code, v) = s.request("GET", STATUS, "", "");
    assert_eq!(code, 200);
    assert_eq!(v, json!({"ok":true,"provider":"claude","installed":true,"state":"signed_in","loginMethod":if cfg!(target_os="macos") {"terminal"} else {"manual"},"scope":"cli-reported","inferenceVerified":false}));
    assert_eq!(s.calls("cli-calls"), "auth status --help\nauth status --json\n");
    assert!(!s.root.join("launcher-calls").exists());
}
#[test]
fn consented_handoff_requests_one_reviewed_terminal_command_and_cooldown() {
    let launcher = r#"printf 'launch\n' >> "$HOME/launcher-calls"
printf '%s\n' "$@" > "$HOME/launcher-args"
"#;
    let s = Server::start(SIGNED_IN, Some(launcher), true);
    assert_eq!(s.calls("cli-calls"), ""); assert_eq!(s.calls("launcher-calls"), "");
    let (code, v) = s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#);
    assert_eq!(code, 202, "{v}");
    assert_eq!(v, json!({"ok":true,"provider":"claude","handoff":"terminal_requested","authenticationVerified":false}));
    assert_eq!(s.calls("launcher-calls"), "launch\n");
    let args = s.calls("launcher-args");
    assert!(args.starts_with("-e\non run argv\n"), "{args}");
    assert!(args.contains("do script (item 1 of argv)"));
    let quote = |s: &str| format!("'{}'", s.replace('\'', "'\\''"));
    let expected = format!("cd / && HOME={} CLAUDE_CONFIG_DIR={} {} auth login --claudeai", quote(s.root.to_str().unwrap()), quote(s.root.join("profile ' ;$(x)").to_str().unwrap()), quote(s.root.join("claude 'fixture;$").canonicalize().unwrap().to_str().unwrap()));
    assert!(args.ends_with(&format!("--\n{expected}\n")), "{args}");
    assert_eq!(s.calls("cli-calls"), "auth login --help\n", "backend must not run or capture actual login");
    let (code, v) = s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#);
    assert_eq!(code, 409); assert_eq!(v["error"]["code"], "auth_handoff_pending");
    assert_eq!(s.calls("launcher-calls"), "launch\n");
}
#[test]
fn login_invalid_requests_are_zero_process_even_before_provider_availability() {
    for installed in [true, false] {
        let s = Server::start(SIGNED_IN, Some("printf launch > \"$HOME/launcher-calls\""), installed);
        for (body, expected) in [("[true]", "invalid_request"), ("[]", "invalid_request"), (r#"{"consent":null}"#, "invalid_request"), (r#"{"consent":true,"cons\u0065nt":true}"#, "invalid_request"), (r#"{"consent":true,"command":"evil"}"#, "invalid_request"), (r#"{"consent":true,"authHandoffBin":"evil"}"#, "invalid_request"), ("{}", "consent_required"), (r#"{"consent":false}"#, "consent_required"), (r#"{"consent":true,"consent":true}"#, "invalid_request"), (r#"{"consent":"true"}"#, "invalid_request"), (r#"{"consent":true,"url":"https://private.invalid"}"#, "invalid_request"), (r#"{"provider":"claude","consent":true}"#, "invalid_request"), ("null", "invalid_request"), ("{", "invalid_request")] {
            let (code, v) = s.request("POST", LOGIN, MUTATE, body);
            assert_eq!(code, 400, "{body}: {v}"); assert_eq!(v["error"]["code"], expected);
        }
        for headers in ["Content-Type: application/json\r\n", "X-Moro-Request: 1\r\n", "Content-Type: text/plain\r\nX-Moro-Request: 1\r\n", "Content-Type: application/json\r\nX-Moro-Request: 1\r\nOrigin: https://evil.invalid\r\n", "Content-Type: application/json\r\nX-Moro-Request: 1\r\nX-Moro-Request: 1\r\n"] {
            assert_eq!(s.request("POST", LOGIN, headers, r#"{"consent":true}"#).0, 403);
        }
        assert_eq!(s.request("GET", LOGIN, "", "").0, 404);
        assert_eq!(s.calls("cli-calls"), "");
        assert_eq!(s.calls("launcher-calls"), "");
    }
}
#[test]
fn native_cooldown_expires_after_thirty_seconds_without_blocking_jobs() {
    let s = Server::start(SIGNED_IN, Some("printf 'launch\\n' >> \"$HOME/launcher-calls\""), true);
    assert_eq!(s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#).0, 202);
    assert_eq!(s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#).0, 409);
    assert_eq!(s.calls("launcher-calls"), "launch\n");
    std::thread::sleep(Duration::from_secs(31));
    assert_eq!(s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#).0, 202);
    assert_eq!(s.calls("launcher-calls"), "launch\nlaunch\n");
}
#[test]
fn shutdown_cancels_owned_auth_processes_even_when_http_workers_are_saturated() {
    let cli = r#"if test "$3" = --help; then printf '%s' --json; exit 0; fi
printf '%s\n' "$$" >> "$HOME/status-pids"
exec /bin/sleep 20"#;
    let mut s = Server::start(cli, None, true);
    let readers: Vec<_> = (0..4).map(|_| { let port = s.port; std::thread::spawn(move || request(port, "GET", STATUS, "", "")) }).collect();
    let end = Instant::now() + Duration::from_secs(3);
    while s.calls("status-pids").lines().count() < 4 { assert!(Instant::now() < end); std::thread::sleep(Duration::from_millis(10)); }
    unsafe { libc::kill(s.child.id() as i32, libc::SIGTERM); }
    let end = Instant::now() + Duration::from_secs(2);
    while s.child.try_wait().unwrap().is_none() { assert!(Instant::now() < end, "shutdown must cancel, not wait for auth timeout"); std::thread::sleep(Duration::from_millis(10)); }
    for reader in readers { assert_eq!(reader.join().unwrap().1["state"], "unknown"); }
    for pid in s.calls("status-pids").lines() { assert_ne!(unsafe { libc::kill(pid.parse().unwrap(), 0) }, 0); }
}
#[test]
fn absent_profile_does_not_borrow_a_user_terminal_profile() {
    let cli = r#"if test "$3" = --help; then printf '%s' --claudeai; exit 0; fi
printf '%s' "${CLAUDE_CONFIG_DIR-ABSENT}" > "$HOME/profile-seen"
"#;
    let launcher = r#"CLAUDE_CONFIG_DIR=WRONG_TERMINAL_PROFILE; export CLAUDE_CONFIG_DIR
exec /bin/sh -c "$4""#;
    let s = Server::start_context(cli, Some(launcher), true, Some(""));
    assert_eq!(s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#).0, 202);
    assert_eq!(s.calls("profile-seen"), "ABSENT");
}
#[test]
fn control_characters_in_trusted_config_fail_before_any_process() {
    let s = Server::start_context(SIGNED_IN, Some("exit 97"), true, Some("/fixture/profile\nunsafe"));
    let (code, v) = s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#);
    assert_eq!(code, 501); assert_eq!(v["error"]["code"], "manual_login_required");
    assert_eq!(s.calls("cli-calls"), "");
}
#[test]
fn launcher_fixture_roundtrips_shell_literals_without_executing_host_commands() {
    let cli = r#"if test "$3" = --help; then printf '%s' --claudeai; exit 0; fi
printf '%s\n' "$CLAUDE_CONFIG_DIR" "$PWD" "$@" > "$HOME/roundtrip"
"#;
    let s = Server::start(cli, Some(r#"exec /bin/sh -c "$4""#), true);
    assert_eq!(s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#).0, 202);
    assert_eq!(s.calls("roundtrip"), format!("{}\n/\nauth\nlogin\n--claudeai\n", s.root.join("profile ' ;$(x)").display()));
}
#[test]
fn auth_dispatch_blocks_all_generation_admissions_but_not_reads_or_cancel() {
    let s = Server::start(SIGNED_IN, Some(r#"printf '%s' "$$" > "$HOME/launcher-pid"
/bin/sleep 1
printf done > "$HOME/launched""#), true);
    let port = s.port;
    let login = std::thread::spawn(move || request(port, "POST", LOGIN, MUTATE, r#"{"consent":true}"#));
    wait_file(&s, "launcher-pid");
    let (code, v) = s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#);
    assert_eq!(code, 409); assert_eq!(v["error"]["code"], "auth_handoff_pending");
    for (path, body) in [
        ("/api/ai/jobs", json!({"provider":"codex","prompt":"fixture:slow"})),
        ("/api/ai/v2/jobs", json!({"provider":"codex","prompt":"x","consent":true})),
        ("/api/ai/director/jobs", json!({"provider":"codex","prompt":"x","consent":true,"stage":"style","approved":null,"contextConsent":false})),
        ("/api/ai/harness/jobs", json!({"provider":"codex","brief":"x","domain":"ui-motion","consent":true,"callBudget":7})),
    ] {
        let (code, v) = s.request("POST", path, MUTATE, &body.to_string());
        assert_eq!(code, 409, "{path}: {v}"); assert_eq!(v["error"]["code"], "busy");
    }
    let start = Instant::now();
    assert_eq!(s.request("GET", "/api/ai/jobs/absent", "", "").0, 404);
    assert_eq!(s.request("POST", "/api/ai/jobs/absent/cancel", MUTATE, "{}").0, 404);
    assert!(start.elapsed() < Duration::from_millis(700));
    assert!(!s.root.join("launched").exists(), "reads completed during launcher pause");
    assert_eq!(login.join().unwrap().0, 202);
    let (code, v) = s.request("POST", "/api/ai/jobs", MUTATE, r#"{"provider":"codex","prompt":"fixture:slow"}"#);
    assert_eq!(code, 202, "reservation released; cooldown does not block generation");
    let id = v["job"]["id"].as_str().unwrap();
    assert_eq!(s.request("POST", &format!("/api/ai/jobs/{id}/cancel"), MUTATE, "{}").0, 200);
}
#[test]
fn active_generation_rejects_auth_before_any_auth_subprocess_and_releases_after_cancel() {
    let s = Server::start(SIGNED_IN, Some("printf 'launch\\n' >> \"$HOME/launcher-calls\""), true);
    let (code, v) = s.request("POST", "/api/ai/jobs", MUTATE, r#"{"provider":"codex","prompt":"fixture:slow"}"#);
    assert_eq!(code, 202); let id = v["job"]["id"].as_str().unwrap();
    let (code, v) = s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#);
    assert_eq!(code, 409); assert_eq!(v["error"]["code"], "busy"); assert_eq!(s.calls("cli-calls"), ""); assert_eq!(s.calls("launcher-calls"), "");
    assert_eq!(s.request("POST", &format!("/api/ai/jobs/{id}/cancel"), MUTATE, "{}").0, 200);
    // Allow owned generation cleanup, not an auth retry after an unknown outcome.
    std::thread::sleep(Duration::from_millis(200));
    assert_eq!(s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#).0, 202);
}
#[test]
fn handoff_failures_are_redacted_and_unknown_outcomes_are_not_retried() {
    for (launcher, code, error) in [
        ("printf 'PRIVATE_CODE https://private.invalid' >&2; exit 1", 502, "terminal_handoff_failed"),
        ("printf '%s' \"$$\" > \"$HOME/launcher-pid\"; exec /bin/sleep 20", 504, "terminal_handoff_unconfirmed"),
    ] {
        let s = Server::start(SIGNED_IN, Some(launcher), true);
        let (actual, v) = s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#);
        assert_eq!(actual, code); assert_eq!(v["error"]["code"], error);
        let text = v.to_string(); assert!(!text.contains("PRIVATE")); assert!(!text.contains("https:")); assert!(!text.contains(s.root.to_str().unwrap()));
        assert_eq!(s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#).1["error"]["code"], "auth_handoff_pending");
        if code == 504 {
            let pid: i32 = s.calls("launcher-pid").parse().unwrap();
            assert_ne!(unsafe { libc::kill(pid, 0) }, 0, "owned wrapper reaped on timeout");
        }
        let (code, _) = s.request("POST", "/api/ai/jobs", MUTATE, r#"{"provider":"codex","prompt":"fixture:slow"}"#);
        assert_eq!(code, 202, "failed dispatch released generation admission");
    }
    let s = Server::start(SIGNED_IN, Some("exit 97"), false);
    assert_eq!(s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#).1["error"]["code"], "provider_unavailable");
    let s = Server::start("printf old-cli", Some("exit 97"), true);
    let (code, v) = s.request("POST", LOGIN, MUTATE, r#"{"consent":true}"#);
    assert_eq!(code, 501); assert_eq!(v["error"]["code"], "manual_login_required");
}
#[test]
fn status_timeout_and_oversize_are_unknown_with_owned_child_cleanup() {
    for script in [
        "printf '%s' \"$$\" > \"$HOME/status-pid\"; exec /bin/sleep 20",
        "i=0; while test $i -lt 3000; do printf '%01000d' 0; i=$((i+1)); done",
    ] {
        let cli = format!("if test \"$3\" = --help; then printf '%s' --json; exit 0; fi\n{script}");
        let s = Server::start(&cli, None, true);
        let (code, v) = s.request("GET", STATUS, "", "");
        assert_eq!(code, 200); assert_eq!(v["state"], "unknown"); assert_eq!(v["inferenceVerified"], false);
        if let Ok(pid) = s.calls("status-pid").parse::<i32>() { assert_ne!(unsafe { libc::kill(pid, 0) }, 0); }
    }
}
fn wait_file(s: &Server, name: &str) {
    let end = Instant::now() + Duration::from_secs(3);
    while !s.root.join(name).exists() { assert!(Instant::now() < end, "missing {name}"); std::thread::sleep(Duration::from_millis(10)); }
}
#[test]
fn status_rejects_workspace_side_effects_and_conflicting_error_metadata() {
    for cli in [
        "if test \"$3\" = --help; then printf '%s' --json; exit 0; fi\nprintf unsafe > unexpected\nprintf '%s' '{\"loggedIn\":true}'",
        "if test \"$3\" = --help; then printf '%s' --json; exit 0; fi\nprintf '%s' '{\"loggedIn\":true,\"is_error\":true}'",
        "if test \"$3\" = --help; then printf '%s' --json; exit 0; fi\nprintf '%s' '{\"loggedIn\":true,\"authMethod\":\"none\"}'",
    ] {
        let s = Server::start(cli, None, true);
        assert_eq!(s.request("GET", STATUS, "", "").1["state"], "unknown");
    }
}
#[test]
fn status_rejects_conflicts_duplicates_malformed_and_missing_cli() {
    for (output, exit, expected) in [
        (r#"{"loggedIn":false}"#, 1, "signed_out"),
        (r#"{"loggedIn":true}"#, 1, "unknown"),
        (r#"{"loggedIn":false,"loggedIn":true}"#, 0, "unknown"),
        (r#"{"loggedIn":true,"authMethod":null}"#, 0, "unknown"),
        (r#"{"loggedIn":"true"}"#, 0, "unknown"),
        (r#"{"loggedIn":true} junk"#, 0, "unknown"),
        (r#"{"email":"PRIVATE"}"#, 0, "unknown"),
    ] {
        let cli = format!("if test \"$3\" = --help; then printf '%s' --json; exit 0; fi\nprintf '%s' '{output}'\nexit {exit}");
        let s = Server::start(&cli, None, true);
        let (code, v) = s.request("GET", STATUS, "", "");
        assert_eq!(code, 200); assert_eq!(v["state"], expected, "{output}");
        assert_eq!(v["inferenceVerified"], false);
    }
    let s = Server::start("exit 99", None, false);
    let (code, v) = s.request("GET", STATUS, "", "");
    assert_eq!(code, 200); assert_eq!(v["installed"], false); assert_eq!(v["state"], "not_installed");
    let s = Server::start("printf old-cli", None, true);
    assert_eq!(s.request("GET", STATUS, "", "").1["state"], "cli_update_required");
}
