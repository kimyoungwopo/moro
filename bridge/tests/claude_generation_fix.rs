use moro_ai_bridge::{provider,provider_v2,provider_director};
use serde_json::{Value,json};
use std::path::Path;
use std::{sync::atomic::{AtomicBool,AtomicU64,Ordering},time::Duration,os::unix::fs::PermissionsExt};
static SEQ:AtomicU64=AtomicU64::new(0);
struct Fixture(std::path::PathBuf);
impl Fixture{
 fn new(body:&str)->Self{let p=std::env::temp_dir().join(format!("moro-claude-fix-{}-{}",std::process::id(),SEQ.fetch_add(1,Ordering::SeqCst)));std::fs::create_dir(&p).unwrap();std::fs::write(p.join("fixture"),format!("#!/bin/sh\n{body}\n")).unwrap();std::fs::set_permissions(p.join("fixture"),std::fs::Permissions::from_mode(0o700)).unwrap();Self(p)}
 fn capture(&self,timeout:Duration)->Result<(bool,Vec<u8>,Vec<u8>),&'static str>{provider::capture(&self.0.join("fixture"),&["--output-format".into(),"stream-json".into()],&self.0,b"",&AtomicBool::new(false),timeout)}
}
impl Drop for Fixture{fn drop(&mut self){let _=std::fs::remove_dir_all(&self.0);}}
fn emit(v:Value)->String{format!("printf '%s\\n' '{}'\n",v.to_string().replace('\'',"'\\''"))}
fn init()->Value{json!({"type":"system","subtype":"init","tools":["StructuredOutput"],"mcp_servers":[],"permissionMode":"dontAsk","session_id":"PRIVATE_ACCOUNT_CANARY"})}
fn project()->Value{json!({"version":1,"name":"Test","width":512,"height":512,"fps":60,"durationFrames":120,"layers":[]})}
fn protocol(events:Vec<Value>)->Result<Vec<u8>,&'static str>{let mut s=moro_ai_bridge::claude_protocol::Stream::default();for v in events{s.push(format!("{v}\n").as_bytes())?;}s.finish()}
#[test]
fn protocol_errors_latch_and_unknown_message_delta_is_blocked(){
 let mut s=moro_ai_bridge::claude_protocol::Stream::default();s.push(format!("{}\n{}\n",init(),result()).as_bytes()).unwrap();
 assert_eq!(s.push(b"{\"type\":\"unknown\"}\n"),Err("unsafe_output"));
 assert_eq!(s.finish().unwrap_err(),"unsafe_output");
 assert_eq!(protocol(vec![init(),json!({"type":"stream_event","event":{"type":"message_delta","delta":{"type":"unknown_tool"}}}),result()]).unwrap_err(),"unsafe_output");
}
#[test]
fn chunked_utf8_json_is_preserved_and_each_output_budget_is_enforced(){
 use moro_ai_bridge::claude_protocol::{Stream,MAX_LINE,MAX_STREAM};
 let mut r=result();r["structured_output"]["name"]=json!("한글 data");let bytes=format!("{}\n{}",init(),r).into_bytes();
 for size in [1,7,8192]{let mut s=Stream::default();for chunk in bytes.chunks(size){s.push(chunk).unwrap();}let out=s.finish().unwrap();assert_eq!(provider::parse_output("claude",&out).unwrap()["name"],"한글 data");}
 let mut s=Stream::default();assert_eq!(s.push(&vec![b'x';MAX_LINE+1]),Err("output_limit"));
 let event=json!({"type":"rate_limit_event","rate_limit_info":{"status":"allowed","metadata":"x".repeat(8192)}}).to_string()+"\n";
 let mut s=Stream::default();s.push(format!("{}\n",init()).as_bytes()).unwrap();let mut failed=false;for _ in 0..MAX_STREAM/event.len()+1{if let Err(e)=s.push(event.as_bytes()){assert_eq!(e,"output_limit");failed=true;break;}}assert!(failed);
 let mut r=result();r["structured_output"]["name"]=json!("x".repeat(moro_ai_bridge::MAX_STDOUT));assert_eq!(protocol(vec![init(),r]).unwrap_err(),"output_limit");
 assert_eq!(protocol(vec![init(),result(),result()]).unwrap_err(),"unsafe_output");
 let mut s=Stream::default();s.push(format!("{}\n{{\"type\":\"result\",\"type\":\"result\"}}\n",init()).as_bytes()).unwrap_err();
}
#[test]
fn schema_translation_preserves_constraints_and_does_not_rewrite_instance_data(){
 let source=json!({"$schema":"https://json-schema.org/draft/2020-12/schema","$defs":{"pair":{"type":"array","prefixItems":[{"type":"number","minimum":-4},{"type":"number","maximum":4}],"items":false,"minItems":2,"maxItems":2}},"type":"object","properties":{"pair":{"$ref":"#/$defs/pair"},"$defs":{"const":{"$defs":"literal","$ref":"#/$defs/literal","prefixItems":[1,2]}}},"required":["pair"],"additionalProperties":false});
 let projected:Value=serde_json::from_str(&moro_ai_bridge::claude_protocol::schema(&source.to_string())).unwrap();
 assert_eq!(projected["definitions"]["pair"],json!({"type":"array","items":[{"type":"number","minimum":-4},{"type":"number","maximum":4}],"additionalItems":false,"minItems":2,"maxItems":2}));
 assert_eq!(projected["properties"]["pair"]["$ref"],"#/definitions/pair");assert_eq!(projected["properties"]["$defs"],source["properties"]["$defs"]);
 fn restore(v:&mut Value){match v{Value::Object(o)=>{o.remove("$schema");if let Some(d)=o.remove("definitions"){o.insert("$defs".into(),d);}if let Some(Value::String(r))=o.get_mut("$ref"){*r=r.replace("/definitions/","/$defs/");}if o.get("items").is_some_and(Value::is_array){let p=o.remove("items").unwrap();let tail=o.remove("additionalItems").unwrap();o.insert("prefixItems".into(),p);o.insert("items".into(),tail);}for c in o.values_mut(){restore(c);}},Value::Array(a)=>for c in a{restore(c);},_=>()}}
 for source in [provider::SCHEMA.to_string(),provider_v2::schema(),provider_director::schema()]{let mut original:Value=serde_json::from_str(&source).unwrap();let mut translated:Value=serde_json::from_str(&moro_ai_bridge::claude_protocol::schema(&source)).unwrap();restore(&mut original);restore(&mut translated);assert_eq!(translated,original);}
 let mut invalid=result();invalid["structured_output"]["width"]=json!(1);let out=protocol(vec![init(),invalid]).unwrap();assert_eq!(provider::parse_output("claude",&out).unwrap_err(),"invalid_project");
}
#[test]
fn protocol_rejects_unknown_nested_events_host_tools_and_formatter_linkage_forgery(){
 for event in [json!({"type":"stream_event","event":{"type":"new_unknown"}}),json!({"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"bad","name":"Bash","input":{}}}}),json!({"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{}"}}}),json!({"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"forged","content":"done"}]}})]{
  assert_eq!(protocol(vec![init(),event,result()]).unwrap_err(),"unsafe_output");
 }
 let mut bad=init();bad["tools"]=json!([]);assert_eq!(protocol(vec![bad,result()]).unwrap_err(),"invalid_provider_schema");
 let mut bad=init();bad["tools"]=json!(["StructuredOutput","Read"]);assert_eq!(protocol(vec![bad,result()]).unwrap_err(),"unsafe_output");
 let mut bad=init();bad["mcp_servers"]=json!([{"name":"bad"}]);assert_eq!(protocol(vec![bad,result()]).unwrap_err(),"unsafe_output");
}
#[test]
fn internal_formatter_is_not_a_host_tool_and_tool_results_require_exact_linkage(){
 let assistant=json!({"type":"assistant","message":{"content":[{"type":"tool_use","id":"fmt1","name":"StructuredOutput","input":project()}]}});
 let user=json!({"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"fmt1","content":"Structured output provided successfully"}]}});
 assert!(protocol(vec![init(),assistant.clone(),user.clone(),result()]).is_ok());
 let mut bad=user.clone();bad["message"]["content"][0]["is_error"]=json!(true);
 assert!(protocol(vec![init(),assistant.clone(),bad,result()]).is_err());
 assert!(protocol(vec![init(),assistant,user.clone(),user,result()]).is_err());
}
#[test]
fn explicit_errors_dominate_and_allowed_rate_metadata_is_not_failure(){
 let mut error=result();error["is_error"]=json!(true);
 assert_eq!(protocol(vec![init(),result(),error]).unwrap_err(),"provider_failed");
 for status in ["allowed","allowed_warning"]{assert!(protocol(vec![init(),json!({"type":"rate_limit_event","rate_limit_info":{"status":status,"rateLimitType":"five_hour","metadata":"auth 401 rate_limit"}}),result()]).is_ok());}
 assert_eq!(protocol(vec![init(),json!({"type":"rate_limit_event","rate_limit_info":{"status":"rejected"}}),result()]).unwrap_err(),"rate_limit");
 let mut missing=result();missing.as_object_mut().unwrap().remove("structured_output");assert!(protocol(vec![init(),missing]).is_err());
}
fn result()->Value{json!({"type":"result","subtype":"success","is_error":false,"structured_output":project(),"permission_denials":[],"session_id":"PRIVATE_ACCOUNT_CANARY","result":"THOUGHT_CANARY auth 401 rate_limit"})}
#[test]
fn stream_normalizes_only_final_data_and_discards_thinking_metadata_and_stderr(){
 let body=emit(init())+&emit(json!({"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"THOUGHT_CANARY auth 401 rate_limit"}}}))+&emit(json!({"type":"rate_limit_event","rate_limit_info":{"status":"allowed","utilization":0.1}}))+&emit(result())+"printf 'STDERR_CANARY' >&2";
 let (ok,out,err)=Fixture::new(&body).capture(Duration::from_secs(2)).unwrap();assert!(ok);
 let v:Value=serde_json::from_slice(&out).expect("single normalized envelope, not raw NDJSON");assert_eq!(v["structured_output"],project());assert!(err.is_empty());
 let text=String::from_utf8(out).unwrap();for secret in ["THOUGHT_CANARY","PRIVATE_ACCOUNT_CANARY","STDERR_CANARY"]{assert!(!text.contains(secret));}
 assert_eq!(provider::parse_output("claude",text.as_bytes()).unwrap(),project());
}
fn arg<'a>(args:&'a [String],flag:&str)->&'a str { &args[args.iter().position(|a|a==flag).unwrap()+1] }
#[test]
fn phase_specific_timeouts_use_typed_events_not_text_and_have_fixed_safe_guidance(){
 let cases=[
  (vec![],"timeout_waiting"),
  (vec![json!({"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"writing auth 401 rate_limit"}}})],"timeout_thinking"),
  (vec![json!({"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"thinking auth 401 rate_limit"}}})],"timeout_writing"),
  (vec![json!({"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","name":"StructuredOutput","id":"fmt","input":{}}}}),json!({"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"name\":"}}})],"timeout_writing"),
  (vec![json!({"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"secret"}}}),json!({"type":"stream_event","event":{"type":"message_stop"}})],"timeout_waiting"),
  (vec![json!({"type":"system","subtype":"api_retry","attempt":1,"error_status":429,"error":{"message":"secret"}})],"timeout_waiting")
 ];
 for (events,expected) in cases {let body=events.into_iter().fold(emit(init()),|s,e|s+&emit(e))+"/bin/sleep 30";assert_eq!(Fixture::new(&body).capture(Duration::from_millis(750)).unwrap_err(),expected);}
 for (code,message) in [
  ("timeout_thinking","Generation timed out while the provider was thinking. No proposal was returned."),
  ("timeout_writing","Generation timed out while the provider was writing structured output. No proposal was returned."),
  ("timeout_waiting","Generation timed out while waiting for a validated provider result. No proposal was returned."),
  ("invalid_provider_schema","The official CLI could not initialize the required structured output schema. Update the CLI or review the bridge setup.")
 ]{assert_eq!(moro_ai_bridge::jobs::guidance(code),message);}
 assert_eq!(moro_ai_bridge::jobs::guidance("timeout"),"Generation timed out. Try a shorter brief.");
}
#[test]
fn guidance_uses_shared_compatible_adapter_and_native_guidance_validation(){
 let response=json!({"type":"result","subtype":"success","is_error":false,"permission_denials":[],"structured_output":{"rules":["Use one focal action"],"rationale":"Data only"}});
 let body=format!("if [ \"$1\" = '--help' ]; then printf '%s\\n' '--tools --strict-mcp-config --setting-sources --settings --disable-slash-commands --no-chrome --permission-mode --no-session-persistence --json-schema --effort --verbose --include-partial-messages --output-format'; exit 0; fi\ncase \"$*\" in *'draft-07'*'StructuredOutput'*) ;; *) exit 9;; esac\n/bin/cat >/dev/null\n{}{}",emit(init()),emit(response));
 let f=Fixture::new(&body);let result=provider::generate_guidance("claude",&f.0.join("fixture"),"A safe review",&AtomicBool::new(false),Duration::from_secs(2));assert!(result.is_ok(),"{result:?}");
}
#[test]
fn every_claude_entrypoint_requires_new_streaming_and_effort_capabilities(){
 let body=format!("if [ \"$1\" = '--help' ]; then printf '%s\\n' '--tools --strict-mcp-config --setting-sources --settings --disable-slash-commands --no-chrome --permission-mode --no-session-persistence --json-schema'; exit 0; fi\n/bin/cat >/dev/null\n{}{}",emit(init()),emit(result()));let f=Fixture::new(&body);let exe=f.0.join("fixture");let cancel=AtomicBool::new(false);let timeout=Duration::from_secs(2);
 let req=provider_director::Request{provider:"claude".into(),prompt:"Test".into(),consent:true,stage:"style".into(),approved:Value::Null,context_consent:false};
 for out in [provider::generate("claude",&exe,"Test",&cancel,timeout),provider::generate_guidance("claude",&exe,"Test",&cancel,timeout),provider_v2::generate("claude",&exe,"Test",&cancel,timeout),provider_director::generate(&req,&exe,&cancel,timeout)]{assert_eq!(out,Err("cli_update_required"));}
}
#[test]
fn cancellation_timeout_protocol_error_and_output_limit_reap_only_owned_process_group(){
 use std::{sync::Arc,time::Instant};
 fn absent(pid:i32)->bool{unsafe{libc::kill(pid,0)==-1&&std::io::Error::last_os_error().raw_os_error()==Some(libc::ESRCH)}}
 for mode in ["cancel","timeout","protocol","limit"]{
  let body=emit(init())+"/bin/sleep 30 &\nprintf '%s %s' \"$$\" \"$!\" > pids\n"+match mode{"protocol"=>"/bin/sleep 0.15; printf '%s\\n' '{\"type\":\"unknown\"}'\n","limit"=>"/bin/sleep 0.15; /usr/bin/head -c 65537 /dev/zero >&2\n",_=>""}+"wait";
  let f=Fixture::new(&body);let exe=f.0.join("fixture");let cwd=f.0.clone();let cancel=Arc::new(AtomicBool::new(false));let flag=cancel.clone();
  let h=std::thread::spawn(move||provider::capture(&exe,&["--output-format".into(),"stream-json".into()],&cwd,b"",&flag,if mode=="timeout"{Duration::from_secs(1)}else{Duration::from_secs(4)}));
  let end=Instant::now()+Duration::from_secs(3);while !f.0.join("pids").exists(){assert!(Instant::now()<end);std::thread::sleep(Duration::from_millis(5));}
  let pids:Vec<i32>=std::fs::read_to_string(f.0.join("pids")).unwrap().split_whitespace().map(|s|s.parse().unwrap()).collect();assert_eq!(pids.len(),2);if mode=="cancel"{cancel.store(true,Ordering::SeqCst);}
  assert_eq!(h.join().unwrap().unwrap_err(),match mode{"cancel"=>"cancelled","timeout"=>"timeout_waiting","protocol"=>"unsafe_output",_=>"output_limit"});
  let end=Instant::now()+Duration::from_secs(3);while pids.iter().any(|p|!absent(*p)){assert!(Instant::now()<end,"owned tree survived {mode}: {pids:?}");std::thread::sleep(Duration::from_millis(10));}
  let mut status=0;assert_eq!(unsafe{libc::waitpid(pids[0],&mut status,libc::WNOHANG)},-1);assert_eq!(std::io::Error::last_os_error().raw_os_error(),Some(libc::ECHILD));assert_eq!(unsafe{libc::kill(std::process::id() as i32,0)},0);
 }
}
#[test]
fn top_level_error_flags_on_intermediate_events_cannot_be_hidden_by_later_success(){
 for mut event in [init(),json!({"type":"assistant","message":{"content":[{"type":"text","text":"auth 401 invalid"}]}}),json!({"type":"stream_event","event":{"type":"message_stop"}}),json!({"type":"rate_limit_event","rate_limit_info":{"status":"allowed"}})]{
  event["is_error"]=json!(true);let events=if event["type"]=="system"{vec![event,result()]}else{vec![init(),event,result()]};assert_eq!(protocol(events).unwrap_err(),"provider_failed");
 }
}
#[test]
fn nonzero_exit_cannot_turn_arbitrary_generated_text_into_login_or_success(){
 let mut r=result();r["structured_output"]["name"]=json!("auth 401 invalid");let body=emit(init())+&emit(r)+"exit 2";
 assert_eq!(Fixture::new(&body).capture(Duration::from_secs(2)).unwrap_err(),"provider_failed");
}
#[test]
fn claude_invocations_use_draft07_low_effort_streaming_without_host_tools(){
 for args in [provider::arguments("claude",Path::new("unused")),provider_v2::arguments("claude",Path::new("unused"),&provider_v2::schema()),provider_director::arguments("claude",Path::new("unused"),&provider_director::schema())]{
  assert_eq!(arg(&args,"--output-format"),"stream-json");
  assert_eq!(arg(&args,"--effort"),"low");
  assert!(args.contains(&"--verbose".into())&&args.contains(&"--include-partial-messages".into()));
  assert_eq!(arg(&args,"--tools"),"");assert_eq!(arg(&args,"--permission-mode"),"dontAsk");
  let schema:Value=serde_json::from_str(arg(&args,"--json-schema")).unwrap();
  assert_eq!(schema["$schema"],"http://json-schema.org/draft-07/schema#");
  assert!(!schema.to_string().contains("#/$defs/")&&!schema.to_string().contains("\"prefixItems\""));
  assert!(arg(&args,"--system-prompt").contains("StructuredOutput"));
 }
}
