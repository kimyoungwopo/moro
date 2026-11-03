use moro_ai_bridge::provider;
use serde_json::{Value,json};
fn stream(value:Value)->Vec<u8>{format!("{}\n{}\n{}\n",json!({"type":"thread.started","thread_id":"guidance-fixture"}),json!({"type":"item.completed","item":{"type":"agent_message","text":value.to_string()}}),json!({"type":"turn.completed","usage":{}})).into_bytes()}
#[test]
fn guidance_schema_is_distinct_from_projects_and_keeps_protocol_guards(){
 let guide=json!({"rules":["Hold the settled state long enough to read."],"rationale":"The baseline has no quiet recognition hold."});
 assert_eq!(provider::parse_guidance_output_for_invocation("codex",&stream(guide.clone()),true).unwrap(),guide);
 let project=json!({"version":1,"name":"Not a guide","width":512,"height":512,"fps":60,"durationFrames":120,"layers":[]});
 assert!(provider::parse_guidance_output_for_invocation("codex",&stream(project),true).is_err());
 let mut unsafe_stream=String::from_utf8(stream(guide)).unwrap();unsafe_stream.insert_str(0,&format!("{}\n",json!({"type":"item.completed","item":{"type":"command_execution","command":"echo unsafe"}})));
 assert_eq!(provider::parse_guidance_output_for_invocation("codex",unsafe_stream.as_bytes(),true),Err("unsafe_output"));
}
#[test]
fn guidance_schema_reaches_both_real_fixture_subprocesses_without_losing_isolation(){
 use std::{path::Path,sync::atomic::AtomicBool,time::Duration};
 let exe=Path::new(env!("CARGO_BIN_EXE_fake-harness-cli-fixture"));let cancel=AtomicBool::new(false);
 for provider in ["codex","claude"]{
  let value=provider::generate_guidance(provider,exe,"Use evidence from the unchanged original task.",&cancel,Duration::from_secs(5)).unwrap();
  assert!(value["rules"].is_array());assert!(value.get("layers").is_none());
 }
}
