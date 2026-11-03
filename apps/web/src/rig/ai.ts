import { parseProjectV2, exportLottieV2, serializeProjectV2 } from '../../../../packages/creator-core/src/v2';
import type { ProjectV2 } from '../../../../packages/creator-core/src/v2';
import { AiClient, safeError } from '../creator/ai/client';
import { generationObservationMs } from '../generation-policy';
import type { Fetcher, ProviderId, JobStatus } from '../creator/ai/client';
import type { History } from './history';

const INVALID='The AI response was invalid. Your Rig project is unchanged.';
function record(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error(INVALID);
 return value as Record<string,unknown>;
}
function jobId(value:unknown):string{
 if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,200}$/.test(value))throw Error(INVALID);
 return value;
}
function status(value:unknown):JobStatus{
 if(value!=='running'&&value!=='succeeded'&&value!=='failed'&&value!=='cancelled')throw Error(INVALID);
 return value;
}
export function validateRigCandidate(value:unknown){
 const text=JSON.stringify(value);
 if(!text)throw Error(INVALID);
 const project=parseProjectV2(text);
 // The real exporter enforces byte and complexity budgets. Never preview a repair/fallback.
 const animation=exportLottieV2(project);
 return {project,animation};
}
export type RigCandidate=ReturnType<typeof validateRigCandidate>;
export function prepareRigAiApply(history:History<ProjectV2>,expected:string,value:unknown):ProjectV2{
 if(history.gesture)throw Error('Finish the active gesture before applying this proposal.');
 const current=serializeProjectV2(history.present);
 if(current!==expected)throw Error('Your project changed after this request. Generate a fresh proposal before applying.');
 const {project}=validateRigCandidate(value);
 if(serializeProjectV2(project)===current)throw Error('No changes proposed. Project and Undo history are unchanged.');
 return project;
}
export class RigAiClient{
 constructor(readonly fetcher:Fetcher=globalThis.fetch.bind(globalThis)){}
 status(){return new AiClient(this.fetcher).status();}
 private async request(path:string,body?:unknown){
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  const transport='The local AI bridge did not respond. The request may still be running; check the bridge before retrying. Your project is unchanged.';
  const work=async()=>{
   let response:Response;
   try{response=await this.fetcher(path,{method:body===undefined?'GET':'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json','X-Moro-Request':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
   catch{throw Error(transport);}
   let data:Record<string,unknown>;
   try{const text=await response.text();if(new TextEncoder().encode(text).length>8*1024*1024+65536)throw Error();data=record(JSON.parse(text));}
   catch{throw Error(INVALID);}
   if(!response.ok||data.ok!==true){const error=record(data.error);throw Error(safeError(typeof error.code==='string'?error.code:'unknown'));}
   return data;
  };
  try{return await Promise.race([work(),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error(transport));},10000);})]);}
  finally{clearTimeout(timer);}
 }
 async start(provider:ProviderId,brief:string,consent:boolean){
  const prompt=brief.trim();
  if(consent!==true||!prompt||Array.from(prompt).length>4000||!['codex','claude'].includes(provider))throw Error('Choose a provider, write a brief of 1–4000 characters and agree before sending.');
  const job=record((await this.request('/api/ai/v2/jobs',{provider,prompt,consent:true})).job);
  if(job.status!=='running')throw Error(INVALID);
  return jobId(job.id);
 }
 async cancel(id:string){
  const job=record((await this.request(`/api/ai/jobs/${encodeURIComponent(jobId(id))}/cancel`,{})).job);
  if(job.id!==id)throw Error(INVALID);return status(job.status);
 }
 async poll(id:string,provider:ProviderId){
  const job=record((await this.request(`/api/ai/jobs/${encodeURIComponent(jobId(id))}`)).job);
  if(job.id!==id||job.provider!==provider)throw Error(INVALID);
  const phase=status(job.status);
  return {status:phase,...(phase==='succeeded'?{candidate:validateRigCandidate(job.project)}:{}),...(phase==='failed'?{message:safeError(typeof record(job.error).code==='string'?String(record(job.error).code):'unknown')}: {})};
 }
}
export type RigAiState={phase:'idle'|'running'|'cancelling'|'review'|'cancelled'|'failed'|'applied';active:boolean;candidate?:RigCandidate;expected?:string;provider?:ProviderId;submittedBrief?:string;message?:string;startedAt?:number};
type Run={id?:string;cancelled:boolean;deadline?:ReturnType<typeof setTimeout>;wake?:()=>void;cancellation?:Promise<void>;reason?:string};
export class RigAiSession{
 state:RigAiState={phase:'idle',active:false};
 private disposed=false;private run?:Run;
 constructor(readonly client:RigAiClient,readonly emit:(state:RigAiState)=>void){}
 private update(next:RigAiState){this.state=next;if(!this.disposed)this.emit(next);}
 private current(run:Run){return this.run===run&&!run.cancelled&&!this.disposed;}
 private finish(run:Run,next:RigAiState){clearTimeout(run.deadline);run.wake?.();if(this.run===run)this.update(next);}
 async generate(provider:ProviderId,prompt:string,consent:boolean,expected:string){
  if(this.disposed||this.state.active)return;
  const run:Run={cancelled:false};this.run=run;
  const context={provider,submittedBrief:prompt.trim(),expected,startedAt:Date.now()};
  this.update({phase:'running',active:true,...context});
  run.deadline=setTimeout(()=>{void this.cancel('Generation observation timed out. Your Rig project is unchanged.');},generationObservationMs(provider));
  try{
   // expected stays local. Only provider/prompt/consent cross the HTTP boundary.
   run.id=await this.client.start(provider,prompt,consent);
   if(!this.current(run)){await this.stop(run);return;}
   while(this.current(run)){
    const job=await this.client.poll(run.id,provider);
    if(!this.current(run))return;
    if(job.status==='running'){
     await new Promise<void>(resolve=>{const timer=setTimeout(resolve,1000);run.wake=()=>{clearTimeout(timer);resolve();};});continue;
    }
    this.finish(run,{phase:job.status==='succeeded'?'review':job.status==='cancelled'?'cancelled':'failed',active:false,...context,candidate:job.candidate,message:job.message});return;
   }
  }catch(error){
   if(this.run===run&&run.cancelled&&!run.id){this.finish(run,{phase:run.reason?'failed':'cancelled',active:false,message:run.reason||'Generation cancelled. Your Rig project is unchanged.'});return;}
   if(!this.current(run))return;
   const message=error instanceof Error?error.message:'Generation failed. Your Rig project is unchanged.';
   if(run.id)await this.cancel(message);else this.finish(run,{phase:'failed',active:false,...context,message});
  }
 }
 private async stop(run:Run):Promise<void>{
  if(!run.id)return;
  if(run.cancellation)return run.cancellation;
  run.cancellation=(async()=>{
   try{
    if(await this.client.cancel(run.id!)==='running')throw Error();
    this.finish(run,{phase:run.reason?'failed':'cancelled',active:false,message:run.reason||'Generation cancelled. Your Rig project is unchanged.'});
   }catch{if(this.run===run)this.update({phase:'failed',active:true,message:'Cancellation could not be confirmed. Retry Cancel generation. No proposal will be applied.'});}
   finally{run.cancellation=undefined;}
  })();return run.cancellation;
 }
 async cancel(reason?:string){
  const run=this.run;if(!run||!this.state.active)return;
  run.cancelled=true;run.reason=reason;clearTimeout(run.deadline);run.wake?.();
  this.update({...this.state,phase:'cancelling',candidate:undefined,message:reason||'Cancelling generation…'});await this.stop(run);
 }
 apply(callback:(project:ProjectV2,expected:string)=>unknown){
  if(this.disposed||this.state.phase!=='review'||!this.state.candidate||this.state.expected===undefined)return;
  try{
   const candidate=validateRigCandidate(this.state.candidate.project);
   if(callback(candidate.project,this.state.expected)===false)throw Error('Proposal was not applied. Your Rig project is unchanged.');
   this.update({phase:'applied',active:false,message:'Applied AI proposal. One Undo restores the previous project. Save v2 project and Export Lottie use the existing editor controls.'});
  }catch(error){this.update({...this.state,message:error instanceof Error?error.message:INVALID});}
 }
 dispose(){this.disposed=true;void this.cancel();}
}
