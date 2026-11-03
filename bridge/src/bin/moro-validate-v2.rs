//! Read-only, local-only strict v2 validation; deliberately no provider integration.
use moro_ai_bridge::creator_v2::{MAX_PROJECT_BYTES, ValidationError, parse_project_v2};
use serde_json::json;
use std::io::Read;
use std::os::unix::fs::OpenOptionsExt;

fn run() -> Result<(), ValidationError> {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.len() != 2 || args[0] != "--input" || args[1].is_empty() || args[1] == "-" {
        return Err("usage_expected_input_file");
    }
    // O_NONBLOCK prevents FIFO/device opens from blocking before is_file rejects
    // them. O_NOFOLLOW rejects a symlink leaf. Metadata belongs to the exact open
    // descriptor (no stat/open race), and Take bounds concurrent growth as well.
    let file = std::fs::OpenOptions::new().read(true)
        .custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK)
        .open(&args[1]).map_err(|_| "input_open_failed")?;
    let meta = file.metadata().map_err(|_| "input_metadata_failed")?;
    if !meta.is_file() { return Err("input_not_regular_file"); }
    if meta.len() > MAX_PROJECT_BYTES as u64 { return Err("project_too_large"); }
    let mut bytes = Vec::new();
    file.take((MAX_PROJECT_BYTES + 1) as u64).read_to_end(&mut bytes).map_err(|_| "input_read_failed")?;
    parse_project_v2(&bytes)?;
    Ok(())
}
fn main() -> std::process::ExitCode {
    let result = run();
    println!("{}", json!({"valid":result.is_ok(),"version":2,"localOnly":true,"error":result.err()}));
    if result.is_ok() { std::process::ExitCode::SUCCESS } else { std::process::ExitCode::from(1) }
}
