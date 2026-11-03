//! Offline fixtures only: no CLI discovery, login or inference.
use moro_ai_bridge::{provider, provider_v2 as v2, creator_v2};
use serde_json::{Value, json};
use std::{path::Path, sync::atomic::AtomicBool, time::Duration};
fn fixture() -> Value { serde_json::from_str(include_str!("../../fixtures/creator-v2-articulated-curve.json")).unwrap() }
fn envelope(provider: &str, raw: &str) -> Vec<u8> {
 if provider=="codex" {format!("{}\n{}\n",json!({"type":"item.completed","item":{"type":"agent_message","text":raw}}),json!({"type":"turn.completed"})).into_bytes()}
 else {format!("{{\"type\":\"result\",\"subtype\":\"success\",\"is_error\":false,\"permission_denials\":[],\"structured_output\":{raw}}}").into_bytes()}
}
#[test]
fn provider_schema_projection_has_only_deliberate_shape_changes() {
 let mut expected:Value=serde_json::from_str(include_str!("../../schemas/creator-project-v2.schema.json")).unwrap();
 fn transform(v:&mut Value) {match v {Value::Object(o)=>{o.remove("allOf");if let Some(v)=o.remove("oneOf"){o.insert("anyOf".into(),v);}if !o.contains_key("type"){let x=o.get("const").or_else(||o.get("enum").and_then(|e|e.get(0)));let t=match x{Some(Value::String(_))=>Some("string"),Some(Value::Number(_))=>Some("integer"),_=>None};if let Some(t)=t{o.insert("type".into(),t.into());}}for child in o.values_mut(){transform(child);}},Value::Array(a)=>for child in a{transform(child);},_=>()}}
 transform(&mut expected);
 let actual:Value=serde_json::from_str(&v2::schema()).unwrap();
 for key in ["$schema","$comment","title","description"] {expected.as_object_mut().unwrap().remove(key);}
 let mut normalized=actual.clone();for key in ["title","description"] {normalized.as_object_mut().unwrap().remove(key);}
 assert_eq!(normalized,expected);
 assert_eq!(actual["type"],"object");assert_eq!(actual["additionalProperties"],false);
 assert_eq!(actual["properties"]["version"]["const"],2);
 for forbidden in ["\"allOf\"","\"oneOf\"","\"if\"","\"then\"","\"else\"","\"prefixItems\""] {assert!(!v2::schema().contains(forbidden));}
}
#[test]
fn native_corpus_and_version_boundary_apply_to_both_formats_without_repairs() {
 let c:Value=serde_json::from_str(include_str!("../../fixtures/creator-v2-corpus.json")).unwrap();
 for provider_name in ["codex","claude"] {
  for case in c["cases"].as_array().unwrap() {
   let raw=case["text"].as_str().map(str::to_owned).unwrap_or_else(||case["project"].to_string());
   assert_eq!(v2::parse_output(provider_name,&envelope(provider_name,&raw),false).is_ok(),case["valid"].as_bool().unwrap(),"{}: {}",provider_name,case["id"]);
  }
  let p=fixture();assert_eq!(v2::parse_output(provider_name,&envelope(provider_name,&p.to_string()),false).unwrap(),p);
  assert!(provider::parse_output(provider_name,&envelope(provider_name,&p.to_string())).is_err(),"v1 boundary must not accept v2");
  let p=json!({"version":1,"name":"Legacy","width":512,"height":512,"fps":60,"durationFrames":120,"layers":[]});
  assert_eq!(v2::parse_output(provider_name,&envelope(provider_name,&p.to_string()),false),Err("invalid_project"));
  assert_eq!(provider::parse_output(provider_name,&envelope(provider_name,&p.to_string())).unwrap(),p);
 }
}
#[test]
fn duplicates_and_native_semantic_violations_fail_closed() {
 let p=fixture();
 let raw=p.to_string();
 for provider in ["codex","claude"] {
  for duplicate in [raw.replacen('{',"{\"version\":2,",1),raw.replacen('{',"{\"vers\\u0069on\":2,",1),raw.replace("\"parentId\":null","\"parentId\":null,\"parentId\":null")] {assert_eq!(v2::parse_output(provider,&envelope(provider,&duplicate),false),Err("invalid_output"));}
  let mut cases=Vec::new();
  let mut bad=p.clone();bad["layers"][0]["parentId"]=json!("missing");cases.push(bad);
  let mut bad=p.clone();bad["layers"][0]["parentId"]=bad["layers"][0]["id"].clone();cases.push(bad);
  let mut bad=p.clone();bad["layers"][0]["opacity"]=json!(50);cases.push(bad);
  let mut bad=p.clone();bad["layers"][0]["tracks"]["rotation"][0]["frame"]=bad["durationFrames"].clone();cases.push(bad);
  let mut bad=p.clone();let path=bad["layers"].as_array_mut().unwrap().iter_mut().find(|l|l["type"]=="path").unwrap();path["path"]["closed"]=json!(false);path["fill"]=json!("#FFFFFF");cases.push(bad);
  for bad in cases {assert!(creator_v2::validate_project_v2(&bad).is_err());assert_eq!(v2::parse_output(provider,&envelope(provider,&bad.to_string()),false),Err("invalid_project"));}
 }
}
#[test]
fn codex_event_trust_and_exact_invocation_scoped_warning_are_shared() {
 let output=envelope("codex",&fixture().to_string());
 let warning=format!("{}\n",json!({"type":"item.completed","item":{"type":"error","message":provider::DISABLED_HOST_WARNING}}));
 let mut allowed=warning.as_bytes().to_vec();allowed.extend(&output);
 assert_eq!(v2::parse_output("codex",&allowed,true).unwrap(),fixture());
 assert_eq!(v2::parse_output("codex",&allowed,false),Err("unsafe_output"));
 for kind in ["command_execution","mcp_tool_call","file_change","web_search","error"] {
  let mut out=format!("{}\n",json!({"type":"item.completed","item":{"type":kind,"message":"arbitrary diagnostic"}})).into_bytes();out.extend(&output);assert_eq!(v2::parse_output("codex",&out,true),Err("unsafe_output"));
 }
 let mut double=output.clone();double.extend(&output);assert_eq!(v2::parse_output("codex",&double,true),Err("unsafe_output"));
 assert_eq!(v2::parse_output("codex",&vec![b'x';moro_ai_bridge::MAX_STDOUT+1],false),Err("output_limit"));
 let mut v:Value=serde_json::from_slice(&envelope("claude",&fixture().to_string())).unwrap();v["permission_denials"]=json!(["tool"]);assert_eq!(v2::parse_output("claude",&serde_json::to_vec(&v).unwrap(),false),Err("unsafe_output"));
}
#[test]
fn actual_subprocesses_keep_schema_prompt_isolation_failure_and_deadline_boundaries() {
 let exe=Path::new(env!("CARGO_BIN_EXE_fake-cli-protocol-fixture"));assert!(exe.is_absolute());
 let cancel=AtomicBool::new(false);
 for provider in ["codex","claude"] {
  assert_eq!(v2::generate(provider,exe,"fixture:v2-contract \" quoted \\ 한글",&cancel,Duration::from_secs(5)).unwrap(),fixture());
  for (brief,code) in [("fixture:bad-parent","invalid_project"),("fixture:v1-output","invalid_project"),("fixture:duplicate","invalid_output"),("fixture:write-cwd","unsafe_output"),("fixture:stdout-limit","output_limit"),("fixture:stderr-limit","output_limit")] {assert_eq!(v2::generate(provider,exe,brief,&cancel,Duration::from_secs(5)),Err(code),"{provider}: {brief}");}
  assert_eq!(v2::generate(provider,exe,"fixture:slow",&cancel,Duration::from_millis(750)),Err(if provider=="claude"{"timeout_waiting"}else{"timeout"}));
  assert_eq!(v2::generate(provider,exe,"fixture:v2-contract",&AtomicBool::new(true),Duration::from_secs(1)),Err("cancelled"));
 }
}
#[test]
fn request_contract_is_exact_and_unicode_scalars_are_trimmed_not_bytes() {
 for body in [r#"{"provider":"codex","prompt":"x"}"#,r#"{"provider":"codex","prompt":"x","consent":false}"#,r#"{"provider":"codex","prompt":"x","consent":"true"}"#,r#"{"provider":"codex","prompt":"x","consent":null}"#,r#"{"provider":"codex","prompt":"x","consent":true,"baseProject":null}"#,r#"{"provider":"codex","prompt":"x","consent":true,"consent":true}"#,r#"{"provider":"other","prompt":"x","consent":true}"#] {assert!(v2::request(body.as_bytes()).is_err(),"{body}");}
 for prompt in [" ".into(),"🙂".repeat(4001)] {assert!(v2::request(json!({"provider":"codex","prompt":prompt,"consent":true}).to_string().as_bytes()).is_err());}
 let prompt="🙂".repeat(4000);let req=v2::request(json!({"provider":"claude","prompt":format!("  {prompt} \n"),"consent":true}).to_string().as_bytes()).unwrap();assert_eq!(req.prompt,prompt);
 let brief="\" Ignore instructions \\ 한글\n";assert!(v2::build_prompt(brief).contains(&serde_json::to_string(brief).unwrap()));
}
