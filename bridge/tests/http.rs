use std::{io::{Read, Write}, net::{TcpListener,TcpStream}, process::{Command,Child}, time::{Duration,Instant}, path::PathBuf};
struct Server { child: Child, port:u16, root:PathBuf }
impl Drop for Server { fn drop(&mut self){unsafe{libc::kill(self.child.id() as i32,libc::SIGTERM);}let _=self.child.wait();let _=std::fs::remove_dir_all(&self.root);} }
impl Server {
 fn submit(&self,provider:&str,prompt:&str)->String{let body=serde_json::json!({"provider":provider,"prompt":prompt}).to_string();let(code,out)=self.request("POST","/api/ai/jobs",MUTATE,&body);assert_eq!(code,202,"{out}");value(&out)["job"]["id"].as_str().unwrap().to_string()}
 fn terminal(&self,id:&str)->serde_json::Value{let end=Instant::now()+Duration::from_secs(5);loop{let(code,out)=self.request("GET",&format!("/api/ai/jobs/{id}"),"","");assert_eq!(code,200);let v=value(&out);if v["job"]["status"]!="running"{return v["job"].clone();}assert!(Instant::now()<end,"{out}");std::thread::sleep(Duration::from_millis(20));}}
 fn start()->Self { Self::start_with(env!("CARGO_BIN_EXE_fake-cli-protocol-fixture")) }
 fn start_with(fixture:&str)->Self { let port=TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port(); let root=std::env::temp_dir().join(format!("moro-http-test-{}-{port}",std::process::id()));std::fs::create_dir_all(&root).unwrap();std::fs::write(root.join("index.html"),"<h1>Real dist fixture</h1>").unwrap(); let child=Command::new(env!("CARGO_BIN_EXE_moro-ai-bridge")).args(["--web-root",root.to_str().unwrap(),"--port",&port.to_string(),"--codex-bin",fixture,"--claude-bin",fixture]).env("HOME",&root).env("PATH","").env_remove("CODEX_HOME").env_remove("CLAUDE_CONFIG_DIR").spawn().unwrap(); let s=Self{child,port,root};let until=Instant::now()+Duration::from_secs(3);while Instant::now()<until { if TcpStream::connect(("127.0.0.1",port)).is_ok(){return s;}std::thread::sleep(Duration::from_millis(20)); }panic!("bridge must listen on configured loopback port"); }
 fn request(&self,method:&str,path:&str,headers:&str,body:&str)->(u16,String){let mut stream=TcpStream::connect(("127.0.0.1",self.port)).unwrap();stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();write!(stream,"{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\nContent-Length: {}\r\n{headers}\r\n{body}",self.port,body.len()).unwrap();let mut out=String::new();stream.read_to_string(&mut out).unwrap();(out.split_whitespace().nth(1).unwrap().parse().unwrap(),out)}
}
#[test]
fn harness_preflight_is_zero_call_and_validates_exact_input() {
 let s=Server::start_with("/not-installed/fixture");
 for (domain,status) in [("ui-motion","ready"),("human-character","blocked")] {
  let body=serde_json::json!({"provider":"codex","brief":"  A pulse  ","domain":domain}).to_string();
  let(code,out)=s.request("POST","/api/ai/harness/preflight",MUTATE,&body);
  assert_eq!(code,200,"{out}");let p=value(&out)["preflight"].clone();
  assert_eq!(p["status"],status);assert_eq!(p["modelCalls"],0);assert_eq!(p["callBudget"],7);assert_eq!(p["artisticReview"],"not_reviewed");
 }
 for body in [r#"{"provider":"codex","brief":"x","domain":"ui-motion","consent":true}"#.to_string(),r#"{"provider":"other","brief":"x","domain":"ui-motion"}"#.to_string(),r#"{"provider":"codex","brief":"  ","domain":"ui-motion"}"#.to_string(),serde_json::json!({"provider":"codex","brief":"x".repeat(4001),"domain":"ui-motion"}).to_string()] {
  assert_eq!(s.request("POST","/api/ai/harness/preflight",MUTATE,&body).0,400);
 }
 assert_eq!(s.request("POST","/api/ai/harness/preflight","Content-Type: application/json\r\n","{}").0,403);
}
#[test]
fn harness_http_runs_native_seven_stages_and_strict_report_for_both_providers() {
 let s=Server::start_with(env!("CARGO_BIN_EXE_fake-harness-cli-fixture"));
 for provider in ["codex","claude"] {
  let body=serde_json::json!({"provider":provider,"brief":"  Protocol fixture only: pulse  ","domain":"ui-motion","consent":true,"callBudget":7}).to_string();
  let(code,out)=s.request("POST","/api/ai/harness/jobs",MUTATE,&body);assert_eq!(code,202,"{out}");
  let job=value(&out)["job"].clone();assert_eq!(job["kind"],"harness");assert_eq!(job["provider"],provider);assert_eq!(job["status"],"running");
  let job=s.terminal(job["id"].as_str().unwrap());assert_eq!(job["status"],"succeeded","{job}");assert_eq!(job["kind"],"harness");assert!(job.get("project").is_none());
  let r=&job["report"];assert_eq!(r["modelCalls"],7);assert_eq!(r["callBudget"],7);assert_eq!(r["status"],"review_required");assert_eq!(r["task"]["brief"],"Protocol fixture only: pulse");assert_eq!(r["artisticReview"],"not_reviewed");
  assert_eq!(r["sources"].as_array().unwrap().len(),3);
  for (stage,id) in r["stages"].as_array().unwrap().iter().zip(["base","propose-invariant","propose-domain","probe-invariant","probe-domain","compose","final"]) {assert_eq!(stage["id"],id);assert_eq!(stage["status"],"succeeded");}
  // The unchanged native inspector must accept the HTTP report, including fixed fingerprints.
  let p=s.root.join("http-report.json");std::fs::write(&p,serde_json::to_vec(r).unwrap()).unwrap();
  let o=Command::new(env!("CARGO_BIN_EXE_moro-harness")).args(["report","--input",p.to_str().unwrap()]).env("HOME",&s.root).env("PATH","").output().unwrap();assert!(o.status.success(),"{}",String::from_utf8_lossy(&o.stderr));
 }
}
#[test]
fn harness_pause_fixture_exposes_progress_shared_admission_and_cancellation() {
 let s=Server::start_with(env!("CARGO_BIN_EXE_fake-harness-cli-fixture"));
 let body=serde_json::json!({"provider":"codex","brief":"fixture:pause","domain":"ui-motion","consent":true,"callBudget":7}).to_string();
 let(code,out)=s.request("POST","/api/ai/harness/jobs",MUTATE,&body);assert_eq!(code,202,"{out}");let id=value(&out)["job"]["id"].as_str().unwrap().to_string();
 let end=Instant::now()+Duration::from_secs(3);
 loop {let(_,out)=s.request("GET",&format!("/api/ai/jobs/{id}"),"","");let j=value(&out)["job"].clone();assert_eq!(j["status"],"running","{j}");if j["stage"]=="base"{break;}assert!(Instant::now()<end);std::thread::sleep(Duration::from_millis(10));}
 // A real 2s fixture pause keeps the base subprocess active past the baseline's entire run.
 std::thread::sleep(Duration::from_millis(700));
 let(_,out)=s.request("GET",&format!("/api/ai/jobs/{id}"),"","");assert_eq!(value(&out)["job"]["stage"],"base","fixture pause must hold the base stage");
 assert_eq!(s.request("POST","/api/ai/jobs",MUTATE,r#"{"provider":"codex","prompt":"fixture:success"}"#).0,409);
 assert_eq!(s.request("POST","/api/ai/harness/jobs",MUTATE,&body).0,409);
 let(code,out)=s.request("POST",&format!("/api/ai/jobs/{id}/cancel"),MUTATE,"{}");assert_eq!(code,200);assert_eq!(value(&out)["job"]["kind"],"harness");assert_eq!(value(&out)["job"]["status"],"cancelled");
 // Retry only admission after cleanup; never retry a provider invocation.
 let end=Instant::now()+Duration::from_secs(3);
 let ordinary=loop{let(code,out)=s.request("POST","/api/ai/jobs",MUTATE,r#"{"provider":"codex","prompt":"fixture:pause"}"#);if code==202{break value(&out)["job"]["id"].as_str().unwrap().to_string();}assert_eq!(code,409);assert!(Instant::now()<end);std::thread::sleep(Duration::from_millis(10));};
 assert_eq!(s.request("POST","/api/ai/harness/jobs",MUTATE,&body).0,409);
 assert_eq!(s.request("POST",&format!("/api/ai/jobs/{ordinary}/cancel"),MUTATE,"{}").0,200);
 std::thread::sleep(Duration::from_millis(150));let j=s.terminal(&id);assert_eq!(j["status"],"cancelled");assert!(j.get("report").is_none());assert!(j.get("project").is_none());
}
#[test]
fn harness_zero_call_gates_and_failures_never_fall_back_to_generation() {
 use std::os::unix::fs::PermissionsExt;
 let dir=std::env::temp_dir().join(format!("moro-harness-gates-{}",std::process::id()));std::fs::create_dir_all(&dir).unwrap();
 let shim=dir.join("explicit-fixture");let log=dir.join("calls");
 std::fs::write(&shim,format!("#!/bin/sh\nprintf '%s\\n' \"$*\" >> '{}'\nexec '{}' \"$@\"\n",log.display(),env!("CARGO_BIN_EXE_fake-harness-cli-fixture"))).unwrap();std::fs::set_permissions(&shim,std::fs::Permissions::from_mode(0o700)).unwrap();
 let s=Server::start_with(shim.to_str().unwrap());
 let valid=serde_json::json!({"provider":"codex","brief":"fixture:self-approve","domain":"ui-motion","consent":true,"callBudget":7});
 for (key,bad) in [("consent",serde_json::json!(false)),("consent",serde_json::json!("true")),("consent",serde_json::Value::Null),("callBudget",serde_json::json!(6)),("callBudget",serde_json::json!(8)),("callBudget",serde_json::json!("7")),("callBudget",serde_json::json!(7.0)),("domain",serde_json::json!("human-character")),("domain",serde_json::json!("unknown")),("provider",serde_json::json!("unknown")),("snapshot",serde_json::json!({})),("sources",serde_json::json!([])),("brief",serde_json::json!(" ")),("brief",serde_json::json!("🙂".repeat(4001)))] {
  let mut b=valid.clone();b[key]=bad;assert_eq!(s.request("POST","/api/ai/harness/jobs",MUTATE,&b.to_string()).0,400,"{b}");assert!(!log.exists(),"rejected request called even --help");
 }
 for key in ["consent","callBudget"] {let mut b=valid.clone();b.as_object_mut().unwrap().remove(key);assert_eq!(s.request("POST","/api/ai/harness/jobs",MUTATE,&b.to_string()).0,400);}
 let dup=valid.to_string().replacen('{',"{\"consent\":true,",1);assert_eq!(s.request("POST","/api/ai/harness/jobs",MUTATE,&dup).0,400);
 for domain in ["ui-motion","human-character"] {let b=serde_json::json!({"provider":"codex","brief":"x","domain":domain});assert_eq!(s.request("POST","/api/ai/harness/preflight",MUTATE,&b.to_string()).0,200);}
 assert!(!log.exists());
 // A blocked domain wins over provider-unavailable, even with no executable installed.
 let absent=Server::start_with("/not-installed/provider");let mut human=valid.clone();human["domain"]=serde_json::json!("human-character");let(code,out)=absent.request("POST","/api/ai/harness/jobs",MUTATE,&human.to_string());assert_eq!(code,400);assert_eq!(value(&out)["error"]["code"],"unsupported_domain");assert_eq!(absent.request("POST","/api/ai/harness/jobs",MUTATE,&valid.to_string()).0,503);
 for (brief,code) in [("fixture:self-approve","invalid_project"),("fixture:tool-event","unsafe_output")] {
  let mut b=valid.clone();b["brief"]=serde_json::json!(brief);let(code_start,out)=s.request("POST","/api/ai/harness/jobs",MUTATE,&b.to_string());assert_eq!(code_start,202);let id=value(&out)["job"]["id"].as_str().unwrap().to_string();let j=s.terminal(&id);assert_eq!(j["status"],"failed","{j}");assert_eq!(j["error"]["code"],code);assert!(j.get("report").is_none());assert!(j.get("project").is_none());assert_eq!(std::fs::read_to_string(&log).unwrap().lines().count(),2,"one help and one model invocation, no retries/fallback");std::fs::remove_file(&log).unwrap();
 }
 drop(s);std::fs::remove_dir_all(dir).unwrap();
}
#[test]
fn harness_final_stage_failure_or_cancel_exposes_no_late_report_and_cleans_process() {
 use std::os::unix::fs::PermissionsExt;
 for cancel in [false,true] {
  let dir=std::env::temp_dir().join(format!("moro-harness-final-{}-{cancel}",std::process::id()));std::fs::create_dir_all(&dir).unwrap();let shim=dir.join("explicit-fixture");let count=dir.join("count");let marker=dir.join("pid");
  let action=if cancel {format!("printf '%s' \"$$\" > '{}'\nexec /bin/sleep 10",marker.display())}else{"printf 'PRIVATE-PROVIDER-DIAGNOSTIC' >&2\nexit 1".into()};
  std::fs::write(&shim,format!("#!/bin/sh\ncase \" $* \" in *' --help '*) exec '{}' \"$@\";; esac\nn=0\nif test -f '{}'; then n=$(/bin/cat '{}'); fi\nn=$((n+1))\nprintf '%s' \"$n\" > '{}'\nif test \"$n\" = 7; then\n{}\nfi\nexec '{}' \"$@\"\n",env!("CARGO_BIN_EXE_fake-harness-cli-fixture"),count.display(),count.display(),count.display(),action,env!("CARGO_BIN_EXE_fake-harness-cli-fixture"))).unwrap();std::fs::set_permissions(&shim,std::fs::Permissions::from_mode(0o700)).unwrap();
  let s=Server::start_with(shim.to_str().unwrap());let body=serde_json::json!({"provider":"codex","brief":"Final stage protocol fixture only","domain":"ui-motion","consent":true,"callBudget":7}).to_string();let(code,out)=s.request("POST","/api/ai/harness/jobs",MUTATE,&body);assert_eq!(code,202);let id=value(&out)["job"]["id"].as_str().unwrap().to_string();
  if cancel {let end=Instant::now()+Duration::from_secs(5);while !marker.exists(){assert!(Instant::now()<end);std::thread::sleep(Duration::from_millis(10));}assert_eq!(s.request("POST","/api/ai/jobs",MUTATE,r#"{"provider":"codex","prompt":"x"}"#).0,409);assert_eq!(s.request("POST",&format!("/api/ai/jobs/{id}/cancel"),MUTATE,"{}").0,200);}
  let job=s.terminal(&id);assert_eq!(job["status"],if cancel{"cancelled"}else{"failed"});assert_eq!(job["stage"],"final");assert!(job.get("report").is_none());assert!(job.get("project").is_none());assert!(!job.to_string().contains("PRIVATE-PROVIDER"));assert_eq!(std::fs::read_to_string(&count).unwrap(),"7");
  if cancel {let pid:i32=std::fs::read_to_string(marker).unwrap().parse().unwrap();let end=Instant::now()+Duration::from_secs(3);while unsafe{libc::kill(pid,0)}==0{assert!(Instant::now()<end,"fixture process survived cancellation");std::thread::sleep(Duration::from_millis(10));}std::thread::sleep(Duration::from_millis(100));assert_eq!(s.terminal(&id)["status"],"cancelled");}
  drop(s);std::fs::remove_dir_all(dir).unwrap();
 }
}
#[test]
fn v2_fixture_generates_both_protocols_and_returns_untouched_native_project() {
 let s=Server::start();
 let expected:serde_json::Value=serde_json::from_str(include_str!("../../fixtures/creator-v2-articulated-curve.json")).unwrap();
 for provider in ["codex","claude"] {
  let body=serde_json::json!({"provider":provider,"prompt":"fixture:v2-contract","consent":true}).to_string();
  let(code,out)=s.request("POST","/api/ai/v2/jobs",MUTATE,&body);assert_eq!(code,202,"{out}");
  let j=s.terminal(value(&out)["job"]["id"].as_str().unwrap());assert_eq!(j["status"],"succeeded","{j}");assert_eq!(j["project"],expected);
  moro_ai_bridge::creator_v2::validate_project_v2(&j["project"]).unwrap();
 }
}
#[test]
fn v2_http_zero_call_gates_and_shared_admission_cancel() {
 use std::os::unix::fs::PermissionsExt;
 let missing=Server::start_with("/not-installed/v2-explicit-fixture");
 let valid=serde_json::json!({"provider":"codex","prompt":"fixture:v2-contract","consent":true});
 for (key,bad) in [("consent",serde_json::json!(false)),("consent",serde_json::json!("true")),("consent",serde_json::Value::Null),("baseProject",serde_json::json!({})),("contextConsent",serde_json::json!(true)),("provider",serde_json::json!("unknown")),("prompt",serde_json::json!(" ")),("prompt",serde_json::json!("🙂".repeat(4001)))] {
  let mut b=valid.clone();b[key]=bad;assert_eq!(missing.request("POST","/api/ai/v2/jobs",MUTATE,&b.to_string()).0,400);
 }
 assert_eq!(missing.request("POST","/api/ai/v2/jobs","Content-Type: application/json\r\n",&valid.to_string()).0,403);
 let s=Server::start();let slow=serde_json::json!({"provider":"codex","prompt":"fixture:slow","consent":true});
 let(code,out)=s.request("POST","/api/ai/v2/jobs",MUTATE,&slow.to_string());assert_eq!(code,202);let id=value(&out)["job"]["id"].as_str().unwrap().to_string();
 assert_eq!(s.request("POST","/api/ai/jobs",MUTATE,r#"{"provider":"codex","prompt":"fixture:success"}"#).0,409);
 let harness=serde_json::json!({"provider":"codex","brief":"fixture:pause","domain":"ui-motion","consent":true,"callBudget":7});assert_eq!(s.request("POST","/api/ai/harness/jobs",MUTATE,&harness.to_string()).0,409);
 assert_eq!(s.request("POST","/api/ai/v2/jobs",MUTATE,&valid.to_string()).0,409);
 assert_eq!(s.request("POST",&format!("/api/ai/jobs/{id}/cancel"),MUTATE,"{}").0,200);
 std::thread::sleep(Duration::from_millis(150));let j=s.terminal(&id);assert_eq!(j["status"],"cancelled");assert!(j.get("project").is_none());
 let ordinary=s.submit("codex","fixture:slow");assert_eq!(s.request("POST","/api/ai/v2/jobs",MUTATE,&valid.to_string()).0,409);s.request("POST",&format!("/api/ai/jobs/{ordinary}/cancel"),MUTATE,"{}");
 // Shim counts actual subprocess launches, not network or installed provider discovery.
 let shim=s.root.join("v2-fixture-shim");let calls=s.root.join("v2-calls");
 std::fs::write(&shim,format!("#!/bin/sh\nprintf '%s\\n' called >> '{}'\nexec '{}' \"$@\"\n",calls.display(),env!("CARGO_BIN_EXE_fake-cli-protocol-fixture"))).unwrap();std::fs::set_permissions(&shim,std::fs::Permissions::from_mode(0o700)).unwrap();
 let counted=Server::start_with(shim.to_str().unwrap());
 for provider in ["codex","claude"] {for (brief,error) in [("fixture:bad-parent","invalid_project"),("fixture:duplicate","invalid_output"),("fixture:v1-output","invalid_project")] {
  let body=serde_json::json!({"provider":provider,"prompt":brief,"consent":true});let(code,out)=counted.request("POST","/api/ai/v2/jobs",MUTATE,&body.to_string());assert_eq!(code,202);let j=counted.terminal(value(&out)["job"]["id"].as_str().unwrap());assert_eq!(j["status"],"failed","{j}");assert_eq!(j["error"]["code"],error);assert!(j.get("project").is_none());assert_eq!(std::fs::read_to_string(&calls).unwrap().lines().count(),2,"one help + one model invocation; no fallback/retry");std::fs::remove_file(&calls).unwrap();
 }}
}
#[test]
fn v2_consent_is_rejected_before_provider_resolution() {
 let s=Server::start_with("/not-installed/explicit-v2-provider");
 for body in [r#"{"provider":"codex","prompt":"x"}"#,r#"{"provider":"codex","prompt":"x","consent":false}"#] {
  let(code,out)=s.request("POST","/api/ai/v2/jobs",MUTATE,body);assert_eq!(code,400,"{out}");
 }
 assert_eq!(s.request("POST","/api/ai/v2/jobs",MUTATE,r#"{"provider":"codex","prompt":"x","consent":true}"#).0,503);
}
const MUTATE:&str="Content-Type: application/json\r\nX-Moro-Request: 1\r\n";
fn value(out:&str)->serde_json::Value { serde_json::from_str(out.split("\r\n\r\n").nth(1).unwrap()).unwrap() }
#[test] fn official_cli_protocol_fixture_produces_valid_async_job(){let s=Server::start();let(code,out)=s.request("POST","/api/ai/jobs",MUTATE,r#"{"provider":"codex","prompt":"fixture:success"}"#);assert_eq!(code,202,"{out}");let v=value(&out);let id=v["job"]["id"].as_str().unwrap();let end=Instant::now()+Duration::from_secs(5);loop{let(code,out)=s.request("GET",&format!("/api/ai/jobs/{id}"),"","");assert_eq!(code,200);let v=value(&out);if v["job"]["status"]!="running" {assert_eq!(v["job"]["status"],"succeeded","{out}");assert_eq!(v["job"]["provider"],"codex");moro_ai_bridge::validate_project(&v["job"]["project"]).unwrap();break;}assert!(Instant::now()<end);std::thread::sleep(Duration::from_millis(20));}}
#[test] fn cancellation_is_single_flight_idempotent_and_has_no_late_success(){let s=Server::start();let id=s.submit("codex","fixture:slow");let(code,out)=s.request("POST","/api/ai/jobs",MUTATE,r#"{"provider":"codex","prompt":"fixture:success"}"#);assert_eq!(code,409);assert_eq!(value(&out)["error"]["code"],"busy");let(code,out)=s.request("POST",&format!("/api/ai/jobs/{id}/cancel"),MUTATE,"{}");assert_eq!(code,200);assert_eq!(value(&out)["job"]["status"],"cancelled");std::thread::sleep(Duration::from_millis(100));let job=s.terminal(&id);assert_eq!(job["status"],"cancelled");assert!(job.get("project").is_none());let(_,out)=s.request("POST",&format!("/api/ai/jobs/{id}/cancel"),MUTATE,"{}");assert_eq!(value(&out)["job"]["status"],"cancelled");let id=s.submit("codex","fixture:success");assert_eq!(s.terminal(&id)["status"],"succeeded");}
#[test] fn fixture_failures_are_safe_and_bounded(){let s=Server::start();for (provider,prompt,error) in [("codex","fixture:invalid","invalid_project"),("codex","fixture:tool","unsafe_output"),("codex","fixture:error","unsafe_output"),("codex","fixture:stdout-limit","output_limit"),("codex","fixture:stderr-limit","output_limit"),("claude","fixture:claude-auth","needs_login")] {let id=s.submit(provider,prompt);let job=s.terminal(&id);assert_eq!(job["status"],"failed","{job}");assert_eq!(job["error"]["code"],error,"{job}");assert!(job.get("project").is_none());assert!(!job.to_string().contains("401"));}let id=s.submit("claude","fixture:success");assert_eq!(s.terminal(&id)["status"],"succeeded");}
#[test] fn request_contract_rejects_unknown_fields_bad_prompts_and_oversize(){let s=Server::start();for body in [r#"{"provider":"codex","prompt":"ok","executable":"evil"}"#.to_string(),r#"{"provider":"codex","prompt":"  "}"#.to_string(),r#"{"provider":"other","prompt":"ok"}"#.to_string(),r#"{"provider":"codex","provider":"claude","prompt":"ok"}"#.to_string(),serde_json::json!({"provider":"codex","prompt":"x".repeat(4001)}).to_string(),"x".repeat(32769)]{let(code,out)=s.request("POST","/api/ai/jobs",MUTATE,&body);assert_eq!(code,400,"{out}");}let(code,_)=s.request("POST","/api/ai/jobs","Content-Type: application/json\r\n",r#"{"provider":"codex","prompt":"ok"}"#);assert_eq!(code,403);for path in ["/api/ai/jobs/absent","/../Cargo.toml","/%2e%2e/Cargo.toml"]{assert_eq!(s.request("GET",path,"","").0,404);}assert_eq!(s.request("POST","/api/ai/jobs/absent/cancel",MUTATE,"{\"evil\":1}").0,400);}
#[test] fn terminal_history_is_bounded_and_terminal_cancel_preserves_success(){let s=Server::start();let mut ids=Vec::new();for _ in 0..18{let id=s.submit("codex","fixture:success");assert_eq!(s.terminal(&id)["status"],"succeeded");ids.push(id);}for id in &ids[..2]{assert_eq!(s.request("GET",&format!("/api/ai/jobs/{id}"),"","").0,404);}for id in &ids[2..]{assert_eq!(s.request("GET",&format!("/api/ai/jobs/{id}"),"","").0,200);}let(_,out)=s.request("POST",&format!("/api/ai/jobs/{}/cancel",ids.last().unwrap()),MUTATE,"{}");assert_eq!(value(&out)["job"]["status"],"succeeded");}
#[test] fn rejects_duplicate_origin_security_headers(){let s=Server::start();for headers in ["Origin: http://evil.example\r\nOrigin: http://evil.example\r\n","Sec-Fetch-Site: cross-site\r\nSec-Fetch-Site: same-origin\r\n"]{let(code,out)=s.request("GET","/api/ai/status",headers,"");assert_eq!(code,403,"{out}");}}
#[test] fn loopback_status_static_and_host_boundary(){let s=Server::start();let(code,out)=s.request("GET","/api/ai/status","","");assert_eq!(code,200);assert!(out.contains("installed-only"));assert!(out.to_ascii_lowercase().contains("cache-control: no-store"));assert!(!out.contains("Access-Control-Allow-Origin"));let(code,out)=s.request("GET","/create","","");assert_eq!(code,200);assert!(out.contains("Real dist fixture"));let(code,_)=s.request("GET","/api/ai/status","Host: evil.example\r\n","");assert_eq!(code,403);let(code,_)=s.request("POST","/api/ai/jobs","Content-Type: application/json\r\nX-Moro-Request: 1\r\nOrigin: https://evil.example\r\n","{}");assert_eq!(code,403);}
