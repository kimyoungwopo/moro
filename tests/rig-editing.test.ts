import { expect, it } from 'vitest';
import * as core from '../packages/creator-core/src/v2';
import { dragLayer, dragHandle, convertPath, nearestHandle } from '../apps/web/src/rig/editing';
import { createHistory, commitHistory, beginGesture, endGesture, undoHistory, redoHistory, cancelGesture } from '../apps/web/src/rig/history';
function fixture(){
 let p=core.addLayerV2(core.createProjectV2(),'group'); const parent=p.layers[0].id;
 p=core.updateLayerV2(p,parent,{rotation:90,scale:200,pivot:[12,8]});
 p=core.addLayerV2(p,'path'); const id=p.layers[1].id;
 p=core.updateLayerV2(p,id,{parentId:parent});
 return {p,id,parent};
}
it('overlapping mobile hit areas choose the nearest actual handle, not DOM paint order',()=>{
 const {p,id}=fixture();const node=p.layers[1];if(node.type!=='path')throw Error('fixture');
 const matrix=core.worldMatricesV2(p,0).get(id)!;const vertex=node.path.vertices[1];
 expect(nearestHandle(p,id,0,core.transformPointV2(matrix,vertex),1)).toEqual({kind:'vertex',index:1});
 const tangent=node.path.inTangents[1];
 expect(nearestHandle(p,id,0,core.transformPointV2(matrix,[vertex[0]+tangent[0],vertex[1]+tangent[1]]),1)).toEqual({kind:'in',index:1});
});
it('inverse parent drag moves a rotated/scaled descendant by canvas delta without mutating source',()=>{
 const {p,id}=fixture(); const before=core.worldMatricesV2(p,0).get(id)!;
 const next=dragLayer(p,id,0,[100,100],[120,130]);
 const after=core.worldMatricesV2(next,0).get(id)!;
 expect(after[4]-before[4]).toBeCloseTo(20); expect(after[5]-before[5]).toBeCloseTo(30);
 expect(next).not.toBe(p); expect(p.layers[1].tracks.x).toEqual([]);
});
it('node inverse maps both tangent handles to relative offsets and leaves vertex fixed',()=>{
 const {p,id}=fixture(); const node=p.layers[1]; if(node.type!=='path') throw Error('fixture');
 const vertex=node.path.vertices[1];
 const world=core.transformPointV2(core.worldMatricesV2(p,0).get(id)!,[vertex[0]+27,vertex[1]-19]);
 for(const kind of ['in','out'] as const){
  const next=dragHandle(p,id,0,{kind,index:1},world); const changed=next.layers[1];
  if(changed.type!=='path') throw Error('fixture');
  const result=changed.path[kind==='in'?'inTangents':'outTangents'][1];
  expect(result[0]).toBeCloseTo(27); expect(result[1]).toBeCloseTo(-19);
  expect(changed.path.vertices[1]).toEqual(vertex);
 }
});
it('vertex drag preserves authored tangent offsets, origin and pivot',()=>{
 const {p,id}=fixture(); const node=p.layers[1]; if(node.type!=='path') throw Error('fixture');
 const world=core.transformPointV2(core.worldMatricesV2(p,0).get(id)!,[15,-22]);
 const next=dragHandle(p,id,0,{kind:'vertex',index:0},world); const changed=next.layers[1];
 if(changed.type!=='path') throw Error('fixture');
 expect(changed.path.vertices[0][0]).toBeCloseTo(15); expect(changed.path.vertices[0][1]).toBeCloseTo(-22);
 expect(changed.path.outTangents).toEqual(node.path.outTangents); expect(changed.pivot).toEqual(node.pivot);
});
it('open conversion removes fill and unused endpoint handles',()=>{
 const {p,id}=fixture(); const next=convertPath(p,id,false); const node=next.layers[1];
 if(node.type!=='path') throw Error('fixture');
 expect(node.path.closed).toBe(false); expect(node.fill).toBe(null);
 expect(node.path.inTangents[0]).toEqual([0,0]); expect(node.path.outTangents.at(-1)).toEqual([0,0]);
});
it('one hundred inverse-aware pointer moves are one reversible undo gesture; cancellation restores source',()=>{
 const {p,id}=fixture(); let h=beginGesture(createHistory(p));
 for(let i=1;i<=100;i++) h=commitHistory(h,dragLayer(p,id,0,[0,0],[i,10]));
 const committed=endGesture(h); expect(committed.past).toHaveLength(1);
 expect(undoHistory(committed).present).toEqual(p); expect(redoHistory(undoHistory(committed)).present).toEqual(committed.present);
 expect(cancelGesture(h).present).toBe(p); expect(cancelGesture(h).past).toEqual([]);
});
