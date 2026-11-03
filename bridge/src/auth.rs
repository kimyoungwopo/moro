//! Official Claude CLI authentication metadata, never credentials or inference.
use std::{path::Path, sync::atomic::AtomicBool, time::{Duration, Instant}};
use serde_json::{json, Value};

pub fn consent(bytes: &[u8]) -> Result<(), &'static str> {
    let value = crate::creator_v2::parse_json_strict(bytes).map_err(|_| "invalid_request")?;
    let object = value.as_object().ok_or("invalid_request")?;
    if object.keys().any(|key| key != "consent") { return Err("invalid_request"); }
    match object.get("consent") {
        Some(Value::Bool(true)) => Ok(()),
        None | Some(Value::Bool(false)) => Err("consent_required"),
        _ => Err("invalid_request"),
    }
}

/// Static AppleScript. The command is data in argv, never AppleScript source.
pub const TERMINAL_SCRIPT: &str = "on run argv\n  tell application \"Terminal\"\n    activate\n    do script (item 1 of argv)\n  end tell\nend run";

fn literal(value: &std::ffi::OsStr) -> Result<String, &'static str> {
    let value = value.to_str().filter(|s| !s.chars().any(char::is_control)).ok_or("manual_login_required")?;
    Ok(format!("'{}'", value.replace('\'', "'\\''")))
}
fn terminal_command(exe: &Path) -> Result<String, &'static str> {
    let mut env = String::new();
    let mut unset = String::new();
    for key in ["HOME", "CLAUDE_CONFIG_DIR"] {
        if let Some(value) = std::env::var_os(key) { env.push_str(&format!("{key}={} ", literal(&value)?)); }
        else { unset.push_str(&format!("unset {key} && ")); }
    }
    Ok(format!("cd / && {unset}{env}{} auth login --claudeai", literal(exe.as_os_str())?))
}

/// Trusted startup override only; no request value can select an executable.
pub fn login(exe: Option<&Path>, launcher: Option<&Path>, jobs: &std::sync::Arc<crate::jobs::Jobs>) -> Result<Value, (u16, &'static str)> {
    let exe = exe.ok_or((503, "provider_unavailable"))?;
    let launcher = launcher.or_else(|| if cfg!(target_os="macos") { Some(Path::new("/usr/bin/osascript")) } else { None }).ok_or((501, "manual_login_required"))?;
    let command = terminal_command(exe).map_err(|e| (501, e))?;
    let reservation = jobs.reserve_auth().map_err(|e| (409, e))?;
    let ws = crate::provider::Workspace::new().map_err(|_| (502, "terminal_handoff_failed"))?;
    let cwd = ws.0.join("work");
    let help = ["auth", "login", "--help"].map(String::from);
    let (ok, out, _) = crate::provider::capture(exe, &help, &cwd, b"", &jobs.auth_cancel, Duration::from_secs(5)).map_err(|_| (503, "provider_unavailable"))?;
    if !ok || !String::from_utf8_lossy(&out).contains("--claudeai") { return Err((501, "manual_login_required")); }
    reservation.launching().map_err(|e| (409, e))?;
    let args = ["-e".to_string(), TERMINAL_SCRIPT.to_string(), "--".to_string(), command];
    match crate::provider::capture(launcher, &args, &cwd, b"", &jobs.auth_cancel, Duration::from_secs(5)) {
        Ok((true, _, _)) => Ok(json!({"ok":true,"provider":"claude","handoff":"terminal_requested","authenticationVerified":false})),
        Ok((false, _, _)) => Err((502, "terminal_handoff_failed")),
        Err("timeout" | "output_limit" | "cancelled") => Err((504, "terminal_handoff_unconfirmed")),
        Err(_) => Err((502, "terminal_handoff_failed")),
    }
}

pub fn status(exe: Option<&Path>, cancel: &AtomicBool, timeout: Duration) -> Value {
    let state = match exe {
        None => "not_installed",
        Some(exe) => probe(exe, cancel, timeout),
    };
    json!({"ok":true,"provider":"claude","installed":exe.is_some(),"state":state,
        "loginMethod":if cfg!(target_os="macos") {"terminal"} else {"manual"},
        "scope":"cli-reported","inferenceVerified":false})
}
fn probe(exe: &Path, cancel: &AtomicBool, timeout: Duration) -> &'static str {
    let Ok(ws) = crate::provider::Workspace::new() else { return "unknown"; };
    let cwd = ws.0.join("work");
    let started = Instant::now();
    let help = ["auth", "status", "--help"].map(String::from);
    let Ok((ok, out, _)) = crate::provider::capture(exe, &help, &cwd, b"", cancel, timeout) else { return "unknown"; };
    if !ok || !String::from_utf8_lossy(&out).contains("--json") { return "cli_update_required"; }
    let Some(left) = timeout.checked_sub(started.elapsed()) else { return "unknown"; };
    let args = ["auth", "status", "--json"].map(String::from);
    let Ok((ok, out, _)) = crate::provider::capture(exe, &args, &cwd, b"", cancel, left) else { return "unknown"; };
    if !std::fs::read_dir(&cwd).is_ok_and(|mut entries| entries.next().is_none()) { return "unknown"; }
    let Ok(v) = crate::creator_v2::parse_json_strict(&out) else { return "unknown"; };
    if v.get("is_error").is_some_and(|e| e != false) { return "unknown"; }
    if v["loggedIn"] == true && v.get("authMethod").is_some_and(|m| !m.as_str().is_some_and(|s| !s.is_empty() && s != "none")) { return "unknown"; }
    match v.get("loggedIn").and_then(Value::as_bool) {
        Some(true) if ok => "signed_in",
        Some(false) => "signed_out",
        _ => "unknown",
    }
}
