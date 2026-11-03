import{expect,it}from'vitest';
import{addLayer,createProject,updateLayer}from'../packages/creator-core/src';
import*as context from'../apps/web/src/creator/ai/project-context';
it('reports actual layer changes independently of JSON key order and equivalent default fields',()=>{
 const base=addLayer(createProject(),'rect');const next=updateLayer(base,base.layers[0].id,{fill:'#FF6B86'});
 const delta=context.projectDelta(base,next);expect(delta.changed).toEqual([base.layers[0].id]);expect(delta.added).toEqual([]);expect(delta.removed).toEqual([]);expect(delta.settingsChanged).toBe(false);
 const reordered=JSON.parse(JSON.stringify(base,(k,v)=>k==='tracks'?{opacity:[],rotation:[],scale:[],y:[],x:[]}:v));reordered.layers[0].cornerRadius=null;
 expect(context.projectSignature(base)).toBe(context.projectSignature(reordered));expect(context.projectDelta(base,reordered).changed).toEqual([]);
});
it('validates context capacity and creates independent snapshots',()=>{
 const p=addLayer(createProject(),'ellipse');const prepared=context.prepareProjectContext(p);prepared.layers[0].x=400;expect(p.layers[0].x).toBe(256);
 expect(()=>context.prepareProjectContext(createProject())).toThrow(/1–20/);let tooMany=createProject();for(let i=0;i<21;i++)tooMany=addLayer(tooMany,'rect');expect(()=>context.prepareProjectContext(tooMany)).toThrow(/1–20/);
});
