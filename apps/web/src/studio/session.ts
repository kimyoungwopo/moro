import type { ProjectV3 } from '../../../../packages/creator-core/src/v3';
import { generationObservationMs } from '../generation-policy';
export type Stage = 'style'|'poses'|'motion';
export type Provider = 'codex'|'claude';
export type DirectorProposal={version:1;stage:Stage;summary:string;review:{focalPoint:string;silhouette:string;material:string;choreography:string;limitations:string};poses:{frame:number;label:string}[];project:ProjectV3};
export type ValidateProposal=(value:unknown,stage:Stage,approved:DirectorProposal|null)=>DirectorProposal;
const invalid='응답 형식이 올바르지 않아요. 문서와 실행 취소 기록은 유지돼요.';
function generationFailure(value:unknown):string{
 const messages:Record<string,string>={
  timeout:'제한 시간 안에 검증된 제안을 받지 못했어요. 문서는 유지돼요.',
  timeout_thinking:'Claude가 추론 중에 생성 제한 시간에 도달했어요. 제안은 적용되지 않았고 문서는 유지돼요.',
  timeout_writing:'Claude가 제안을 작성하던 중 제한 시간에 도달했어요. 완성되지 않은 제안은 적용하지 않았어요.',
  timeout_waiting:'CLI 응답을 기다리다 생성 제한 시간에 도달했어요. 문서는 유지돼요.',
  invalid_provider_schema:'Claude가 제안 출력 형식을 준비하지 못했어요. 로컬 브리지의 스키마 호환성을 확인해 주세요. 문서는 유지돼요.'
 };
 const code=value&&typeof value==='object'&&!Array.isArray(value)?(value as Record<string,unknown>).code:undefined;
 return typeof code==='string'&&Object.hasOwn(messages,code)?messages[code]:'생성이 완료되지 않았어요. 문서는 유지돼요.';
}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error(invalid);return value as Record<string,unknown>;}
function id(value:unknown):string{if(typeof value!=='string'||! /^[a-zA-Z0-9_-]{1,200}$/.test(value))throw Error(invalid);return value;}
export class DirectorClient {
 constructor(readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {}
 private async request(path:string,body?:unknown){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await this.fetcher(path,{method:body===undefined?'GET':'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json','X-Moro-Request':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
   const text=await response.text();if(new TextEncoder().encode(text).length>8*1024*1024+65536)throw Error(invalid);
   const data=object(JSON.parse(text));if(!response.ok||data.ok!==true)throw Error('로컬 AI 요청을 완료하지 못했어요. 자동 재시도하지 않아요. 브리지 상태를 확인해 주세요.');return object(data.job);
  }catch(error){if(error instanceof Error&&error.message.includes('않아요'))throw error;throw Error('브리지 응답을 확인하지 못했어요. 요청이 실행 중일 수 있으니 다시 생성하기 전에 확인해 주세요.',{cause:error});}
  finally{clearTimeout(timer);}
 }
 async start(provider:Provider,brief:string,consent:boolean,stage:Stage,approved:DirectorProposal|null,contextConsent:boolean):Promise<string>{
  const prompt=brief.trim();
  if(!['style','poses','motion'].includes(stage)||consent!==true||!prompt||Array.from(prompt).length>4000||!['codex','claude'].includes(provider))throw Error('제공자를 선택하고 1~4000자 브리프와 이번 호출 동의를 확인해 주세요.');
  if(stage==='style'?(approved!==null||contextConsent!==false):(contextConsent!==true||approved?.stage!==(stage==='poses'?'style':'poses')))throw Error('이전 단계를 명시적으로 수락하고 이전 제안 전송에 별도로 동의해 주세요.');
  const body={provider,prompt,consent:true,stage,approved,contextConsent};
  if(new TextEncoder().encode(JSON.stringify(body)).length>131072)throw Error('이전 제안을 포함한 요청 크기가 128 KiB(131072 바이트)를 초과해요. 전송하지 않았어요. 원본 제안·프로젝트를 저장할 수 있으며, 자동 축소·재시도하지 않아요.');
  if(approved!==null&&new TextEncoder().encode(JSON.stringify(approved)).length>65536)throw Error('이전 제안 크기가 브리지의 64 KiB(65536 바이트) 한도를 초과해요. 전송하지 않았어요. 원본 제안·프로젝트를 저장할 수 있으며, 자동 축소·재시도하지 않아요.');
  const job=await this.request('/api/ai/director/jobs',body);
  if(job.status!=='running'||job.provider!==provider||job.kind!=='director')throw Error(invalid);return id(job.id);
 }
 async poll(jobId:string,provider:Provider){const job=await this.request(`/api/ai/jobs/${encodeURIComponent(id(jobId))}`);if(job.id!==jobId||job.provider!==provider||job.kind!=='director'||!['running','succeeded','failed','cancelled'].includes(String(job.status)))throw Error(invalid);return job;}
 async cancel(jobId:string){const job=await this.request(`/api/ai/jobs/${encodeURIComponent(id(jobId))}/cancel`,{});if(job.id!==jobId||!['cancelled','failed','succeeded'].includes(String(job.status)))throw Error('취소를 확인하지 못했어요. 취소를 다시 확인해 주세요.');}
}
export type DirectorState={phase:'idle'|'running'|'cancelling'|'review'|'accepted'|'failed'|'cancelled'|'applied'|'stale';active:boolean;stage:Stage;proposal?:DirectorProposal;approved:DirectorProposal|null;expectedRevision?:number;previewed:boolean;message?:string;jobId?:string};
type Run={id?:string;cancelled:boolean;wake?:()=>void;deadline?:ReturnType<typeof setTimeout>;stopping?:Promise<void>};
export class DirectorSession{
 state:DirectorState={phase:'idle',active:false,stage:'style',approved:null,previewed:false};
 private run?:Run;private disposed=false;
 constructor(readonly client:DirectorClient,readonly validate:ValidateProposal,readonly revision:()=>number,readonly emit:(state:DirectorState)=>void){}
 private update(state:DirectorState){this.state=state;if(!this.disposed)this.emit(state);}
 async generate(provider:Provider,prompt:string,consent:boolean,contextConsent:boolean){
  if(this.disposed||this.state.active)return;
  const stage=this.state.stage,approved=this.state.approved,expectedRevision=this.revision();
  const run:Run={cancelled:false};this.run=run;
  this.update({...this.state,phase:'running',active:true,proposal:undefined,previewed:false,expectedRevision,message:undefined});
  run.deadline=setTimeout(()=>{void this.cancel();},generationObservationMs(provider));
  try{
   run.id=await this.client.start(provider,prompt,consent,stage,approved,contextConsent);
   if(run.cancelled||this.disposed){await this.stop(run);return;}
   this.update({...this.state,jobId:run.id});
   while(this.run===run&&!run.cancelled&&!this.disposed){
    const job=await this.client.poll(run.id,provider);
    if(run.cancelled||this.disposed)return;
    if(job.status==='running'){await new Promise<void>(resolve=>{const timer=setTimeout(resolve,800);run.wake=()=>{clearTimeout(timer);resolve();};});continue;}
    clearTimeout(run.deadline);
    if(job.status!=='succeeded'){this.update({...this.state,active:false,phase:job.status==='cancelled'?'cancelled':'failed',message:job.status==='cancelled'?'취소했어요. 문서는 유지돼요.':generationFailure(job.error)});return;}
    const proposal=this.validate(job.proposal,stage,approved);
    if(this.revision()!==expectedRevision){this.update({...this.state,active:false});this.invalidate();return;}
    this.update({...this.state,active:false,phase:'review',proposal,message:undefined});return;
   }
  }catch(error){
   clearTimeout(run.deadline);if(this.disposed||this.run!==run)return;
   if(run.cancelled){
    if(!run.id)this.update({...this.state,active:false,phase:'cancelled',proposal:undefined,previewed:false,message:'취소했어요. 문서와 실행 취소 기록은 유지돼요.'});
    return;
   }
   if(run.id){run.cancelled=true;await this.stop(run);}
   this.update({...this.state,active:!!run.id&&this.state.active,phase:'failed',proposal:undefined,message:error instanceof Error?error.message:invalid});
  }
 }
 private async stop(run:Run){
  if(!run.id)return;if(run.stopping)return run.stopping;
  run.stopping=(async()=>{try{await this.client.cancel(run.id!);if(this.run===run)this.update({...this.state,active:false,phase:'cancelled',proposal:undefined,previewed:false,message:'취소했어요. 문서와 실행 취소 기록은 유지돼요.'});}catch{if(this.run===run)this.update({...this.state,active:true,phase:'failed',proposal:undefined,message:'취소 확인이 필요해요. 취소 버튼으로 다시 확인해 주세요.'});}finally{run.stopping=undefined;}})();return run.stopping;
 }
 async cancel(){const run=this.run;if(!run||!this.state.active)return;run.cancelled=true;clearTimeout(run.deadline);run.wake?.();this.update({...this.state,phase:'cancelling',proposal:undefined,previewed:false});await this.stop(run);}
 accept(){
  if(this.state.phase!=='review'||!this.state.proposal||this.state.stage==='motion')return;
  if(this.state.expectedRevision!==this.revision()){this.invalidate();return;}
  this.update({...this.state,phase:'accepted',approved:this.state.proposal,proposal:undefined,stage:this.state.stage==='style'?'poses':'motion',previewed:false,message:'다음 단계 진행을 수락했어요. 예술적 완성도 판정과는 별개예요.'});
 }
 restore(value:unknown){
  if(this.disposed||this.state.active)throw Error('생성 중에는 단계를 복구할 수 없어요.');
  const bundle=object(value);
  if(Object.keys(bundle).sort().join('|')!=='poses|style')throw Error('스타일과 키 포즈 원본 제안이 모두 필요해요.');
  const style=this.validate(bundle.style,'style',null);
  const poses=this.validate(bundle.poses,'poses',style);
  this.update({phase:'review',active:false,stage:'poses',proposal:poses,approved:style,expectedRevision:this.revision(),previewed:false,message:'로컬 원본 제안을 복구했어요. 새 AI 생성이 아니며 문서는 바뀌지 않았어요. 포즈를 다시 검토·수락하고 다음 호출에 별도로 동의해 주세요.'});
 }
 revokePreview(){if(this.state.previewed)this.update({...this.state,previewed:false});}
 markPreviewed(){if(this.state.phase==='review'&&this.state.stage==='motion'&&this.state.expectedRevision===this.revision())this.update({...this.state,previewed:true});}
 apply(commit:(project:ProjectV3)=>boolean){
  if(this.state.phase!=='review'||this.state.stage!=='motion'||!this.state.proposal||!this.state.previewed)return false;
  if(this.state.expectedRevision!==this.revision()){this.invalidate();return false;}
  try{const proposal=this.validate(this.state.proposal,'motion',this.state.approved);if(!commit(proposal.project))throw Error('변경 사항이 없어요. 실행 취소 기록은 유지돼요.');this.update({...this.state,phase:'applied',proposal:undefined,approved:null,stage:'style',previewed:false,message:'적용했어요. 한 번 실행 취소하면 이전 문서로 돌아가요.'});return true;}
  catch(error){this.update({...this.state,message:error instanceof Error?error.message:invalid});return false;}
 }
 invalidate(){this.update({...this.state,phase:'stale',proposal:undefined,approved:null,stage:'style',previewed:false,message:'문서가 바뀌어 이전 제안의 수락과 적용 권한을 해제했어요. 스타일 단계부터 다시 요청해 주세요.'});}
 dispose(){this.disposed=true;void this.cancel();}
}
