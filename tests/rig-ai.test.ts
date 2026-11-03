// Offline only: real v2 validation/export/history, fake HTTP; no model calls.
import { expect, it, vi, afterEach } from 'vitest';
import { RigAiClient, RigAiSession, prepareRigAiApply, validateRigCandidate } from '../apps/web/src/rig/ai';
import { createProjectV2, addLayerV2, serializeProjectV2, validateProjectV2 } from '../packages/creator-core/src/v2';
import { createHistory, commitHistory, undoHistory, beginGesture } from '../apps/web/src/rig/history';
afterEach(()=>vi.useRealTimers());
const candidate=()=>addLayerV2(createProjectV2({name:'Generated object'}),'ellipse');
const reply=(data:unknown)=>new Response(JSON.stringify(data));

it('sends exactly the consented v2 brief and counts Unicode scalars',async()=>{
 const fetcher=vi.fn(async(url:string,init?:RequestInit)=>{expect(url).toBe('/api/ai/v2/jobs');expect(init?.method).toBe('POST');return reply({ok:true,job:{id:'job-1',status:'running'}});});
 const client=new RigAiClient(fetcher);
 await expect(client.start('codex','hello',false)).rejects.toThrow();
 await expect(client.start('codex','x'.repeat(4001),true)).rejects.toThrow();
 expect(fetcher).not.toHaveBeenCalled();
 await client.start('codex','😀'.repeat(4000),true);
 expect(fetcher.mock.calls[0]).toMatchObject(['/api/ai/v2/jobs',{method:'POST',credentials:'omit'}]);
 const init=fetcher.mock.calls[0][1] as RequestInit;
 expect(JSON.parse(init.body as string)).toEqual({provider:'codex',prompt:'😀'.repeat(4000),consent:true});
});
it('rejects invalid and export-budget candidates without mutating them',()=>{
 expect(()=>validateRigCandidate({...candidate(),fps:0})).toThrow();
 let p=createProjectV2();for(let i=0;i<20;i++)p=addLayerV2(p,'rect');
 for(const layer of p.layers)for(const prop of ['x','y','scale','rotation','opacity'] as const)layer.tracks[prop]=Array.from({length:100},(_,frame)=>({frame,value:prop==='scale'?100.12345678901234:0.12345678901234568,easing:'ease-in-out'}));
 validateProjectV2(p);const original=JSON.stringify(p);
 expect(()=>validateRigCandidate(p)).toThrow(/size|complexity/);
 expect(JSON.stringify(p)).toBe(original);
});
it('checks frozen freshness and gestures synchronously, then makes one undoable commit',()=>{
 const initial=createHistory(createProjectV2());const frozen=serializeProjectV2(initial.present);
 const p=candidate();const next=commitHistory(initial,prepareRigAiApply(initial,frozen,p));
 expect(next.past).toEqual([initial.present]);expect(undoHistory(next).present).toEqual(initial.present);
 expect(()=>prepareRigAiApply(next,frozen,p)).toThrow(/changed/);
 expect(()=>prepareRigAiApply(beginGesture(initial),frozen,p)).toThrow(/gesture/);
 expect(()=>prepareRigAiApply(initial,frozen,initial.present)).toThrow(/No changes/);
 expect(()=>prepareRigAiApply(initial,frozen,{...p,fps:0})).toThrow();
 expect(initial.past).toEqual([]);
});
it('does not send on construction; polls validated review, applies only explicitly and once',async()=>{
 const fetcher=vi.fn(async(url:string)=>reply({ok:true,job:url==='/api/ai/v2/jobs'?{id:'job-1',status:'running'}:{id:'job-1',provider:'codex',status:'succeeded',project:candidate()}}));
 const session=new RigAiSession(new RigAiClient(fetcher),()=>{});
 expect(fetcher).not.toHaveBeenCalled();
 const frozen=serializeProjectV2(createProjectV2());
 await session.generate('codex','orbit',true,frozen);
 expect(session.state.phase).toBe('review');expect(session.state.expected).toBe(frozen);
 const apply=vi.fn();session.apply(apply);session.apply(apply);expect(apply).toHaveBeenCalledOnce();
 session.dispose();
});
it('cancels a pending submit on disposal and never publishes its late result',async()=>{
 let resolve!:(value:Response)=>void;
 const start=new Promise<Response>(done=>{resolve=done;});
 const fetcher=vi.fn(async(url:string)=>url==='/api/ai/v2/jobs'?start:reply({ok:true,job:{id:'job-1',status:'cancelled'}}));
 const emit=vi.fn();const session=new RigAiSession(new RigAiClient(fetcher),emit);
 const pending=session.generate('codex','orbit',true,'local-only');session.dispose();const emissions=emit.mock.calls.length;
 resolve(reply({ok:true,job:{id:'job-1',status:'running'}}));await pending;
 expect(fetcher.mock.calls.map(call=>call[0])).toEqual(['/api/ai/v2/jobs','/api/ai/jobs/job-1/cancel']);
 expect(emit).toHaveBeenCalledTimes(emissions);const apply=vi.fn();session.apply(apply);expect(apply).not.toHaveBeenCalled();
});
it('ignores stale poll results after cancellation',async()=>{
 let resolve!:(value:Response)=>void;const poll=new Promise<Response>(done=>{resolve=done;});
 const session=new RigAiSession(new RigAiClient(async(url:string)=>url==='/api/ai/v2/jobs'?reply({ok:true,job:{id:'job-1',status:'running'}}):url.endsWith('/cancel')?reply({ok:true,job:{id:'job-1',status:'cancelled'}}):poll),()=>{});
 const pending=session.generate('codex','orbit',true,'local-only');await new Promise(done=>setTimeout(done,0));await session.cancel();
 resolve(reply({ok:true,job:{id:'job-1',provider:'codex',status:'succeeded',project:candidate()}}));await pending;
 expect(session.state.phase).toBe('cancelled');expect(session.state.candidate).toBeUndefined();session.dispose();
});
import { readFileSync } from 'node:fs';

