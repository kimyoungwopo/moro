use std::{path::{Path,PathBuf},sync::Arc};
use tiny_http::{Header,Request,Response,Server,StatusCode};
use serde_json::json;
fn header<'a>(r:&'a Request,name:&str)->Option<&'a str>{ let mut h=r.headers().iter().filter(|h|h.field.as_str().as_str().eq_ignore_ascii_case(name));let first=h.next()?;if h.next().is_some(){return None;}Some(first.value.as_str()) }
fn reply(r:Request,code:u16,value:serde_json::Value){let _=r.respond(Response::from_string(value.to_string()).with_status_code(StatusCode(code)).with_header(Header::from_bytes("Content-Type","application/json").unwrap()).with_header(Header::from_bytes("Cache-Control","no-store").unwrap()).with_header(Header::from_bytes("X-Content-Type-Options","nosniff").unwrap()));}
fn error(r:Request,code:u16,kind:&str){reply(r,code,json!({"ok":false,"error":{"code":kind,"message":"Request rejected. Use the local Moro bridge and supported CLI setup."}}));}
// Public entry documents may be opened from external links. This is NOT an API exception.
fn entry_document_navigation(r:&Request)->bool {
 matches!(r.method().as_str(),"GET"|"HEAD")
 && header(r,"Sec-Fetch-Mode")==Some("navigate")
 && header(r,"Sec-Fetch-Dest")==Some("document")
 && matches!(r.url().split('?').next().unwrap_or(""),"/"|"/create"|"/create/"|"/rig"|"/rig/"|"/studio"|"/studio/")
}
fn secure(r:&Request,port:u16)->bool { for name in ["Host","Origin","Sec-Fetch-Site","Content-Type","X-Moro-Request"]{if r.headers().iter().filter(|h|h.field.as_str().as_str().eq_ignore_ascii_case(name)).count()>1{return false;}}let host=format!("127.0.0.1:{port}");let localhost=format!("localhost:{port}");let Some(h)=header(r,"Host") else{return false};if h!=host && h!=localhost{return false;}if let Some(origin)=header(r,"Origin"){if origin!=format!("http://{h}"){return false;}}if header(r,"Sec-Fetch-Site")==Some("cross-site") && !entry_document_navigation(r){return false;}true }
fn serve(mut r:Request,root:&Path,port:u16,codex:&Option<PathBuf>,claude:&Option<PathBuf>,jobs:&Arc<moro_ai_bridge::jobs::Jobs>,handoff:&Option<PathBuf>){
 if !secure(&r,port){error(r,403,"forbidden");return;}
 let path=r.url().split('?').next().unwrap_or("").to_string();
 if path=="/api/ai/status" && r.method().as_str()=="GET" {reply(r,200,json!({"ok":true,"scope":"installed-only","providers":[{"id":"codex","label":"Codex","installed":codex.is_some()},{"id":"claude","label":"Claude Code","installed":claude.is_some()}]}));return;}
 if path.starts_with("/api/"){
  if path=="/api/ai/auth/claude/status" && r.method().as_str()=="GET" {reply(r,200,moro_ai_bridge::auth::status(claude.as_deref(),&jobs.auth_cancel,std::time::Duration::from_secs(5)));return;}
  if r.method().as_str()=="POST" && (header(&r,"X-Moro-Request")!=Some("1") || header(&r,"Content-Type").is_none_or(|v|v.split(';').next().unwrap_or("").trim()!="application/json")){error(r,403,"forbidden");return;}
  if path=="/api/ai/auth/claude/login" && r.method().as_str()=="POST" {
   let Some(bytes)=body(&mut r) else{error(r,400,"invalid_request");return;};
   if let Err(e)=moro_ai_bridge::auth::consent(&bytes){error(r,400,e);return;}
   match moro_ai_bridge::auth::login(claude.as_deref(),handoff.as_deref(),jobs){Ok(v)=>reply(r,202,v),Err((code,e))=>error(r,code,e)}return;
  }
  if path=="/api/ai/harness/preflight" && r.method().as_str()=="POST" {
   #[derive(serde::Deserialize)] #[serde(deny_unknown_fields)] struct Preflight {provider:String,brief:String,domain:moro_ai_bridge::harness::Domain}
   let Some(bytes)=body(&mut r) else{error(r,400,"invalid_request");return;};
   let Ok(req)=serde_json::from_slice::<Preflight>(&bytes) else{error(r,400,"invalid_request");return;};
   if !matches!(req.provider.as_str(),"codex"|"claude")||req.brief.trim().is_empty()||req.brief.trim().chars().count()>4000{error(r,400,"invalid_request");return;}
   let task=moro_ai_bridge::harness::Task{provider:req.provider,brief:req.brief.trim().into(),domain:req.domain};
   match moro_ai_bridge::harness::preflight(&task){Ok(mut pre)=>{pre["callBudget"]=json!(7);reply(r,200,json!({"ok":true,"preflight":pre}));},Err(_)=>error(r,400,"invalid_request")}return;
  }
  if path=="/api/ai/harness/jobs" && r.method().as_str()=="POST" {
   #[derive(serde::Deserialize)] #[serde(rename_all="camelCase",deny_unknown_fields)] struct Run{provider:String,brief:String,domain:moro_ai_bridge::harness::Domain,consent:bool,call_budget:usize}
   let Some(bytes)=body(&mut r) else{error(r,400,"invalid_request");return;};let Ok(req)=serde_json::from_slice::<Run>(&bytes) else{error(r,400,"invalid_request");return;};
   if !matches!(req.provider.as_str(),"codex"|"claude")||req.brief.trim().is_empty()||req.brief.trim().chars().count()>4000{error(r,400,"invalid_request");return;}
   if !req.consent||req.call_budget!=7{error(r,400,"consent_exact_7_required");return;}
   let task=moro_ai_bridge::harness::Task{provider:req.provider.clone(),brief:req.brief.trim().into(),domain:req.domain};
   if moro_ai_bridge::harness::preflight(&task).is_ok_and(|p|p["status"]=="blocked"){error(r,400,"unsupported_domain");return;}
   let exe=if req.provider=="codex"{codex}else{claude};let Some(exe)=exe else{error(r,503,"provider_unavailable");return;};
   match jobs.start_harness(task,exe.clone(),true,7){Ok(id)=>reply(r,202,json!({"ok":true,"job":{"id":id,"status":"running","provider":req.provider,"kind":"harness"}})),Err(e)=>error(r,409,e)}return;
  }
  if path=="/api/ai/director/jobs" && r.method().as_str()=="POST" {
   let Some(bytes)=body(&mut r) else{error(r,400,"invalid_request");return;};
   let req=match moro_ai_bridge::provider_director::request(&bytes){Ok(req)=>req,Err(e)=>{error(r,400,e);return;}};
   let exe=if req.provider=="codex"{codex}else{claude};let Some(exe)=exe else{error(r,503,"provider_unavailable");return;};
   let provider=req.provider.clone();match jobs.start_director(req,exe.clone()){Ok(id)=>reply(r,202,json!({"ok":true,"job":{"id":id,"status":"running","provider":provider,"kind":"director"}})),Err(e)=>error(r,409,e)}return;
  }
  if path=="/api/ai/v2/jobs" && r.method().as_str()=="POST" {
   let Some(bytes)=body(&mut r) else{error(r,400,"invalid_request");return;};
   let req=match moro_ai_bridge::provider_v2::request(&bytes){Ok(req)=>req,Err(e)=>{error(r,400,e);return;}};
   let exe=if req.provider=="codex"{codex}else{claude};let Some(exe)=exe else{error(r,503,"provider_unavailable");return;};
   match jobs.start_v2(req.provider,exe.clone(),req.prompt){Ok(id)=>reply(r,202,json!({"ok":true,"job":{"id":id,"status":"running"}})),Err(e)=>error(r,409,e)}return;
  }
  if path=="/api/ai/jobs" && r.method().as_str()=="POST" {
   #[derive(serde::Deserialize)] #[serde(deny_unknown_fields)] struct Generate{provider:String,prompt:String,#[serde(rename="baseProject",default,deserialize_with="present")] base_project:Option<serde_json::Value>,#[serde(rename="contextConsent",default,deserialize_with="present")] context_consent:Option<serde_json::Value>}
   fn present<'de,D:serde::Deserializer<'de>>(d:D)->Result<Option<serde_json::Value>,D::Error>{serde::Deserialize::deserialize(d).map(Some)}
   let Some(body)=body(&mut r) else{error(r,400,"invalid_request");return;};let Ok(req)=serde_json::from_slice::<Generate>(&body) else{error(r,400,"invalid_request");return;};
   if req.base_project.is_some() || req.context_consent.is_some() {
    if req.base_project.is_none() || req.context_consent.as_ref()!=Some(&serde_json::Value::Bool(true)){error(r,400,"context_consent_required");return;}
    if let Err(e)=moro_ai_bridge::validate_context(req.base_project.as_ref().unwrap()){error(r,400,e);return;}
   }
   let trimmed=req.prompt.trim();if trimmed.is_empty() || trimmed.chars().count()>4000{error(r,400,"invalid_request");return;}
   let prompt=if req.base_project.is_some(){req.prompt}else{trimmed.to_string()};
   let exe=match req.provider.as_str(){"codex"=>codex,"claude"=>claude,_=>{error(r,400,"unsupported_provider");return;}};
   let Some(exe)=exe else{error(r,503,"provider_unavailable");return;};
   match jobs.start_with_context(req.provider,exe.clone(),prompt,req.base_project){Ok(id)=>reply(r,202,json!({"ok":true,"job":{"id":id,"status":"running"}})),Err(e)=>error(r,409,e)}return;
  }
  if let Some(suffix)=path.strip_prefix("/api/ai/jobs/") {
   if r.method().as_str()=="POST" && suffix.ends_with("/cancel"){
    let Some(bytes)=body(&mut r) else{error(r,400,"invalid_request");return;};if serde_json::from_slice::<serde_json::Value>(&bytes).ok()!=Some(json!({})){error(r,400,"invalid_request");return;}
    if let Some(job)=jobs.cancel(suffix.trim_end_matches("/cancel")){reply(r,200,json!({"ok":true,"job":job}));}else{error(r,404,"not_found");}return;
   }
   if r.method().as_str()=="GET" && !suffix.contains('/') {if let Some(job)=jobs.get(suffix){reply(r,200,json!({"ok":true,"job":job}));}else{error(r,404,"not_found");}return;}
  }
  error(r,404,"not_found");return;
 }
 if !matches!(r.method().as_str(),"GET"|"HEAD"){error(r,405,"method_not_allowed");return;}
 if path.contains('%') || path.contains('\\') || path.split('/').any(|c|c=="."||c=="..") {error(r,404,"not_found");return;}
 let file=if matches!(path.as_str(),"/"|"/create"|"/create/"|"/rig"|"/rig/"|"/studio"|"/studio/"){root.join("index.html")}else{root.join(path.trim_start_matches('/'))};
 let Ok(file)=file.canonicalize() else {error(r,404,"not_found");return;};if !file.starts_with(root) || !file.is_file(){error(r,404,"not_found");return;}
 let mime=match file.extension().and_then(|s|s.to_str()){Some("html")=>"text/html; charset=utf-8",Some("js"|"mjs")=>"text/javascript",Some("css")=>"text/css",Some("json")=>"application/json",Some("svg")=>"image/svg+xml",Some("png")=>"image/png",Some("woff2")=>"font/woff2",_=>"application/octet-stream"};
 if let Ok(f)=std::fs::File::open(file){let _=r.respond(Response::from_file(f).with_header(Header::from_bytes("Content-Type",mime).unwrap()).with_header(Header::from_bytes("X-Content-Type-Options","nosniff").unwrap()));}else{error(r,404,"not_found");}
}
fn body(r:&mut Request)->Option<Vec<u8>>{use std::io::Read;if r.body_length().is_some_and(|n|n>moro_ai_bridge::MAX_REQUEST){return None;}let mut b=Vec::new();r.as_reader().take((moro_ai_bridge::MAX_REQUEST+1) as u64).read_to_end(&mut b).ok()?;if b.len()>moro_ai_bridge::MAX_REQUEST{None}else{Some(b)}}
static STOP:std::sync::atomic::AtomicBool=std::sync::atomic::AtomicBool::new(false);
extern "C" fn stop(_:i32){STOP.store(true,std::sync::atomic::Ordering::SeqCst);}
fn resolve(value:&str)->Option<PathBuf>{if value.contains('/') {return Path::new(value).canonicalize().ok().filter(|p|p.is_file());}std::env::split_paths(&std::env::var_os("PATH")?).map(|p|p.join(value)).find_map(|p|p.canonicalize().ok().filter(|p|p.is_file()))}
fn run()->Result<(),()> {let mut root=None;let mut port=4174u16;let mut codex="codex".to_string();let mut claude="claude".to_string();let mut handoff=None;let mut args=std::env::args().skip(1);while let Some(a)=args.next(){match a.as_str(){"--web-root"=>root=Some(PathBuf::from(args.next().ok_or(())?)),"--port"=>{port=args.next().ok_or(())?.parse().map_err(|_|())?;if port==0{return Err(());}},"--codex-bin"=>codex=args.next().ok_or(())?,"--claude-bin"=>claude=args.next().ok_or(())?,"--auth-handoff-bin"=>{handoff=Some(resolve(&args.next().ok_or(())?).ok_or(())?);},"--help"=>{println!("moro-ai-bridge --web-root /path/to/dist [--port 4174] [--codex-bin /reviewed/official/codex] [--claude-bin /reviewed/official/claude] [--auth-handoff-bin /reviewed/launcher]");return Ok(());},_=>return Err(())}}
 let root=Arc::new(root.ok_or(())?.canonicalize().map_err(|_|())?);if !root.join("index.html").is_file(){return Err(());}let codex=Arc::new(resolve(&codex));let claude=Arc::new(resolve(&claude));let server=Arc::new(Server::http(("127.0.0.1",port)).map_err(|_|())?);
 let handoff=Arc::new(handoff);let mut workers=Vec::new();let jobs=moro_ai_bridge::jobs::Jobs::new();unsafe{libc::signal(libc::SIGTERM,stop as *const () as libc::sighandler_t);libc::signal(libc::SIGINT,stop as *const () as libc::sighandler_t);}
 for _ in 0..4 {let(s,r,c,a,j,h)=(server.clone(),root.clone(),codex.clone(),claude.clone(),jobs.clone(),handoff.clone());workers.push(std::thread::spawn(move||while !STOP.load(std::sync::atomic::Ordering::SeqCst){if let Ok(Some(req))=s.recv_timeout(std::time::Duration::from_millis(100)){serve(req,&r,port,&c,&a,&j,&h)}}));}
 while !STOP.load(std::sync::atomic::Ordering::SeqCst){std::thread::sleep(std::time::Duration::from_millis(50));}jobs.shutdown();for worker in workers{let _=worker.join();}Ok(())
}
fn main(){if run().is_err(){eprintln!("Bridge setup failed. Check web root, loopback port and reviewed executable configuration.");std::process::exit(1);}}
