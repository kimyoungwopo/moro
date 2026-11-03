//! Fixed native knowledge and strict report validation shared by CLI and HTTP jobs.
use std::{path::Path,sync::atomic::AtomicBool,time::Duration};
use serde_json::Value;
use crate::{harness::{self,KnowledgeSource},provider};
type Result<T> = std::result::Result<T,String>;
pub const MAX:usize=8*1024*1024;
const KNOWLEDGE:[(&str,&str);3]=[
("skills/lottie-authoring/references/harness-quality.md",include_str!("../../skills/lottie-authoring/references/harness-quality.md")),
("skills/lottie-authoring/references/character-quality.md",include_str!("../../skills/lottie-authoring/references/character-quality.md")),
("skills/lottie-authoring/references/motion-principles.md",include_str!("../../skills/lottie-authoring/references/motion-principles.md"))];
pub fn hash(bytes:&[u8])->Result<String>{if bytes.len()>MAX{return Err("hash_input_too_large".into());}let (exe,args)=if cfg!(target_os="macos"){("/usr/bin/shasum",vec!["-a".into(),"256".into()])}else{("/usr/bin/sha256sum",vec![])};let (ok,out,_)=provider::capture(Path::new(exe),&args,&std::env::current_dir().map_err(|_|"cwd_unavailable")?,bytes,&AtomicBool::new(false),Duration::from_secs(5)).map_err(|_|"hash_unavailable")?;let out=std::str::from_utf8(&out).map_err(|_|"invalid_hash")?;let h=out.split_whitespace().next().ok_or("invalid_hash")?;if !ok||h.len()!=64||!h.bytes().all(|b|b.is_ascii_hexdigit()&&!b.is_ascii_uppercase()){return Err("invalid_hash".into());}Ok(h.into())}
pub fn sources()->Result<Vec<KnowledgeSource>>{let mut s=vec![];for (path,content) in KNOWLEDGE{if content.trim().is_empty(){return Err("empty_knowledge".into());}s.push(KnowledgeSource{path:path.into(),content:content.into(),sha256:hash(content.as_bytes())?});}if serde_json::to_vec(&s).map_err(|_|"invalid_knowledge")?.len()>24576{return Err("knowledge_too_large".into());}Ok(s)}
fn exact(v:&Value,keys:&[&str])->Result<()>{let o=v.as_object().ok_or("invalid_report_object")?;if o.len()!=keys.len()||keys.iter().any(|k|!o.contains_key(*k)){return Err("unknown_or_missing_report_field".into());}Ok(())}
pub fn validate_report(v:&Value)->Result<harness::Report>{
 exact(v,&["schemaVersion","upstream","task","status","blockers","sources","stages","modelCalls","callBudget","artisticReview","project","guidance"])?;
 let r:harness::Report=serde_json::from_value(v.clone()).map_err(|_|"invalid_report")?;
 if r.schema_version!=1||r.artistic_review!="not_reviewed"||r.call_budget!=7||!matches!(r.task.provider.as_str(),"codex"|"claude")||r.task.brief.chars().count()>4000{return Err("invalid_report_header".into());}
 let pre=harness::preflight(&r.task)?;
 exact(&r.upstream,&["repo","revision","adaptation"])?;
 if r.upstream["repo"]!="https://github.com/google-research/harness2"||r.upstream["revision"]!="1cfe254e8d25b15f37048c3730134686abe60335"||r.upstream["adaptation"]!="Rust k=1 sequential Propose–Probe–Compose; fixed tools, data-only guidance, no retries; not original Python engine"{return Err("invalid_upstream".into());}
 if r.sources.len()!=KNOWLEDGE.len(){return Err("invalid_sources".into());}
 for (s,(path,content)) in r.sources.iter().zip(KNOWLEDGE){if s.path!=path||s.content!=content||s.sha256!=hash(s.content.as_bytes())?{return Err("invalid_source_fingerprint".into());}}
 if serde_json::to_vec(&r.sources).map_err(|_|"invalid_sources")?.len()>24576{return Err("source_pack_too_large".into());}
 let ids=["base","propose-invariant","propose-domain","probe-invariant","probe-domain","compose","final"];
 let kinds=["project","guidance","guidance","project","project","guidance","project"];
 if r.stages.len()>7{return Err("too_many_stages".into());}
 let mut calls=0;let mut failed=false;let mut composed=None;let mut final_project=None;
 for (i,s) in r.stages.iter().enumerate(){
  if s["id"]!=ids[i]||s["kind"]!=kinds[i]{return Err("invalid_stage_order_or_kind".into());}
  let attempted=s["attempted"].as_bool().ok_or("invalid_attempted")?;if attempted{calls+=1;}
  match s["status"].as_str(){
   Some("succeeded")=>{exact(s,&["id","kind","attempted","status","data"])?;if !attempted{return Err("unattempted_success".into());}if kinds[i]=="guidance"{harness::validate_guidance(&s["data"])?;}else{crate::validate_project(&s["data"]).map_err(str::to_string)?;if serde_json::to_vec(&s["data"]).map_err(|_|"invalid_project")?.len()>65536{return Err("project_too_large".into());}}if i==5{composed=Some(s["data"].clone());}if i==6{final_project=Some(s["data"].clone());}},
   Some("failed")=>{exact(s,&["id","kind","attempted","status","errorCode"])?;if i+1!=r.stages.len(){return Err("stages_after_failure".into());}let code=s["errorCode"].as_str().ok_or("invalid_failure")?;if (kinds[i]=="project"&&matches!(code,"invalid_guidance"|"guidance_too_large"))||(kinds[i]=="guidance"&&matches!(code,"invalid_project"|"project_too_large")){return Err("failure_kind_mismatch".into());}if !["executor_failed","invalid_project","project_too_large","invalid_guidance","guidance_too_large","prompt_too_large"].contains(&code)||attempted==(code=="prompt_too_large"){return Err("invalid_failure".into());}if r.blockers!=vec![code.to_string()]{return Err("inconsistent_blockers".into());}failed=true;},
   _=>return Err("invalid_stage_status".into())
  }
 }
 if calls!=r.model_calls||r.guidance!=composed||r.project!=final_project{return Err("inconsistent_report_evidence".into());}
 match r.status.as_str(){
  "review_required" if pre["status"]=="ready"&&r.stages.len()==7&&calls==7&&!failed&&r.blockers.is_empty()=>{},
  "failed" if pre["status"]=="ready"&&failed&&r.project.is_none()=>{},
  "blocked" if pre["status"]=="blocked"&&r.stages.is_empty()&&calls==0&&serde_json::to_value(&r.blockers).map_err(|_|"invalid_blockers")?==pre["blockers"]=>{},
  _=>return Err("inconsistent_report_status".into())
 }
 Ok(r)
}
