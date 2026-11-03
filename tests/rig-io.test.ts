import { expect, it } from 'vitest';
import { parseProject, createProject, addLayer } from '../packages/creator-core/src';
import * as core from '../packages/creator-core/src/v2';
import { parseDocument } from '../packages/document-core/src';
import { dragHandle, dragLayer } from '../apps/web/src/rig/editing';
import { createHistory, commitHistory, undoHistory } from '../apps/web/src/rig/history';

it('edited curves, parent, pivot and animated channels survive editable reopen and real expression-free Lottie export',()=>{
 let p=core.addLayerV2(core.createProjectV2(),'group');const group=p.layers[0].id;
 p=core.updateLayerV2(p,group,{rotation:35,scale:150,pivot:[12,-8]});
 p=core.addLayerV2(p,'path');const path=p.layers[1].id;
 p=core.reparentLayerV2(p,path,group);
 p=core.setPivotV2(p,path,[21,13],true);
 const target=core.transformPointV2(core.worldMatricesV2(p,0).get(path)!,[28,-10]);
 p=dragHandle(p,path,0,{kind:'out',index:1},target);
 p=core.setKeyframeV2(p,path,'x',0,100,'ease-in-out');
 p=core.setKeyframeV2(p,path,'x',119,220,'linear');
 p=core.setKeyframeV2(p,group,'rotation',0,35,'ease-out');
 p=core.setKeyframeV2(p,group,'rotation',119,70,'linear');
 const text=core.serializeProjectV2(p);const reopened=core.parseProjectV2(text);
 expect(reopened).toEqual(p);
 expect(reopened).not.toBe(p);
 const animation=core.exportLottieV2(reopened);const json=JSON.stringify(animation);
 expect(json).toContain('"ty":"sh"');
 const layers=animation.layers as unknown as {ty:number;ind:number;parent?:number;ks:{a:{k:number[]}}}[];
 expect(layers.find(layer=>layer.ty===4)?.parent).toBe(layers.find(layer=>layer.ty===3)?.ind);
 expect(layers.find(layer=>layer.ty===4)?.ks.a.k).toEqual([21,13,0]);
 expect(parseDocument(new TextEncoder().encode(json),'rig.lottie.json').diagnostics.blocked).toEqual([]);
 // Reversed/fractional seeks do not mutate the editable project or its curves.
 for(const frame of [119,21.5,60,0,118.25])expect(core.worldMatricesV2(reopened,frame).get(path)).toHaveLength(6);
 expect(core.serializeProjectV2(reopened)).toBe(text);
});
it('animated descendant drag authors local keys through real parent inverse and is a single Undo snapshot',()=>{
 let p=core.addLayerV2(core.createProjectV2(),'group');const parent=p.layers[0].id;
 p=core.updateLayerV2(p,parent,{rotation:90,scale:200});
 p=core.addLayerV2(p,'rect');const id=p.layers[1].id;p=core.reparentLayerV2(p,id,parent);
 p=core.setKeyframeV2(p,id,'x',0,30);p=core.setKeyframeV2(p,id,'x',119,80);
 p=core.setKeyframeV2(p,id,'y',0,40);p=core.setKeyframeV2(p,id,'y',119,100);
 const before=core.worldMatricesV2(p,60).get(id)!;const next=dragLayer(p,id,60,[0,0],[24,-16]);
 const after=core.worldMatricesV2(next,60).get(id)!;
 expect(after[4]-before[4]).toBeCloseTo(24);expect(after[5]-before[5]).toBeCloseTo(-16);
 expect(next.layers[1].tracks.x.map(key=>key.frame)).toEqual([0,60,119]);
 expect(undoHistory(commitHistory(createHistory(p),next)).present).toEqual(p);
});
it('unsafe animated pivot and parenting reject without corrupting source or original snapshot',()=>{
 let p=core.addLayerV2(core.createProjectV2(),'group');const parent=p.layers[0].id;
 p=core.addLayerV2(p,'path');const id=p.layers[1].id;
 p=core.setKeyframeV2(p,id,'rotation',0,0);p=core.setKeyframeV2(p,id,'rotation',119,90);
 const before=core.serializeProjectV2(p);const h=createHistory(p);
 expect(()=>core.setPivotV2(p,id,[12,10],true)).toThrow();
 expect(()=>core.reparentLayerV2(p,id,parent)).toThrow();
 expect(core.serializeProjectV2(h.present)).toBe(before);
 expect(h.past).toEqual([]);
});
it('explicit v1 copy migration preserves original and cannot silently pass through v2 reopen',()=>{
 const v1=addLayer(createProject(),'ellipse');const original=JSON.stringify(v1);
 const copied=core.migrateProjectV1(parseProject(original));
 expect(copied.version).toBe(2);expect(JSON.stringify(v1)).toBe(original);
 expect(copied.layers[0].parentId).toBe(null);expect(copied.layers[0].pivot).toEqual([0,0]);
 expect(()=>core.parseProjectV2(original)).toThrow();
 expect(core.parseProjectV2(core.serializeProjectV2(copied))).toEqual(copied);
});
