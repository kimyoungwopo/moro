// Protocol fixtures only. No CLI/model requests.
import {describe,it,expect,vi,afterEach} from 'vitest';
import {AiClient} from '../apps/web/src/creator/ai/client';
import {AiSession} from '../apps/web/src/creator/ai/session';
import {RigAiClient,RigAiSession} from '../apps/web/src/rig/ai';
import {DirectorClient,DirectorSession} from '../apps/web/src/studio/session';
function gate<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{resolve,promise};}
function prepare(mode:'Creator'|'Rig'|'Studio'){
 if(mode==='Creator'){
  const client=new AiClient(),pending=gate<Awaited<ReturnType<AiClient['poll']>>>();vi.spyOn(client,'start').mockResolvedValue('fixture-observation');vi.spyOn(client,'poll').mockReturnValue(pending.promise);const cancel=vi.spyOn(client,'cancel').mockResolvedValue('cancelled');const session=new AiSession(client,()=>{});const work=session.generate('claude','non-sensitive fixture',true);
  return{session,work,cancel,complete:()=>pending.resolve({id:'fixture-observation',provider:'claude',status:'failed',error:{code:'timeout_thinking',message:'Claude was still reasoning.'}})};
 }
 if(mode==='Rig'){
  const client=new RigAiClient(),pending=gate<Awaited<ReturnType<RigAiClient['poll']>>>();vi.spyOn(client,'start').mockResolvedValue('fixture-observation');vi.spyOn(client,'poll').mockReturnValue(pending.promise);const cancel=vi.spyOn(client,'cancel').mockResolvedValue('cancelled');const session=new RigAiSession(client,()=>{});const work=session.generate('claude','non-sensitive fixture',true,'local-only-revision');
  return{session,work,cancel,complete:()=>pending.resolve({status:'failed',message:'Claude was still reasoning.'})};
 }
 const client=new DirectorClient(),pending=gate<Awaited<ReturnType<DirectorClient['poll']>>>();vi.spyOn(client,'start').mockResolvedValue('fixture-observation');vi.spyOn(client,'poll').mockReturnValue(pending.promise);const cancel=vi.spyOn(client,'cancel').mockResolvedValue(undefined);const session=new DirectorSession(client,()=>{throw Error('must not apply');},()=>1,()=>{});const work=session.generate('claude','non-sensitive fixture',true,false);
 return{session,work,cancel,complete:()=>pending.resolve({id:'fixture-observation',provider:'claude',kind:'director',status:'failed',error:{code:'timeout_thinking',message:'PRIVATE_RAW_DIAGNOSTIC'}})};
}
afterEach(()=>vi.useRealTimers());
describe('Claude observation deadline does not mask native terminal errors',()=>{
 for(const mode of ['Creator','Rig','Studio'] as const){
  it(`${mode} allows native180s deadline plus bounded observation grace`,async()=>{
   vi.useFakeTimers();const run=prepare(mode);
   try{await vi.advanceTimersByTimeAsync(180100);expect(run.cancel).not.toHaveBeenCalled();run.complete();await run.work;expect(run.session.state.active).toBe(false);expect(run.session.state.phase).toBe('failed');}
   finally{run.complete();run.session.dispose();}
  });
  it(`${mode} still cancels an unresponsive job after210s`,async()=>{
   vi.useFakeTimers();const run=prepare(mode);
   try{await vi.advanceTimersByTimeAsync(210001);expect(run.cancel).toHaveBeenCalledOnce();run.complete();await run.work;expect(run.session.state.active).toBe(false);}
   finally{run.complete();run.session.dispose();}
  });
 }
});