it('keeps admission locked after an unconfirmed cancel and retries only the owned job',async()=>{
 let cancelCount=0;let resolve!:(value:Response)=>void;
 const poll=new Promise<Response>(done=>{resolve=done;});
 const fetcher=vi.fn(async(url:string)=>{
  if(url==='/api/ai/v2/jobs')return reply({ok:true,job:{id:'job-1',status:'running'}});
  if(url.endsWith('/cancel')){if(++cancelCount===1)throw Error('private');return reply({ok:true,job:{id:'job-1',status:'cancelled'}});}
  return poll;
 });
 const session=new RigAiSession(new RigAiClient(fetcher),()=>{});
 const pending=session.generate('codex','orbit',true,'local');await new Promise(done=>setTimeout(done,0));
 await session.cancel();expect(session.state.active).toBe(true);expect(session.state.message).toContain('Cancellation could not be confirmed');
 await session.generate('claude','another',true,'other');expect(fetcher.mock.calls.filter(call=>call[0]==='/api/ai/v2/jobs')).toHaveLength(1);
 await session.cancel();expect(session.state.active).toBe(false);
 resolve(reply({ok:true,job:{id:'job-1',provider:'codex',status:'succeeded',project:candidate()}}));await pending;
 expect(session.state.candidate).toBeUndefined();session.dispose();
});
it('bounds the generation wait and cancels without publishing a late review',async()=>{
 vi.useFakeTimers();const calls:string[]=[];
 const session=new RigAiSession(new RigAiClient(async(url:string)=>{calls.push(url);return reply({ok:true,job:{id:'job-1',provider:'codex',status:url.endsWith('/cancel')?'cancelled':'running'}});}),()=>{});
 const pending=session.generate('codex','orbit',true,'local');await vi.advanceTimersByTimeAsync(181000);await pending;
 expect(session.state.phase).toBe('failed');expect(session.state.message).toContain('timed out');
 expect(calls.at(-1)).toBe('/api/ai/jobs/job-1/cancel');session.dispose();
});
it('uses installed-only status and rejects mismatched v2 poll ownership',async()=>{
 const fetcher=vi.fn(async(url:string)=>{expect(url).toBe('/api/ai/status');return reply({ok:true,scope:'installed-only',providers:[{id:'codex',label:'Codex',installed:true},{id:'claude',label:'Claude Code',installed:false}]});});
 await expect(new RigAiClient(fetcher).status()).resolves.toHaveLength(2);
 const client=new RigAiClient(async()=>reply({ok:true,job:{id:'other',provider:'codex',status:'succeeded',project:candidate()}}));
 await expect(client.poll('job-1','codex')).rejects.toThrow('invalid');
});


it('exposes explicit AI generation without the obsolete no-AI claim',()=>{
 const source=readFileSync(new URL('../apps/web/src/rig/RigEditor.tsx',import.meta.url),'utf8');
 expect(source).not.toContain('No AI attached.');
 expect(source).toContain('RigAiPanel');
});
