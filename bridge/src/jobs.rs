use std::{collections::VecDeque,path::PathBuf,sync::{Arc,Mutex,atomic::{AtomicBool,AtomicU64,Ordering}},thread::JoinHandle,time::{Duration,Instant}};
use serde_json::{Value,json};
use crate::harness::{self,Task,OutputKind,Executor};
struct Job { id:String, provider:String, status:&'static str, cancel:Arc<AtomicBool>, project:Option<Value>, error:Option<&'static str>, kind:&'static str, stage:Option<String>, report:Option<Value>, proposal:Option<Value> }
impl Job {fn value(&self)->Value{let mut v=json!({"id":self.id,"provider":self.provider,"status":self.status,"kind":self.kind});if let Some(p)=&self.proposal{v["proposal"]=p.clone();}if let Some(s)=&self.stage{v["stage"]=json!(s);}if let Some(r)=&self.report{v["report"]=r.clone();}if let Some(p)=&self.project{v["project"]=p.clone();}if let Some(e)=self.error{v["error"]=json!({"code":e,"message":guidance(e)});}v}}
struct State{closed:bool,jobs:VecDeque<Job>,active:Option<String>,worker:Option<JoinHandle<()>>,auth_reserved:bool,auth_until:Option<Instant>}
pub struct Jobs{state:Mutex<State>,counter:AtomicU64,pub auth_cancel:AtomicBool}
/// Short admission token. Never holds the mutex across an owned subprocess.
pub struct AuthReservation{jobs:Arc<Jobs>}
impl AuthReservation {
 pub fn launching(&self)->Result<(),&'static str>{let mut s=self.jobs.state.lock().unwrap();if s.closed{return Err("busy");}s.auth_until=Some(Instant::now()+Duration::from_secs(30));Ok(())}
}
impl Drop for AuthReservation{fn drop(&mut self){self.jobs.state.lock().unwrap().auth_reserved=false;}}
enum Work{Ordinary{prompt:String,base:Option<Value>},V2{prompt:String},Director(crate::provider_director::Request),Harness(Task)}
enum Output{Project(Value),Report(Value),Proposal(Value)}
pub fn guidance(code:&str)->&'static str{match code{"needs_login"=>"Open the selected official CLI and sign in, then try again.","cli_update_required"=>"Update the selected official CLI to a supported version, then try again.","provider_unavailable"=>"Install the selected official CLI and restart the bridge.","timeout_thinking"=>"Generation timed out while the provider was thinking. No proposal was returned.","timeout_writing"=>"Generation timed out while the provider was writing structured output. No proposal was returned.","timeout_waiting"=>"Generation timed out while waiting for a validated provider result. No proposal was returned.","invalid_provider_schema"=>"The official CLI could not initialize the required structured output schema. Update the CLI or review the bridge setup.","timeout"=>"Generation timed out. Try a shorter brief.","output_limit"=>"The CLI response exceeded the safe size limit. Try a simpler brief.","busy"=>"Another generation is still running or cleaning up. Wait or cancel it first.","invalid_project"|"invalid_output"|"invalid_report"=>"The CLI did not return a valid proposal or review report. Try a simpler brief.","unsafe_output"=>"The CLI produced a blocked tool or diagnostic event. Update the CLI or review the bridge setup.",_=>"Generation failed safely. Check the official CLI setup and try again."}}
impl Jobs {
 pub fn new()->Arc<Self>{Arc::new(Self{state:Mutex::new(State{closed:false,jobs:VecDeque::new(),active:None,worker:None,auth_reserved:false,auth_until:None}),counter:AtomicU64::new(1),auth_cancel:AtomicBool::new(false)})}
 pub fn reserve_auth(self:&Arc<Self>)->Result<AuthReservation,&'static str>{let mut s=self.state.lock().unwrap();if s.closed||s.active.is_some(){return Err("busy");}if s.auth_reserved||s.auth_until.is_some_and(|t|t>Instant::now()){return Err("auth_handoff_pending");}s.auth_reserved=true;Ok(AuthReservation{jobs:self.clone()})}
 pub fn get(&self,id:&str)->Option<Value>{self.state.lock().unwrap().jobs.iter().find(|j|j.id==id).map(Job::value)}
 pub fn cancel(&self,id:&str)->Option<Value>{let mut state=self.state.lock().unwrap();let j=state.jobs.iter_mut().find(|j|j.id==id)?;if j.status=="running"{j.cancel.store(true,Ordering::SeqCst);j.status="cancelled";j.project=None;j.report=None;j.proposal=None;j.error=None;}Some(j.value())}
 pub fn start(self:&Arc<Self>,provider:String,exe:PathBuf,prompt:String)->Result<String,&'static str>{self.start_with_context(provider,exe,prompt,None)}
 pub fn start_with_context(self:&Arc<Self>,provider:String,exe:PathBuf,prompt:String,base_project:Option<Value>)->Result<String,&'static str>{
  if let Some(p)=&base_project{crate::validate_context(p)?;}
  self.admit(provider,exe,Work::Ordinary{prompt,base:base_project})
 }
 pub fn start_v2(self:&Arc<Self>,provider:String,exe:PathBuf,prompt:String)->Result<String,&'static str>{
  crate::provider_v2::validate_brief(&provider,&prompt)?;
  self.admit(provider,exe,Work::V2{prompt})
 }
 pub fn start_director(self:&Arc<Self>,req:crate::provider_director::Request,exe:PathBuf)->Result<String,&'static str>{
  crate::provider_director::validate_request(&req)?;
  self.admit(req.provider.clone(),exe,Work::Director(req))
 }
 pub fn start_harness(self:&Arc<Self>,task:Task,exe:PathBuf,consent:bool,call_budget:usize)->Result<String,&'static str>{
  if !consent||call_budget!=7{return Err("consent_exact_7_required");}
  if !matches!(task.provider.as_str(),"codex"|"claude")||task.brief.trim().is_empty()||task.brief.chars().count()>4000{return Err("invalid_request");}
  if harness::preflight(&task).map_err(|_|"invalid_request")?["status"]!="ready"{return Err("unsupported_domain");}
  self.admit(task.provider.clone(),exe,Work::Harness(task))
 }
 fn admit(self:&Arc<Self>,provider:String,exe:PathBuf,work:Work)->Result<String,&'static str>{
  let mut state=self.state.lock().unwrap();if state.closed{return Err("shutting_down");}if state.active.is_some()||state.auth_reserved{return Err("busy");}
  let previous=state.worker.take();let id=format!("j{}-{}",std::process::id(),self.counter.fetch_add(1,Ordering::Relaxed));let cancel=Arc::new(AtomicBool::new(false));
  let kind=match &work{Work::Harness(_)=>"harness",Work::Director(_)=>"director",_=>"provider"};let stage=if let Work::Director(r)=&work{Some(r.stage.clone())}else{None};
  state.jobs.push_back(Job{id:id.clone(),provider:provider.clone(),status:"running",cancel:cancel.clone(),project:None,error:None,kind,stage,report:None,proposal:None});state.active=Some(id.clone());let me=self.clone();let worker_id=id.clone();
  state.worker=Some(std::thread::spawn(move||{
   if let Some(h)=previous{let _=h.join();}
   let result=std::panic::catch_unwind(||match work {
    Work::Ordinary{prompt,base}=>crate::provider::generate_with_context(&provider,&exe,&prompt,base.as_ref(),&cancel,Duration::from_secs(180)).map(Output::Project),
    Work::V2{prompt}=>crate::provider_v2::generate(&provider,&exe,&prompt,&cancel,Duration::from_secs(180)).map(Output::Project),
    Work::Director(req)=>crate::provider_director::generate(&req,&exe,&cancel,Duration::from_secs(180)).map(Output::Proposal),
    Work::Harness(task)=>me.run_harness(&worker_id,task,&exe,&cancel).map(Output::Report)
   }).unwrap_or(Err("worker_failed"));
   let mut state=me.state.lock().unwrap();if let Some(j)=state.jobs.iter_mut().find(|j|j.id==worker_id){if j.cancel.load(Ordering::SeqCst){j.status="cancelled";j.project=None;j.report=None;j.proposal=None;j.error=None;}else{match result{Ok(Output::Project(p))=>{j.status="succeeded";j.project=Some(p);},Ok(Output::Report(r))=>{j.status="succeeded";j.report=Some(r);},Ok(Output::Proposal(p))=>{j.status="succeeded";j.proposal=Some(p);},Err(e)=>{j.status="failed";j.error=Some(e);}}}}
   // All subprocess owners/workspaces have dropped before the shared slot is released.
   state.active=None;
   while state.jobs.iter().filter(|j|j.status!="running").count()>16 {if let Some(i)=state.jobs.iter().position(|j|j.status!="running"){state.jobs.remove(i);}}
  }));Ok(id)
 }
 fn run_harness(&self,id:&str,task:Task,exe:&std::path::Path,cancel:&AtomicBool)->Result<Value,&'static str>{
  let sources=crate::harness_native::sources().map_err(|_|"invalid_report")?;
  let mut executor=AppExecutor{jobs:self,id,provider:task.provider.clone(),exe,cancel,started:Instant::now(),error:None};
  let report=harness::run(&harness::Request{task,consent:true,call_budget:7},&sources,&mut executor).map_err(|_|"invalid_report")?;
  if cancel.load(Ordering::SeqCst){return Err("cancelled");}
  let value=serde_json::to_value(&report).map_err(|_|"invalid_report")?;
  if serde_json::to_vec(&value).map_err(|_|"invalid_report")?.len()>crate::harness_native::MAX{return Err("invalid_report");}
  crate::harness_native::validate_report(&value).map_err(|_|"invalid_report")?;
  if report.status!="review_required"{return Err(executor.error.unwrap_or("invalid_output"));}
  Ok(value)
 }
 pub fn shutdown(&self){self.auth_cancel.store(true,Ordering::SeqCst);let worker={let mut s=self.state.lock().unwrap();s.closed=true;for j in &mut s.jobs{if j.status=="running"{j.cancel.store(true,Ordering::SeqCst);j.status="cancelled";j.project=None;j.report=None;j.proposal=None;}}s.worker.take()};if let Some(h)=worker{let _=h.join();}}
}
struct AppExecutor<'a>{jobs:&'a Jobs,id:&'a str,provider:String,exe:&'a std::path::Path,cancel:&'a AtomicBool,started:Instant,error:Option<&'static str>}
impl Executor for AppExecutor<'_>{
 fn invoke(&mut self,stage:&str,kind:OutputKind,prompt:&str)->Result<Value,String>{
  if self.cancel.load(Ordering::SeqCst){return Err("cancelled".into());}
  {let mut state=self.jobs.state.lock().unwrap();if let Some(j)=state.jobs.iter_mut().find(|j|j.id==self.id){if j.status!="running"{return Err("cancelled".into());}j.stage=Some(stage.into());}}
  let timeout=Duration::from_secs(7*180).checked_sub(self.started.elapsed()).filter(|d|!d.is_zero()).ok_or("timeout")?.min(Duration::from_secs(180));
  let result=match kind{OutputKind::Project=>crate::provider::generate(&self.provider,self.exe,prompt,self.cancel,timeout),OutputKind::Guidance=>crate::provider::generate_guidance(&self.provider,self.exe,prompt,self.cancel,timeout)};
  result.map_err(|e|{self.error=Some(e);e.to_string()})
 }
}
