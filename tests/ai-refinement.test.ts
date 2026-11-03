// Provider-free contract tests. Real client/session; only HTTP is faked.
import{expect,it,vi}from'vitest';
import{AiClient}from'../apps/web/src/creator/ai/client';
import{AiSession}from'../apps/web/src/creator/ai/session';
import{addLayer,createProject}from'../packages/creator-core/src';
const project=()=>addLayer(createProject({name:'Context bird'}),'rect');
function response(p=project()){for(const l of p.layers)l.tracks={x:[],y:[],scale:[],rotation:[],opacity:[],...l.tracks};return p;}
const reply=(v:unknown)=>new Response(JSON.stringify(v));
it('sends project context only with separate explicit context consent, without mutating its source',async()=>{
 let payload:unknown;const p=project(),before=JSON.stringify(p);const client=new AiClient(async(_url,init)=>{payload=JSON.parse(String(init?.body));return reply({ok:true,job:{id:'context-job',status:'running'}});});
 await client.start('codex','Make the wing wave more',true,{project:p,consent:true});
 expect(payload).toMatchObject({provider:'codex',prompt:'Make the wing wave more',contextConsent:true,baseProject:{name:'Context bird',layers:[{tracks:{x:[],y:[],scale:[],rotation:[],opacity:[]}}]}});expect(JSON.stringify(p)).toBe(before);
});
it('rejects absent context consent before any network operation',async()=>{
 const fetcher=vi.fn(async()=>reply({ok:true,job:{id:'job',status:'running'}}));const client=new AiClient(fetcher);
 await expect(client.start('codex','Change only wing',true,{project:project(),consent:false})).rejects.toThrow(/consent/i);expect(fetcher).not.toHaveBeenCalled();
});
it('freezes refinement context and blocks stale Apply instead of overwriting newer editor work',async()=>{
 const base=project(),proposal=response();proposal.name='Refined bird';const applied=vi.fn();const session=new AiSession(new AiClient(async url=>url==='/api/ai/jobs'?reply({ok:true,job:{id:'edit-job',status:'running'}}):reply({ok:true,job:{id:'edit-job',provider:'codex',status:'succeeded',project:proposal}})),()=>{});
 await session.generate('codex','Change only wing',true,{project:base,consent:true});expect(session.state.baseProject?.name).toBe('Context bird');const newer=structuredClone(base);newer.layers[0].x+=20;session.apply(applied,newer);expect(applied).not.toHaveBeenCalled();expect(session.state.phase).toBe('ready');expect(session.state.message).toMatch(/changed/i);session.apply(applied,base);expect(applied).toHaveBeenCalledOnce();session.dispose();
});
it('does not misread one blink as one-shot playback when the requested motion explicitly loops',async()=>{
 const session=new AiSession(new AiClient(async url=>url==='/api/ai/jobs'?reply({ok:true,job:{id:'loop-job',status:'running'}}):reply({ok:true,job:{id:'loop-job',provider:'codex',status:'succeeded',project:response()}})),()=>{});
 await session.generate('codex','4초 루프. 중간에 한 번 눈을 깜빡이고 처음과 마지막 자세가 같게 해줘.',true);expect(session.state.reviewOptions?.loop).toBe(true);session.dispose();
});
it('does not consume Undo for a contextual proposal with no changes',async()=>{
 const base=project(),applied=vi.fn();const session=new AiSession(new AiClient(async url=>url==='/api/ai/jobs'?reply({ok:true,job:{id:'same',status:'running'}}):reply({ok:true,job:{id:'same',provider:'codex',status:'succeeded',project:response()}})),()=>{});
 await session.generate('codex','Keep everything',true,{project:base,consent:true});session.apply(applied,base);expect(applied).not.toHaveBeenCalled();expect(session.state.phase).toBe('ready');expect(session.state.message).toMatch(/no changes/i);session.dispose();
});
